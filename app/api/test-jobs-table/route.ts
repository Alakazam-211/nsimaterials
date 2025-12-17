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
    const jobsTableId = config.JOBS_TABLE || process.env.JOBS_TABLE || 'buy4q98bb';

    if (!realmHostname || !userToken) {
      return NextResponse.json({
        error: 'Missing environment variables',
        realmHostname: !!realmHostname,
        userToken: !!userToken,
      }, { status: 500 });
    }

    let cleanRealmHostname = realmHostname.trim();
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');

    const results: any = {
      tableId: jobsTableId,
      realmHostname: cleanRealmHostname,
      tests: [],
    };

    // Test 1: Try /api/v1/tables/{tableId}/fields
    const test1Url = `https://api.quickbase.com/v1/tables/${jobsTableId}/fields`;
    try {
      const response = await fetch(test1Url, {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
        },
      });
      results.tests.push({
        name: 'GET /api/v1/tables/{id}/fields',
        url: test1Url,
        status: response.status,
        ok: response.ok,
        error: response.ok ? null : await response.text().catch(() => 'Could not read error'),
      });
    } catch (e) {
      results.tests.push({
        name: 'GET /api/v1/tables/{id}/fields',
        url: test1Url,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Test 2: Try /api/v1/db/{tableId}/fields (alternative format)
    const test2Url = `https://api.quickbase.com/v1/db/${jobsTableId}/fields`;
    try {
      const response = await fetch(test2Url, {
        method: 'GET',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
        },
      });
      results.tests.push({
        name: 'GET /api/v1/db/{id}/fields',
        url: test2Url,
        status: response.status,
        ok: response.ok,
        error: response.ok ? null : await response.text().catch(() => 'Could not read error'),
      });
    } catch (e) {
      results.tests.push({
        name: 'GET /api/v1/db/{id}/fields',
        url: test2Url,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Test 3: Try querying records
    const test3Url = `https://api.quickbase.com/v1/records/query`;
    try {
      const response = await fetch(test3Url, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: jobsTableId,
          select: [3, 6, 7, 8],
        }),
      });
      const responseText = await response.text();
      results.tests.push({
        name: 'POST /api/v1/records/query',
        url: test3Url,
        status: response.status,
        ok: response.ok,
        data: response.ok ? JSON.parse(responseText) : null,
        error: response.ok ? null : responseText.substring(0, 500),
      });
    } catch (e) {
      results.tests.push({
        name: 'POST /api/v1/records/query',
        url: test3Url,
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

