# QuickBase Field Mapping Guide

## Important: Update Field IDs

The API route (`app/api/submit-order/route.ts`) uses placeholder field IDs that need to be updated to match your QuickBase table structure.

## How to Find Field IDs

### Method 1: From QuickBase UI
1. Go to your QuickBase table
2. Click on a field name
3. Look at the URL - it will contain the field ID
4. Example: `https://your-realm.quickbase.com/db/abc123?a=dt&fid=6` - Field ID is `6`

### Method 2: Using QuickBase API
Query your table schema using the QuickBase API:

```bash
curl -X GET "https://your-realm.quickbase.com/api/v1/tables/{table-id}/fields" \
  -H "QB-Realm-Hostname: your-realm.quickbase.com" \
  -H "Authorization: QB-USER-TOKEN your-token"
```

## Field Mapping

### Order Submissions Table (`ORDER_SUBMISSIONS`)

Update these field IDs in `app/api/submit-order/route.ts`:

```typescript
'6': { value: body.jobNumber }, // ← Update this field ID for Job Number
'8': { value: formatDateForQuickBase(body.reqDate) }, // ← Update this field ID for Req Date
'9': { value: formatDateForQuickBase(body.dateRequiredForDelivery) }, // ← Update this field ID for Date Required For Delivery
'11': { value: body.orderedBy }, // ← Update this field ID for Ordered By (email)
```

### Order Submissions Line Items Table (`ORDER_SUBMISSIONS_LINEITEMS`)

Update these field IDs in `app/api/submit-order/route.ts`:

```typescript
'6': { value: item.itemName }, // ← Update this field ID for Item Name
'7': { value: item.description }, // ← Update this field ID for Description
'8': { value: parseFloat(item.qty) || 0 }, // ← Update this field ID for Qty
'9': { value: item.uom }, // ← Update this field ID for UOM
'10': { value: orderSubmissionRecordId }, // ← Update this field ID for Related Order Submission (relationship field)
```

## Field Types

Make sure the field types match:
- **Job Number**: Text field
- **Req Date**: Date field
- **Date Required For Delivery**: Date field
- **Ordered By**: Email or Text field
- **Item Name**: Text field
- **Description**: Text field
- **Qty**: Number field
- **UOM**: Text field
- **Related Order Submission**: Relationship/Lookup field pointing to Order Submissions table

## Testing

After updating the field IDs:
1. Test with a simple order submission
2. Check QuickBase to verify the data was created correctly
3. Verify the relationship between Order Submission and Line Items is working


