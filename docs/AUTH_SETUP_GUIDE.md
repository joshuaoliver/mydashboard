# Authentication Setup Guide

## Overview

Your dashboard now has basic authentication using Convex Auth with password-based authentication. This guide will help you create your user account and test the system.

## What's Been Implemented

### Backend (Convex)
- ✅ Convex Auth configured with Password provider (`convex/auth.ts`)
- ✅ Auth tables added to schema (`convex/schema.ts`)
- ✅ `currentUser` query to check authentication status

### Frontend
- ✅ Sign-in page at `/sign-in`
- ✅ Sign-up page at `/sign-up` (for creating your account)
- ✅ Route protection (redirects to sign-in if not authenticated)
- ✅ Sign-out functionality in user menu

## Creating Your User Account

### Step 1: Set Required Environment Variables

Convex Auth requires a JWT private key (PKCS#8 format) for signing tokens. Set it with:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -outform PEM 2>/dev/null > /tmp/jwt_key.pem && npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt_key.pem)" && rm /tmp/jwt_key.pem
```

This generates a proper RSA private key, sets it in Convex, and cleans up the temporary file. You only need to do this once per Convex deployment.

### Step 2: Start the Development Server

```bash
npm run dev
```

This will start both the Vite dev server and Convex backend.

### Step 3: Navigate to Sign-Up Page

Open your browser and go to:
```
http://localhost:5173/sign-up
```

### Step 4: Create Your Account

1. Enter your email address (can be any email you prefer)
2. Enter a strong password (minimum 8 characters)
3. Click "Create Account"

Upon successful creation, you'll be automatically signed in and redirected to the dashboard.

### Step 5: Test Sign-In

1. Click the user icon in the top-right corner
2. Click "Sign out"
3. You should be redirected to `/sign-in`
4. Enter your credentials to sign back in

## Security Features

- **Password Hashing**: Convex Auth automatically hashes passwords securely
- **Session Management**: Sessions are managed via secure tokens
- **Route Protection**: All routes except `/sign-in` and `/sign-up` require authentication
- **Auto-Redirect**: 
  - Unauthenticated users accessing protected routes → redirected to sign-in
  - Authenticated users accessing auth pages → redirected to dashboard

## Single-User Mode

This is currently set up for single-user use. If you want to keep it that way:

### Option 1: Delete the Sign-Up Page (Recommended)

After creating your account, you can delete the sign-up route:

```bash
rm src/routes/sign-up.tsx
npx tsr generate
```

### Option 2: Disable Sign-Up in Convex

Alternatively, you can disable the sign-up flow in the backend while keeping the page for reference.

## Managing Your Account

### Changing Your Password

Currently, password reset isn't implemented. To change your password:

1. Access the Convex dashboard: https://dashboard.convex.dev
2. Navigate to your project
3. Go to the "Data" tab
4. Find the `users` table
5. You can manage user data there (though password changes would need custom mutation)

### Adding Password Reset (Optional)

If you want password reset functionality, you can add it by:
1. Implementing a password reset mutation in `convex/auth.ts`
2. Creating a password reset form page
3. Using email to send reset links (requires email configuration)

## Troubleshooting

### "Missing environment variable JWT_PRIVATE_KEY" Error
- Run: `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -outform PEM 2>/dev/null > /tmp/jwt_key.pem && npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt_key.pem)" && rm /tmp/jwt_key.pem`
- This generates a PKCS#8 formatted RSA key required for JWT signing
- You only need to do this once per Convex deployment (dev/prod)

### "pkcs8 must be PKCS#8 formatted string" Error
- This means the JWT_PRIVATE_KEY is not in the correct format
- Re-run the command above to generate a proper PKCS#8 formatted RSA key

### "Sign in failed" Error
- Check that your credentials are correct
- Verify Convex is running (`npm run dev` shows Convex connected)
- Check browser console for detailed errors

### Redirects Not Working
- Ensure the route tree is generated: `npx tsr generate`
- Clear browser cache and cookies
- Check that `VITE_CONVEX_URL` is set correctly

### Can't Access Any Pages
- Open browser dev tools (F12)
- Check Network tab for failed requests
- Verify Convex backend is running and connected

## Next Steps

Now that authentication is set up, you can:

1. **Customize the Sign-In Page**: Add your branding, logo, or styling
2. **Add User Profile**: Create a settings page to view/edit profile
3. **Implement Remember Me**: Add persistent login options
4. **Add OAuth** (optional): Configure GitHub, Google, or other OAuth providers
5. **Delete Sign-Up Route**: After creating your account, remove the sign-up page

## File Reference

**Backend:**
- `convex/auth.ts` - Auth configuration and currentUser query
- `convex/schema.ts` - Database schema with auth tables

**Frontend:**
- `src/routes/sign-in.tsx` - Sign-in page
- `src/routes/sign-up.tsx` - Sign-up page (can be deleted after setup)
- `src/routes/__root.tsx` - Route protection logic
- `src/components/layout/dashboard-layout.tsx` - Sign-out functionality

## Support

If you encounter any issues:
1. Check the Convex Auth documentation: https://labs.convex.dev/auth
2. Review Convex logs in the terminal
3. Check browser console for client-side errors
4. Verify all dependencies are installed: `npm install`

