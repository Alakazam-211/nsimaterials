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
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');
    
    if (!tableId) {
      return NextResponse.json(
        { error: 'tableId query parameter is required' },
        { status: 400 }
      );
    }

    const config = getConfig();
    const realmHostname = process.env.QB_REALM_HOSTNAME || process.env.QUICKBASE_REALM_HOSTNAME;
    const userToken = process.env.QB_USER_TOKEN || process.env.QUICKBASE_API_TOKEN;

    if (!realmHostname || !userToken) {
      return NextResponse.json(
        { error: 'Missing QB_REALM_HOSTNAME or QB_USER_TOKEN environment variables' },
        { status: 500 }
      );
    }

    // Fetch table fields from QuickBase API
    // According to QuickBase API spec: /fields endpoint uses tableId as query parameter
    const fieldsResponse = await fetch(
      `https://api.quickbase.com/v1/fields?tableId=${tableId}`,
      {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': realmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
      }
    );

    if (!fieldsResponse.ok) {
      let errorData;
      try {
        errorData = await fieldsResponse.json();
      } catch (e) {
        const errorText = await fieldsResponse.text();
        return NextResponse.json(
          { error: `Failed to fetch fields: ${errorText}` },
          { status: fieldsResponse.status }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch fields: ${errorData.message || JSON.stringify(errorData)}` },
        { status: fieldsResponse.status }
      );
    }

    const fieldsData = await fieldsResponse.json();
    
    // Format fields for easier reading
    const formattedFields = fieldsData.map((field: any) => ({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      baseType: field.baseType,
      properties: field.properties,
    }));

    return NextResponse.json({
      success: true,
      tableId,
      fields: formattedFields,
      raw: fieldsData,
    });
  } catch (error) {
    console.error('Error fetching table fields:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `An error occurred: ${errorMessage}` },
      { status: 500 }
    );
  }
}

