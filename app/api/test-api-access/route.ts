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
    
    if (!realmHostname || !userToken) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    const results: any = {
      realmHostname: cleanRealmHostname,
      tests: [],
    };

    // Test 1: Try querying ORDER_SUBMISSIONS table (known to work)
    const orderSubmissionsTableId = config.ORDER_SUBMISSIONS;
    if (orderSubmissionsTableId) {
      try {
        const response = await fetch(`https://api.quickbase.com/v1/records/query`, {
          method: 'POST',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: orderSubmissionsTableId,
            select: [3],
          }),
        });
        results.tests.push({
          name: 'Query ORDER_SUBMISSIONS table',
          tableId: orderSubmissionsTableId,
          status: response.status,
          ok: response.ok,
          works: response.ok,
        });
      } catch (e) {
        results.tests.push({
          name: 'Query ORDER_SUBMISSIONS table',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Test 2: Try querying JOBS table
    const jobsTableId = config.JOBS_TABLE || 'buy4q98bb';
    try {
      const response = await fetch(`https://api.quickbase.com/v1/records/query`, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: jobsTableId,
          select: [3],
        }),
      });
      const responseText = await response.text();
      results.tests.push({
        name: 'Query JOBS table',
        tableId: jobsTableId,
        status: response.status,
        ok: response.ok,
        works: response.ok,
        errorPreview: response.ok ? null : responseText.substring(0, 300),
      });
    } catch (e) {
      results.tests.push({
        name: 'Query JOBS table',
        tableId: jobsTableId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Test 3: Try getting app info
    const appId = config.CFED_APP;
    if (appId) {
      try {
        const response = await fetch(`https://api.quickbase.com/v1/apps/${appId}`, {
          method: 'GET',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
          },
        });
        let responseData = null;
        if (response.ok) {
          try {
            responseData = await response.json();
          } catch (e) {
            responseData = await response.text();
          }
        } else {
          responseData = await response.text();
        }
        results.tests.push({
          name: 'Get app info',
          appId: appId,
          status: response.status,
          ok: response.ok,
          data: responseData,
        });
      } catch (e) {
        results.tests.push({
          name: 'Get app info',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Test 4: Try listing tables in the app
    if (appId) {
      try {
        const response = await fetch(`https://api.quickbase.com/v1/apps/${appId}/tables`, {
          method: 'GET',
          headers: {
            'QB-Realm-Hostname': cleanRealmHostname,
            'Authorization': `QB-USER-TOKEN ${userToken}`,
            'Content-Type': 'application/json',
          },
        });
        let responseData = null;
        if (response.ok) {
          try {
            responseData = await response.json();
          } catch (e) {
            responseData = await response.text();
          }
        } else {
          responseData = await response.text();
        }
        results.tests.push({
          name: 'List tables in app',
          appId: appId,
          status: response.status,
          ok: response.ok,
          data: responseData,
        });
      } catch (e) {
        results.tests.push({
          name: 'List tables in app',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Test 5: Try getting user info to verify token
    try {
      const response = await fetch(`https://api.quickbase.com/v1/users/current`, {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
        },
      });
      let responseData = null;
      if (response.ok) {
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }
      results.tests.push({
        name: 'Get current user (verify token)',
        status: response.status,
        ok: response.ok,
        data: responseData,
      });
    } catch (e) {
      results.tests.push({
        name: 'Get current user (verify token)',
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

