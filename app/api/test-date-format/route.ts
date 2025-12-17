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
    const orderSubmissionsTableId = config.ORDER_SUBMISSIONS;

    if (!realmHostname || !userToken || !orderSubmissionsTableId) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
    }

    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    // Query records to see what format dates are returned in
    const queryUrl = `https://api.quickbase.com/v1/records/query`;
    const queryBody = {
      from: orderSubmissionsTableId,
      select: [3, 7, 11, 12, 13], // Record ID, Related Job, Ordered By, Request Date, Date Required for Delivery
      // No top limit - get all records to see date format
    };

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': cleanRealmHostname,
        'Authorization': `QB-USER-TOKEN ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: `Failed to query: ${response.status}`,
        details: errorText.substring(0, 500),
        url: queryUrl,
        body: queryBody,
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      rawData: data,
      sampleRecords: data.data || [],
      recordCount: data.data?.length || 0,
      dateFormats: (data.data || []).map((record: any) => ({
        recordId: record[3]?.value,
        requestDate: record[12]?.value,
        requestDateRaw: record[12],
        requestDateType: typeof record[12]?.value,
        deliveryDate: record[13]?.value,
        deliveryDateRaw: record[13],
        deliveryDateType: typeof record[13]?.value,
        fullRecord: record, // Include full record for debugging
      })),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

