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
    const uomTableId = config.UOM_TABLE || process.env.UOM_TABLE;

    if (!realmHostname || !userToken) {
      return NextResponse.json(
        { error: 'Missing QB_REALM_HOSTNAME or QB_USER_TOKEN environment variables' },
        { status: 500 }
      );
    }

    if (!uomTableId) {
      return NextResponse.json(
        { error: 'Missing UOM_TABLE configuration. Please add UOM_TABLE=table_id to .config file.' },
        { status: 500 }
      );
    }

    // Clean realmHostname
    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    // Step 1: Fetch table fields to find the UOM value field
    const fieldsUrl = `https://api.quickbase.com/v1/fields?tableId=${uomTableId}`;
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
            details: { url: fieldsUrl, tableId: uomTableId }
          },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { 
          error: `Network error fetching table fields: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: { url: fieldsUrl, tableId: uomTableId }
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
            tableId: uomTableId,
            errorPreview: errorText.substring(0, 500),
            url: fieldsUrl
          }
        },
        { status: fieldsResponse.status }
      );
    }

    const fieldsData = await fieldsResponse.json();
    console.log('Fields data received, count:', fieldsData?.length || 0);
    console.log(`Fetched ${fieldsData.length} fields from UOM table`);

    // Step 2: Find the UOM value field and Record ID field
    let uomFieldId: number | null = null;
    let recordIdFieldId: number = 3; // Default Record ID field

    // Look for Record ID field (usually field type 'recordid' or id 3)
    const recordIdField = fieldsData.find((f: any) => 
      f.fieldType === 'recordid' || f.id === 3 || f.baseType === 'recordid'
    );
    if (recordIdField) {
      recordIdFieldId = recordIdField.id;
    }

    // Log all fields for debugging
    console.log('Available fields in UOM table:', fieldsData.map((f: any) => ({ 
      id: f.id, 
      label: f.label, 
      type: f.fieldType,
      baseType: f.baseType 
    })));

    // Look for UOM field - try multiple strategies:
    // 1. Exact match "UOM" (case insensitive)
    // 2. Contains "UOM" 
    // 3. Contains "unit"
    // 4. First text field
    let uomField = fieldsData.find((f: any) => 
      f.label && f.label.toLowerCase().trim() === 'uom'
    );
    
    if (!uomField) {
      uomField = fieldsData.find((f: any) => 
        f.label && f.label.toLowerCase().includes('uom')
      );
    }
    
    if (!uomField) {
      uomField = fieldsData.find((f: any) => 
        f.label && f.label.toLowerCase().includes('unit')
      );
    }

    if (uomField) {
      uomFieldId = uomField.id;
      console.log(`Found UOM field: ID ${uomFieldId}, Label: "${uomField.label}"`);
    } else {
      // If not found, try to find any text field that might be the UOM value
      // Look for the first text field (excluding record ID)
      const textField = fieldsData.find((f: any) => 
        (f.baseType === 'text' || f.fieldType === 'text') && f.id !== recordIdFieldId
      );
      if (textField) {
        uomFieldId = textField.id;
        console.log(`Using first text field as UOM: ID ${uomFieldId}, Label: "${textField.label}"`);
      }
    }

    if (!uomFieldId) {
      const availableFields = fieldsData.map((f: any) => ({ 
        id: f.id, 
        label: f.label, 
        type: f.fieldType,
        baseType: f.baseType 
      }));
      console.error('Could not find UOM field. Available fields:', availableFields);
      return NextResponse.json(
        { 
          error: 'Could not find UOM field in UOM table. Please verify the table structure.',
          details: { 
            tableId: uomTableId,
            availableFields: availableFields,
            suggestion: 'Look for a field labeled "UOM" or containing "UOM" in the label'
          }
        },
        { status: 500 }
      );
    }

    // Step 3: Query records using the correct field IDs
    const queryUrl = `https://api.quickbase.com/v1/records/query`;
    const queryBody = {
      from: uomTableId,
      select: [recordIdFieldId, uomFieldId],
    };

    console.log('Querying UOM records with field IDs:', { recordId: recordIdFieldId, uom: uomFieldId });

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
            details: { url: queryUrl, tableId: uomTableId }
          },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { 
          error: `Network error querying UOM records: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: { url: queryUrl, tableId: uomTableId }
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
          error: `Failed to query UOM records: ${errorData.message || errorData.error || 'Unknown error'}`,
          details: { 
            status: queryResponse.status,
            tableId: uomTableId,
            response: errorData
          }
        },
        { status: queryResponse.status }
      );
    }

    const queryData = await queryResponse.json();
    console.log('UOM query data received:', queryData.data?.length || 0, 'records');
    console.log('Sample record structure:', queryData.data?.[0] || 'No records');

    // Step 4: Format the data
    const uomOptions = (queryData.data || []).map((record: any) => {
      const recordId = record[recordIdFieldId]?.value || record[recordIdFieldId];
      const uomValue = record[uomFieldId]?.value || record[uomFieldId] || '';
      return { recordId: String(recordId), uomValue: String(uomValue) };
    }).filter((option: any) => option.uomValue && option.uomValue.trim()); // Filter out empty values

    // Sort alphabetically by UOM value
    uomOptions.sort((a: any, b: any) => 
      a.uomValue.localeCompare(b.uomValue)
    );

    console.log('Returning', uomOptions.length, 'UOM options');
    
    if (uomOptions.length === 0) {
      console.warn('No UOM options found. This might indicate:');
      console.warn('1. The UOM table is empty');
      console.warn('2. The UOM field is empty for all records');
      console.warn('3. The field detection found the wrong field');
    }

    return NextResponse.json({
      success: true,
      options: uomOptions,
      fieldId: uomFieldId,
      recordIdFieldId: recordIdFieldId,
    });
  } catch (error) {
    console.error('Error fetching UOM options:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `An error occurred: ${errorMessage}` },
      { status: 500 }
    );
  }
}

