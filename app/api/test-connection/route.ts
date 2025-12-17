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
    const orderSubmissionsTableId = config.ORDER_SUBMISSIONS || process.env.ORDER_SUBMISSIONS;
    const lineItemsTableId = config.ORDER_SUBMISSIONS_LINEITEMS || process.env.ORDER_SUBMISSIONS_LINEITEMS;

    // Clean realmHostname
    let cleanRealmHostname = realmHostname?.trim() || '';
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');
    
    // According to QuickBase API spec: base URL is api.quickbase.com/v1, realm goes in header
    const apiUrl = `https://api.quickbase.com/v1/tables/${orderSubmissionsTableId}/fields`;

    const diagnostics = {
      config: {
        realmHostname: {
          raw: realmHostname,
          cleaned: cleanRealmHostname,
          present: !!realmHostname,
        },
        userToken: {
          present: !!userToken,
          length: userToken?.length || 0,
          preview: userToken ? `${userToken.substring(0, 10)}...` : 'not set',
        },
        orderSubmissionsTableId: {
          value: orderSubmissionsTableId,
          present: !!orderSubmissionsTableId,
        },
        lineItemsTableId: {
          value: lineItemsTableId,
          present: !!lineItemsTableId,
        },
      },
      apiUrl,
    };

    // Try to make a test request
    if (cleanRealmHostname && userToken && orderSubmissionsTableId) {
      try {
        const testResponse = await fetch(`https://api.quickbase.com/v1/tables/${orderSubmissionsTableId}/fields`, {
          method: 'GET',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'NSI-Order-Submission/1.0',
          },
        });

        if (testResponse.ok) {
          const testData = await testResponse.json();
          return NextResponse.json({
            success: true,
            message: 'Connection successful!',
            diagnostics,
            testResponse: {
              status: testResponse.status,
              fieldCount: Array.isArray(testData) ? testData.length : 'unknown',
            },
          });
        } else {
          const errorText = await testResponse.text();
          return NextResponse.json({
            success: false,
            message: 'Connection failed',
            diagnostics,
            error: {
              status: testResponse.status,
              statusText: testResponse.statusText,
              body: errorText,
            },
          });
        }
      } catch (fetchError) {
        return NextResponse.json({
          success: false,
          message: 'Network error',
          diagnostics,
          error: {
            message: fetchError instanceof Error ? fetchError.message : String(fetchError),
            cause: fetchError instanceof Error ? (fetchError as any).cause : undefined,
            stack: fetchError instanceof Error ? fetchError.stack : undefined,
          },
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Configuration incomplete',
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error running diagnostics',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

