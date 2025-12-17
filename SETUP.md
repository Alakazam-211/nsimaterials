# Setup Instructions

## Prerequisites

- Node.js 18+ installed
- QuickBase account with API access
- QuickBase User Token

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# QuickBase Configuration
QB_REALM_HOSTNAME=your-realm.quickbase.com
QB_USER_TOKEN=your-quickbase-user-token

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=montimber-vendor-invoic-0tkxoy.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=montimber-vendor-invoic-0tkxoy.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**How to get your Firebase Configuration:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **Nelson Specialty Industrial** (montimber-vendor-invoic-0tkxoy)
3. Click on the gear icon ⚙️ next to "Project Overview" and select "Project settings"
4. Scroll down to "Your apps" section
5. If you don't have a web app, click "Add app" and select the web icon (</>)
6. Copy the configuration values:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (should be `montimber-vendor-invoic-0tkxoy.firebaseapp.com`)
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (should be `montimber-vendor-invoic-0tkxoy.appspot.com`)
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

**How to get your QuickBase User Token:**
1. Log into QuickBase
2. Go to your profile/account settings
3. Navigate to "Manage User Tokens"
4. Create a new token or use an existing one

## Step 3: Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **Nelson Specialty Industrial**
3. Navigate to "Authentication" in the left sidebar
4. Click "Get started" if you haven't enabled it yet
5. Go to the "Sign-in method" tab
6. Click on "Email/Password"
7. Enable "Email/Password" authentication
8. Click "Save"

**Create a test user:**
1. In the Authentication section, go to the "Users" tab
2. Click "Add user"
3. Enter an email and password
4. Click "Add user"

## Step 4: Verify Table IDs

The table IDs are already configured in `.config`:
- `ORDER_SUBMISSIONS=bvnwdbix3`
- `ORDER_SUBMISSIONS_LINEITEMS=bvnwdfgje`

You can also set these in `.env.local` if needed:
```env
ORDER_SUBMISSIONS=bvnwdbix3
ORDER_SUBMISSIONS_LINEITEMS=bvnwdfgje
```

## Step 5: Update Field IDs

**CRITICAL**: You must update the field IDs in `app/api/submit-order/route.ts` to match your QuickBase table structure.

See `FIELD_MAPPING.md` for detailed instructions on how to find and update field IDs.

## Step 6: Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3002`

## Testing

1. Open `http://localhost:3002` in your browser
2. You will be redirected to the login page if not authenticated
3. Sign in with the email and password you created in Firebase
4. Once authenticated, fill out the order submission form:
   - Enter a job number
   - Select dates
   - Enter your email
   - Add at least one line item
3. Click "Submit Order"
4. Check your QuickBase tables to verify the data was created correctly

## Troubleshooting

### Error: "Missing required configuration"
- Make sure `.env.local` exists and contains all required environment variables
- Verify the values are correct (no extra spaces or quotes)
- For Firebase errors, ensure all `NEXT_PUBLIC_FIREBASE_*` variables are set correctly

### Error: "Firebase: Error (auth/configuration-not-found)"
- Make sure all Firebase environment variables are set in `.env.local`
- Restart your development server after adding environment variables
- Verify the Firebase project ID matches: `montimber-vendor-invoic-0tkxoy`

### Error: "Firebase: Error (auth/user-not-found)" or "Firebase: Error (auth/wrong-password)"
- Make sure you've created a user in Firebase Authentication console
- Verify the email and password are correct
- Check that Email/Password authentication is enabled in Firebase Console

### Error: "Failed to create order submission"
- Check that your QuickBase User Token has permissions to create records in both tables
- Verify the table IDs are correct
- Check that the field IDs match your QuickBase table structure

### Data not appearing in QuickBase
- Verify field IDs are correct
- Check field types match (dates, numbers, text, etc.)
- Ensure the relationship field ID is correct for linking line items to orders

## Next Steps

1. Update field IDs in the API route
2. Test with a sample order
3. Customize the UI if needed
4. Deploy to Vercel (see deployment section in README)


