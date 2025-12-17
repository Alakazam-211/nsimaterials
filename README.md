# NSI Order Submission

A Next.js application for submitting orders to QuickBase with a beautiful glassmorphic UI.

## Features

- Glassmorphic design system
- Order submission form with:
  - Job number
  - Req Date
  - Date Required For Delivery
  - Ordered By (email)
  - Multiple line items (Item Name, Description, Qty, UOM)
- QuickBase integration
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your QuickBase credentials:
     - `QB_REALM_HOSTNAME`: Your QuickBase realm hostname (e.g., `demo.quickbase.com`)
     - `QB_USER_TOKEN`: Your QuickBase user token

3. Configure table IDs:
   - Table IDs can be set in `.config` file or `.env.local`
   - The `.config` file already contains:
     - `ORDER_SUBMISSIONS=bvnwdbix3`
     - `ORDER_SUBMISSIONS_LINEITEMS=bvnwdfgje`

4. Update field IDs in API route:
   - Open `app/api/submit-order/route.ts`
   - Update the field IDs to match your QuickBase table structure
   - You may need to query your QuickBase table schema to get the correct field IDs

## Running the Application

```bash
npm run dev
```

The application will run on `http://localhost:3002`

## QuickBase Field Mapping

**Important**: You need to update the field IDs in `app/api/submit-order/route.ts` to match your QuickBase table structure.

### Order Submissions Table
- Field ID for Job Number (currently set to 6)
- Field ID for Req Date (currently set to 8)
- Field ID for Date Required For Delivery (currently set to 9)
- Field ID for Ordered By (currently set to 11)

### Order Submissions Line Items Table
- Field ID for Item Name (currently set to 6)
- Field ID for Description (currently set to 7)
- Field ID for Qty (currently set to 8)
- Field ID for UOM (currently set to 9)
- Field ID for Related Order Submission (currently set to 10)

To find your field IDs:
1. Go to your QuickBase table
2. Click on a field
3. Look at the URL - it will contain the field ID
4. Or use the QuickBase API to query the table schema

## Project Structure

```
├── app/
│   ├── api/
│   │   └── submit-order/
│   │       └── route.ts          # API route for submitting orders
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   ├── GlassButton.tsx           # Glassmorphic button component
│   ├── GlassCard.tsx             # Glassmorphic card component
│   └── OrderSubmissionForm.tsx   # Order submission form
├── config/
│   └── colors.ts                 # Color configuration
├── styles/
│   └── glassmorphic.css          # Glassmorphic styles
└── .config                       # Table IDs configuration
```

## Technologies Used

- Next.js 14
- TypeScript
- React
- Framer Motion
- QuickBase REST API


