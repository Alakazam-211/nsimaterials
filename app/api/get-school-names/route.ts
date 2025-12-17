import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read config file to get table IDs
function getConfig() {
  const config: Record<string, string> = {};
  
  try {
    const configPath = path.join(process.cwd(), '.config');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      configContent.split('\n').forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            config[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  
  return config;
}

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const realmHostname = process.env.QB_REALM_HOSTNAME || process.env.QUICKBASE_REALM_HOSTNAME;
    const userToken = process.env.QB_USER_TOKEN || process.env.QUICKBASE_API_TOKEN;
    const jobsTableId = config.JOBS_TABLE || process.env.JOBS_TABLE || 'buy4q98bb';

    if (!realmHostname || !userToken) {
      return NextResponse.json(
        { error: 'Missing QB_REALM_HOSTNAME or QB_USER_TOKEN environment variables' },
        { status: 500 }
      );
    }

    // Clean realmHostname
    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    // Step 1: Fetch table fields to find the School Name field
    const fieldsUrl = `https://api.quickbase.com/v1/fields?tableId=${jobsTableId}`;
    // Removed console logs to prevent sensitive information leakage
    
    let fieldsResponse;
    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      fieldsResponse = await fetch(fieldsUrl, {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error('Error fetching fields:', fetchError);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: 'Request timeout: The QuickBase API did not respond within 30 seconds.',
            details: { url: fieldsUrl, tableId: jobsTableId }
          },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { 
          error: `Network error fetching table fields: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: { url: fieldsUrl, tableId: jobsTableId }
        },
        { status: 500 }
      );
    }

    console.log('Fields response status:', fieldsResponse.status, fieldsResponse.statusText);
    
    if (!fieldsResponse.ok) {
      const errorText = await fieldsResponse.text();
      console.error('Fields API error:', errorText);
      return NextResponse.json(
        { 
          error: `Failed to fetch table fields: ${fieldsResponse.status} ${fieldsResponse.statusText}`,
          details: { 
            status: fieldsResponse.status,
            tableId: jobsTableId,
            errorPreview: errorText.substring(0, 500),
            url: fieldsUrl
          }
        },
        { status: fieldsResponse.status }
      );
    }

    const fieldsData = await fieldsResponse.json();
    console.log('Fields data received, count:', fieldsData?.length || 0);
    console.log(`Fetched ${fieldsData.length} fields from Jobs table`);

    // Step 2: Find the School Name field and Record ID field
    let schoolNameFieldId: number | null = null;
    let recordIdFieldId: number = 3; // Default Record ID field

    // Look for Record ID field (usually field type 'recordid' or id 3)
    const recordIdField = fieldsData.find((f: any) => 
      f.fieldType === 'recordid' || f.id === 3 || f.baseType === 'recordid'
    );
    if (recordIdField) {
      recordIdFieldId = recordIdField.id;
    }

    // Log all fields for debugging
    console.log('Available fields in Jobs table:', fieldsData.map((f: any) => ({ 
      id: f.id, 
      label: f.label, 
      type: f.fieldType,
      baseType: f.baseType 
    })));

    // Look for School Name field - try multiple strategies:
    // 1. Exact match "School Name"
    // 2. Contains "school" and "name"
    // 3. Contains "school"
    // 4. First text field
    let schoolNameField = fieldsData.find((f: any) => 
      f.label && f.label.toLowerCase() === 'school name'
    );
    
    if (!schoolNameField) {
      schoolNameField = fieldsData.find((f: any) => 
        f.label && f.label.toLowerCase().includes('school') && f.label.toLowerCase().includes('name')
      );
    }
    
    if (!schoolNameField) {
      schoolNameField = fieldsData.find((f: any) => 
        f.label && f.label.toLowerCase().includes('school')
      );
    }

    if (schoolNameField) {
      schoolNameFieldId = schoolNameField.id;
      console.log(`Found School Name field: ID ${schoolNameFieldId}, Label: "${schoolNameField.label}"`);
    } else {
      // If not found, try to find any text field that might be the school name
      // Look for the first text field (excluding record ID)
      const textField = fieldsData.find((f: any) => 
        (f.baseType === 'text' || f.fieldType === 'text') && f.id !== recordIdFieldId
      );
      if (textField) {
        schoolNameFieldId = textField.id;
        console.log(`Using first text field as School Name: ID ${schoolNameFieldId}, Label: "${textField.label}"`);
      }
    }

    if (!schoolNameFieldId) {
      const availableFields = fieldsData.map((f: any) => ({ 
        id: f.id, 
        label: f.label, 
        type: f.fieldType,
        baseType: f.baseType 
      }));
      console.error('Could not find School Name field. Available fields:', availableFields);
      return NextResponse.json(
        { 
          error: 'Could not find School Name field in Jobs table. Please verify the table structure.',
          details: { 
            tableId: jobsTableId,
            availableFields: availableFields,
            suggestion: 'Look for a field with "school" or "name" in the label, or check the first text field'
          }
        },
        { status: 500 }
      );
    }

    // Step 3: Query records using the correct field IDs
    const queryUrl = `https://api.quickbase.com/v1/records/query`;
    const queryBody = {
      from: jobsTableId,
      select: [recordIdFieldId, schoolNameFieldId],
    };

    console.log('Querying records with field IDs:', { recordId: recordIdFieldId, schoolName: schoolNameFieldId });

    let queryResponse;
    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      queryResponse = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
        body: JSON.stringify(queryBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error('Query fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: 'Request timeout: The QuickBase API did not respond within 30 seconds.',
            details: { url: queryUrl, tableId: jobsTableId }
          },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { 
          error: `Network error querying records: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: { url: queryUrl, tableId: jobsTableId }
        },
        { status: 500 }
      );
    }

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText.substring(0, 500) };
      }
      return NextResponse.json(
        { 
          error: `Failed to query records: ${errorData.message || errorData.error || 'Unknown error'}`,
          details: { 
            status: queryResponse.status,
            tableId: jobsTableId,
            response: errorData
          }
        },
        { status: queryResponse.status }
      );
    }

    const queryData = await queryResponse.json();
    console.log('Query data received:', queryData.data?.length || 0, 'records');
    console.log('Sample record structure:', queryData.data?.[0] || 'No records');

    // Step 4: Format the data
    const schoolOptions = (queryData.data || []).map((record: any) => {
      const recordId = record[recordIdFieldId]?.value || record[recordIdFieldId];
      const schoolName = record[schoolNameFieldId]?.value || record[schoolNameFieldId] || '';
      return { recordId: String(recordId), schoolName: String(schoolName) };
    }).filter((option: any) => option.schoolName && option.schoolName.trim()); // Filter out empty names

    // Sort alphabetically by school name
    schoolOptions.sort((a: any, b: any) => 
      a.schoolName.localeCompare(b.schoolName)
    );

    console.log('Returning', schoolOptions.length, 'school options');
    
    if (schoolOptions.length === 0) {
      console.warn('No school options found. This might indicate:');
      console.warn('1. The Jobs table is empty');
      console.warn('2. The School Name field is empty for all records');
      console.warn('3. The field detection found the wrong field');
    }

    return NextResponse.json({
      success: true,
      options: schoolOptions,
      fieldId: schoolNameFieldId,
      recordIdFieldId: recordIdFieldId,
    });
  } catch (error) {
    console.error('Error fetching school names:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `An error occurred: ${errorMessage}` },
      { status: 500 }
    );
  }
}

