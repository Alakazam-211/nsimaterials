import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface LineItem {
  itemName: string;
  description: string;
  qty: string;
  uom: string;
}

interface OrderSubmission {
  jobNumber: string;
  reqDate: string;
  dateRequiredForDelivery: string;
  orderedBy: string;
  lineItems: LineItem[];
}

// Read config file to get table IDs
function getConfig() {
  const config: Record<string, string> = {};
  
  try {
    // Try reading from .config file
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
    const body: OrderSubmission = await request.json();
    const config = getConfig();

    // Get environment variables (support both naming conventions)
    const realmHostname = process.env.QB_REALM_HOSTNAME || process.env.QUICKBASE_REALM_HOSTNAME;
    const userToken = process.env.QB_USER_TOKEN || process.env.QUICKBASE_API_TOKEN;
    const orderSubmissionsTableId = config.ORDER_SUBMISSIONS || process.env.ORDER_SUBMISSIONS;
    const lineItemsTableId = config.ORDER_SUBMISSIONS_LINEITEMS || process.env.ORDER_SUBMISSIONS_LINEITEMS;

    // Build detailed error message
    const missingConfig: string[] = [];
    if (!realmHostname) missingConfig.push('QB_REALM_HOSTNAME (or QUICKBASE_REALM_HOSTNAME)');
    if (!userToken) missingConfig.push('QB_USER_TOKEN (or QUICKBASE_API_TOKEN)');
    if (!orderSubmissionsTableId) missingConfig.push('ORDER_SUBMISSIONS table ID');
    if (!lineItemsTableId) missingConfig.push('ORDER_SUBMISSIONS_LINEITEMS table ID');

    if (missingConfig.length > 0) {
      return NextResponse.json(
        { 
          error: `Missing required configuration: ${missingConfig.join(', ')}. Please check your .env.local file.`,
          missing: missingConfig
        },
        { status: 500 }
      );
    }

    // Format dates for QuickBase
    // Based on actual QuickBase data, date fields expect YYYY-MM-DD format (string)
    // Example from QuickBase: "2025-12-16"
    // HTML date inputs already provide dates in YYYY-MM-DD format
    const formatDateForQuickBase = (dateString: string) => {
      if (!dateString) return null;
      
      // Validate it's in YYYY-MM-DD format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateString)) {
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
      }
      
      // QuickBase date fields expect YYYY-MM-DD format as a string
      // HTML date inputs already provide this format, so return as-is
      return dateString;
    };

    // Validate input data
    if (!body.jobNumber || !body.reqDate || !body.dateRequiredForDelivery || !body.orderedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: jobNumber, reqDate, dateRequiredForDelivery, or orderedBy' },
        { status: 400 }
      );
    }

    if (!body.lineItems || body.lineItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Create Order Submission record first
    // Field IDs from QuickBase API:
    // Field 7: "Related Job" (numeric/relationship) - stores record ID from Jobs table
    // Field 8: "Job Name" (text/lookup) - read-only, displays the job name
    // Field 11: "Ordered By" (email)
    // Field 12: "Request Date" (date)
    // Field 13: "Date Required for Delivery" (date)
    const orderSubmissionData: any = {
      to: orderSubmissionsTableId,
      data: [
        {
          '7': { value: body.jobNumber }, // Related Job - relationship field storing record ID from Jobs table
          '12': { value: formatDateForQuickBase(body.reqDate) }, // Request Date
          '13': { value: formatDateForQuickBase(body.dateRequiredForDelivery) }, // Date Required for Delivery
          '11': { value: body.orderedBy }, // Ordered By (email)
        },
      ],
      fieldsToReturn: [3], // Return Record ID (field 3)
    };
    
    // Remove any null/undefined values
    Object.keys(orderSubmissionData.data[0]).forEach(key => {
      if (orderSubmissionData.data[0][key].value === null || orderSubmissionData.data[0][key].value === undefined) {
        delete orderSubmissionData.data[0][key];
      }
    });

    // Validate and clean realmHostname
    let cleanRealmHostname = realmHostname?.trim();
    if (!cleanRealmHostname) {
      return NextResponse.json(
        { error: 'QB_REALM_HOSTNAME is not set or is empty' },
        { status: 500 }
      );
    }
    
    // Remove protocol if present
    cleanRealmHostname = cleanRealmHostname.replace(/^https?:\/\//, '');
    
    // Remove trailing slash
    cleanRealmHostname = cleanRealmHostname.replace(/\/$/, '');
    
    // According to QuickBase API spec: base URL is api.quickbase.com/v1, realm goes in header
    const apiUrl = `https://api.quickbase.com/v1/records`;
    
    // Removed console.log to prevent sensitive information leakage (realmHostname, token presence)

    let orderSubmissionResponse;
    try {
      orderSubmissionResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
        body: JSON.stringify(orderSubmissionData),
      });
    } catch (fetchError) {
      // Removed console.error to prevent sensitive information leakage (realmHostname)
      // Error details are still returned in the API response for debugging
      return NextResponse.json(
        { 
          error: `Network error connecting to QuickBase: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: {
            url: apiUrl,
            realmHostname: cleanRealmHostname,
            cause: fetchError instanceof Error ? (fetchError as any).cause : undefined,
          }
        },
        { status: 500 }
      );
    }

    if (!orderSubmissionResponse.ok) {
      let errorData;
      try {
        errorData = await orderSubmissionResponse.json();
      } catch (e) {
        const errorText = await orderSubmissionResponse.text();
        console.error('QuickBase Order Submission Error (non-JSON):', errorText);
        return NextResponse.json(
          { error: `Failed to create order submission: ${errorText || 'Unknown error'}` },
          { status: orderSubmissionResponse.status }
        );
      }
      console.error('QuickBase Order Submission Error:', JSON.stringify(errorData, null, 2));
      const errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      return NextResponse.json(
        { error: `Failed to create order submission: ${errorMessage}`, details: errorData },
        { status: orderSubmissionResponse.status }
      );
    }

    const orderSubmissionResult = await orderSubmissionResponse.json();
    console.log('Order submission response:', JSON.stringify(orderSubmissionResult, null, 2));
    
    // Get the created record ID
    const orderSubmissionRecordId = orderSubmissionResult.metadata?.createdRecordIds?.[0] || 
                                    orderSubmissionResult.data?.[0]?.[3]?.value;
    
    if (!orderSubmissionRecordId) {
      console.error('Failed to get record ID from response:', orderSubmissionResult);
      return NextResponse.json(
        { error: 'Failed to get order submission record ID. Response: ' + JSON.stringify(orderSubmissionResult) },
        { status: 500 }
      );
    }

    // Create Line Items records
    // Field IDs from QuickBase API:
    // Field 6: "Related Order Submission" (numeric/relationship) - stores record ID from Order Submissions table
    // Field 8: "Item Name" (text)
    // Field 10: "Description" (text-multi-line)
    // Field 11: "QTY" (numeric)
    // Field 12: "Related UOM" (numeric/relationship) - stores record ID from UOM table
    // Field 13: "UOM" (text/lookup) - read-only, displays the UOM value
    const lineItemsData: any = {
      to: lineItemsTableId,
      data: body.lineItems.map((item) => {
        const lineItem: any = {
          '8': { value: item.itemName }, // Item Name
          '10': { value: item.description }, // Description
          '11': { value: parseFloat(item.qty) || 0 }, // QTY (as number)
          '12': { value: item.uom }, // Related UOM - relationship field storing record ID from UOM table
          '6': { value: orderSubmissionRecordId }, // Related Order Submission - relationship field storing record ID
        };
        
        // Remove any null/undefined values
        Object.keys(lineItem).forEach(key => {
          if (lineItem[key].value === null || lineItem[key].value === undefined) {
            delete lineItem[key];
          }
        });
        
        return lineItem;
      }),
      fieldsToReturn: [3],
    };

    console.log('Submitting line items to QuickBase:', {
      tableId: lineItemsTableId,
      realmHostname: cleanRealmHostname,
      data: lineItemsData,
    });

    let lineItemsResponse;
    try {
      lineItemsResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': cleanRealmHostname,
          'Authorization': `QB-USER-TOKEN ${userToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'NSI-Order-Submission/1.0',
        },
        body: JSON.stringify(lineItemsData),
      });
    } catch (fetchError) {
      console.error('Fetch error for line items:', {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        cause: fetchError instanceof Error ? (fetchError as any).cause : undefined,
        url: apiUrl,
      });
      return NextResponse.json(
        { 
          error: `Network error connecting to QuickBase for line items: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          details: {
            url: apiUrl,
            cause: fetchError instanceof Error ? (fetchError as any).cause : undefined,
          }
        },
        { status: 500 }
      );
    }

    if (!lineItemsResponse.ok) {
      let errorData;
      try {
        errorData = await lineItemsResponse.json();
      } catch (e) {
        const errorText = await lineItemsResponse.text();
        console.error('QuickBase Line Items Error (non-JSON):', errorText);
        return NextResponse.json(
          { error: `Failed to create line items: ${errorText || 'Unknown error'}` },
          { status: lineItemsResponse.status }
        );
      }
      console.error('QuickBase Line Items Error:', JSON.stringify(errorData, null, 2));
      const errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      return NextResponse.json(
        { error: `Failed to create line items: ${errorMessage}`, details: errorData },
        { status: lineItemsResponse.status }
      );
    }

    const lineItemsResult = await lineItemsResponse.json();

    return NextResponse.json({
      success: true,
      orderSubmissionId: orderSubmissionRecordId,
      lineItemsCreated: lineItemsResult.metadata?.createdRecordIds?.length || 0,
    });
  } catch (error) {
    console.error('Error submitting order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `An error occurred while submitting the order: ${errorMessage}`, details: error instanceof Error ? error.stack : String(error) },
      { status: 500 }
    );
  }
}

