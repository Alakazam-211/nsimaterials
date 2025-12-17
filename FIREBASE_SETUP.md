# Firebase Authentication Setup

This application uses Firebase Authentication to protect access to the order submission form.

## Project Information

- **Project ID**: `montimber-vendor-invoic-0tkxoy`
- **Project Name**: Nelson Specialty Industrial
- **Project Number**: `229256741798`

## Setup Complete

The following components have been set up:

1. ✅ Firebase SDK installed (`firebase` package)
2. ✅ Firebase project linked (`.firebaserc` file created)
3. ✅ Firebase configuration (`lib/firebase.ts`)
4. ✅ Authentication context (`contexts/AuthContext.tsx`)
5. ✅ Login page (`components/LoginForm.tsx`) with Google sign-in button
6. ✅ Protected route wrapper (`components/ProtectedRoute.tsx`)
7. ✅ Logout functionality added to main page
8. ✅ Google sign-in integration

## Next Steps

### 1. Get Firebase Configuration Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **Nelson Specialty Industrial**
3. Click the gear icon ⚙️ → "Project settings"
4. Scroll to "Your apps" section
5. If no web app exists, click "Add app" → select web icon (</>)
6. Copy these values to your `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=montimber-vendor-invoic-0tkxoy.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=montimber-vendor-invoic-0tkxoy.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id-here
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id-here
```

### 2. Enable Authentication Methods

1. In Firebase Console, go to **Authentication**
2. Click **Get started** (if not already enabled)
3. Go to **Sign-in method** tab

**Enable Email/Password:**
4. Click on **Email/Password**
5. Enable **Email/Password** provider
6. Click **Save**

**Enable Google Sign-In:**
7. Click on **Google**
8. Enable **Google** provider
9. Enter a project support email (your email address)
10. Click **Save**

**Configure Authorized Domains (Important for Google Sign-In):**
11. In Firebase Console → **Authentication** → **Settings** tab
12. Scroll to **Authorized domains**
13. Make sure your domain is listed (localhost should be there by default)
14. If deploying, add your production domain (e.g., `yourdomain.com`)
15. This ensures Google sign-in redirects work properly

### 3. Create Test Users

1. In Firebase Console → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter email and password
4. Click **Add user**

### 4. Test the Application

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3002`
3. You should see the login page
4. Sign in with a test user
5. You should be redirected to the order submission form
6. Click "Sign Out" to test logout

## File Structure

```
├── lib/
│   └── firebase.ts              # Firebase initialization
├── contexts/
│   └── AuthContext.tsx          # Authentication context provider
├── components/
│   ├── LoginForm.tsx             # Login page component
│   └── ProtectedRoute.tsx       # Route protection wrapper
├── app/
│   ├── layout.tsx                # Root layout (includes AuthProvider)
│   └── page.tsx                  # Main page (protected)
└── .firebaserc                   # Firebase project configuration
```

## How It Works

1. **Authentication Flow**:
   - User visits the app → redirected to login if not authenticated
   - User can sign in with:
     - **Email/Password**: Enter email and password
     - **Google**: Click "Sign in with Google" button
       - First tries popup method (better UX)
       - Falls back to redirect if popup is blocked
       - After authentication, automatically redirects to main app
   - On success → user redirected to order submission form
   - Session persists across page refreshes

2. **Protected Routes**:
   - `ProtectedRoute` component wraps protected pages
   - Checks authentication status
   - Shows login page if not authenticated
   - Shows loading state while checking auth

3. **Logout**:
   - Logout button in top-right corner of main page
   - Signs out user from Firebase
   - Redirects back to login page

## Troubleshooting

### "Firebase auth is not initialized"
- Check that all `NEXT_PUBLIC_FIREBASE_*` environment variables are set in `.env.local`
- Restart the development server after adding environment variables
- Verify values match your Firebase project settings

### "Firebase: Error (auth/configuration-not-found)"
- Ensure all required environment variables are present
- Check that the project ID matches: `montimber-vendor-invoic-0tkxoy`

### "Firebase: Error (auth/user-not-found)"
- Verify the user exists in Firebase Authentication console
- Check that Email/Password authentication is enabled

### Login page not showing
- Check browser console for errors
- Verify Firebase configuration is correct
- Ensure `AuthProvider` is wrapping the app in `app/layout.tsx`

### Google sign-in not redirecting back to app / Stuck on Firebase handler page
**If you're stuck on `firebaseapp.com/__/auth/handler`:**
1. Manually navigate to `http://localhost:3002` - you should already be signed in
2. The app now uses popup method by default to avoid this issue
3. If popup is blocked, allow popups for your site rather than using redirect

**To prevent this issue:**
- The app is configured to always use popup method (better UX, no redirect issues)
- If popup is blocked, you'll see a message asking to allow popups
- Redirect method is disabled to prevent getting stuck on Firebase pages

**Firebase Console Configuration:**
- Verify authorized domains are configured: Firebase Console → Authentication → Settings → Authorized domains
- Make sure `localhost` is in the list
- For production, add your production domain

## Security Notes

- Firebase handles all authentication securely
- Passwords are never stored in your application
- Session tokens are managed by Firebase
- Environment variables with `NEXT_PUBLIC_` prefix are exposed to the browser (this is safe for Firebase config)
