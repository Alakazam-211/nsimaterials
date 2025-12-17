import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const orderSubmissionsTableId = config.ORDER_SUBMISSIONS || process.env.ORDER_SUBMISSIONS;
    const lineItemsTableId = config.ORDER_SUBMISSIONS_LINEITEMS || process.env.ORDER_SUBMISSIONS_LINEITEMS;

    if (!realmHostname || !userToken) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    const results: any = {
      orderSubmissionsTable: orderSubmissionsTableId,
      lineItemsTable: lineItemsTableId,
      fields: {},
    };

    // Get Order Submissions table fields
    // According to QuickBase API: /fields endpoint uses tableId as query parameter
    if (orderSubmissionsTableId) {
      try {
        const response = await fetch(`https://api.quickbase.com/v1/fields?tableId=${orderSubmissionsTableId}`, {
          method: 'GET',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const fieldsData = await response.json();
          results.fields.orderSubmissions = fieldsData.map((field: any) => ({
            id: field.id,
            label: field.label,
            fieldType: field.fieldType,
            baseType: field.baseType,
            isReadOnly: field.properties?.readOnly || false,
            isLookup: field.fieldType === 'lookup' || field.baseType === 'lookup',
            isRelationship: field.fieldType === 'recordlink' || field.baseType === 'recordlink',
            properties: field.properties, // Include full properties for debugging
          }));
        } else {
          results.fields.orderSubmissions = { error: `Failed: ${response.status} ${response.statusText}` };
        }
      } catch (e) {
        results.fields.orderSubmissions = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    // Get Line Items table fields
    // According to QuickBase API: /fields endpoint uses tableId as query parameter
    if (lineItemsTableId) {
      try {
        const response = await fetch(`https://api.quickbase.com/v1/fields?tableId=${lineItemsTableId}`, {
          method: 'GET',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const fieldsData = await response.json();
          results.fields.lineItems = fieldsData.map((field: any) => ({
            id: field.id,
            label: field.label,
            fieldType: field.fieldType,
            baseType: field.baseType,
            isReadOnly: field.properties?.readOnly || false,
            isLookup: field.fieldType === 'lookup' || field.baseType === 'lookup',
            isRelationship: field.fieldType === 'recordlink' || field.baseType === 'recordlink',
          }));
        } else {
          results.fields.lineItems = { error: `Failed: ${response.status} ${response.statusText}` };
        }
      } catch (e) {
        results.fields.lineItems = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

