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

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const realmHostname = process.env.QB_REALM_HOSTNAME || process.env.QUICKBASE_REALM_HOSTNAME;
    const userToken = process.env.QB_USER_TOKEN || process.env.QUICKBASE_API_TOKEN;

    if (!realmHostname || !userToken) {
      return NextResponse.json(
        { error: 'Missing QuickBase configuration' },
        { status: 500 }
      );
    }

    // Clean realmHostname
    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    // Contacts Book table ID
    const contactsBookTableId = 'buzhqi64n';

    // First, get the fields for the Contacts Book table to find field IDs
    const fieldsResponse = await fetch(
      `https://api.quickbase.com/v1/fields?tableId=${contactsBookTableId}`,
      {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
      }
    );

    if (!fieldsResponse.ok) {
      const errorText = await fieldsResponse.text();
      console.error('Failed to fetch fields:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Contacts Book table fields' },
        { status: fieldsResponse.status }
      );
    }

    const fieldsData = await fieldsResponse.json();
    
    // Find field IDs for "Email Address" and "Material Orders"
    // Use case-insensitive matching and try multiple variations
    let emailFieldId: number | null = null;
    let materialOrdersFieldId: number | null = null;

    // Log all fields for debugging
    console.log('Available fields in Contacts Book:', fieldsData.map((f: any) => ({ 
      id: f.id, 
      label: f.label, 
      type: f.fieldType,
      baseType: f.baseType 
    })));

    // Find Email Address field - try multiple strategies
    const emailField = fieldsData.find((f: any) => 
      f.label && (
        f.label.toLowerCase() === 'email address' ||
        f.label.toLowerCase() === 'email' ||
        f.label.toLowerCase().includes('email address')
      )
    );
    
    if (emailField) {
      emailFieldId = emailField.id;
      console.log(`Found Email Address field: ID ${emailFieldId}, Label: "${emailField.label}"`);
    }

    // Find Material Orders field
    const materialOrdersField = fieldsData.find((f: any) => 
      f.label && (
        f.label.toLowerCase() === 'material orders' ||
        f.label.toLowerCase().includes('material orders') ||
        (f.label.toLowerCase().includes('material') && f.label.toLowerCase().includes('order'))
      )
    );
    
    if (materialOrdersField) {
      materialOrdersFieldId = materialOrdersField.id;
      console.log(`Found Material Orders field: ID ${materialOrdersFieldId}, Label: "${materialOrdersField.label}"`);
    }

    if (!emailFieldId) {
      const availableFields = fieldsData.map((f: any) => ({ id: f.id, label: f.label }));
      console.error('Could not find Email Address field. Available fields:', availableFields);
      return NextResponse.json(
        { 
          error: 'Could not find Email Address field in Contacts Book table',
          availableFields: availableFields
        },
        { status: 500 }
      );
    }

    if (!materialOrdersFieldId) {
      const availableFields = fieldsData.map((f: any) => ({ id: f.id, label: f.label }));
      console.error('Could not find Material Orders field. Available fields:', availableFields);
      return NextResponse.json(
        { 
          error: 'Could not find Material Orders field in Contacts Book table',
          availableFields: availableFields
        },
        { status: 500 }
      );
    }

    // Query the Contacts Book table for a record matching the email
    const queryUrl = `https://api.quickbase.com/v1/records/query`;
    
    // Build query to find record where email matches
    // QuickBase uses {[fieldId].EX.'value'} for exact match
    // Escape single quotes in email if present
    const escapedEmail = email.replace(/'/g, "''");
    const queryBody = {
      from: contactsBookTableId,
      select: [emailFieldId, materialOrdersFieldId],
      where: `{${emailFieldId}.EX.'${escapedEmail}'}`,
    };

    console.log('Querying Contacts Book with:', { email, queryBody });

    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': cleanRealmHostname,
        'Authorization': `QB-USER-TOKEN ${userToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NSI-Order-Submission/1.0',
      },
      body: JSON.stringify(queryBody),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('Failed to query Contacts Book:', errorText);
      return NextResponse.json(
        { error: 'Failed to query Contacts Book table', details: errorText },
        { status: queryResponse.status }
      );
    }

    const queryData = await queryResponse.json();

    // Check if any records were found
    if (!queryData.data || queryData.data.length === 0) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'Email not found in Contacts Book table',
      });
    }

    // Check if Material Orders checkbox is checked (true)
    const record = queryData.data[0];
    console.log('Found record:', record);
    
    // QuickBase returns field values in different formats
    // Try both .value property and direct field access
    const materialOrdersValue = record[materialOrdersFieldId]?.value ?? record[materialOrdersFieldId];

    console.log('Material Orders field value:', materialOrdersValue, 'Type:', typeof materialOrdersValue);

    // Checkbox fields in QuickBase typically return true/false, 1/0, or "1"/"0"
    const hasMaterialOrdersAccess = materialOrdersValue === true || 
                                     materialOrdersValue === 1 || 
                                     materialOrdersValue === '1' ||
                                     materialOrdersValue === 'true' ||
                                     String(materialOrdersValue).toLowerCase() === 'true';

    return NextResponse.json({
      hasAccess: hasMaterialOrdersAccess,
      reason: hasMaterialOrdersAccess 
        ? 'Access granted' 
        : 'Material Orders checkbox is not checked',
      record: {
        email: record[emailFieldId]?.value,
        materialOrders: materialOrdersValue,
      },
    });
  } catch (error) {
    console.error('Error checking user access:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while checking user access',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
