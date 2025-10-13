# Convex Auth Implementation Checklist

Based on https://labs.convex.dev/auth/setup and https://labs.convex.dev/auth/config/passwords

## Setup Checklist

### Required Setup Steps

- [x] **Install NPM library**: `@convex-dev/auth` and `@auth/core@0.37.0` installed
  - ✅ Verified in `package.json`

- [x] **Add authentication tables to schema**
  - ✅ `convex/schema.ts` has `...authTables` spread
  - ✅ Includes: users, sessions, accounts, refreshTokens, verificationCodes, verifiers

- [x] **Set up React provider**
  - ✅ `ConvexAuthProvider` wraps app in `src/router.tsx`
  - ✅ Uses `convexQueryClient.convexClient` as client

- [x] **Configure HTTP routes** 
  - ✅ `convex/http.ts` created with `auth.addHttpRoutes(http)`

- [x] **Configure Password provider**
  - ✅ `convex/auth.ts` exports `{ auth, signIn, signOut, store }` from `convexAuth()`
  - ✅ Password provider configured in providers array

- [x] **Set JWT_PRIVATE_KEY environment variable**
  - ✅ Set via `npx convex env set JWT_PRIVATE_KEY`
  - ✅ Proper PKCS#8 formatted RSA private key

### Frontend Implementation

- [x] **Sign-in form created**
  - ✅ `src/routes/sign-in.tsx` with email/password fields
  - ✅ Uses `useAuthActions()` hook
  - ✅ Calls `signIn('password', formData)` with `flow: 'signIn'`

- [x] **Sign-up form created**
  - ✅ `src/routes/sign-up.tsx` with email/password fields
  - ✅ Uses `signIn('password', formData)` with `flow: 'signUp'`

- [x] **Route protection implemented**
  - ✅ `src/routes/__root.tsx` uses `useConvexAuth()` hook
  - ✅ Redirects unauthenticated users to `/sign-in`
  - ✅ Redirects authenticated users away from auth pages

- [x] **Sign-out functionality**
  - ✅ User menu has sign-out button
  - ✅ Calls `signOut()` and redirects to sign-in

## Current Issue

**Symptom**: Sign-in succeeds (Convex logs show success), but page doesn't redirect to dashboard.

**Debug logging added**:
- Sign-in page: Logs attempt, result, and redirect action
- Root component: Logs auth state changes and redirect decisions

**Next step**: Check browser console logs when signing in to see:
1. What `signIn()` returns
2. If `window.location.href = '/'` executes
3. What `useConvexAuth()` reports for `isAuthenticated` and `isLoading`

## Differences from Standard Setup

We're using **TanStack Start** (SSR framework) instead of standard React (Vite):
- Router wraps ConvexAuthProvider (not main.tsx)
- Using TanStack Router for navigation
- May need special handling for SSR vs client-side auth

## Verification Steps

Run these in order:

1. **Check Convex deployment**:
   ```bash
   npx convex env list
   ```
   Should show JWT_PRIVATE_KEY

2. **Verify http.ts is deployed**:
   Check Convex dashboard Functions tab for auth-related HTTP routes

3. **Test sign-in with console open**:
   - Open DevTools Console
   - Attempt sign-in
   - Look for our debug logs
   - Check Network tab for HTTP requests to Convex

4. **Check auth state**:
   - After sign-in, check console for "Auth state: { isAuthenticated: true, ... }"
   - If isAuthenticated stays false, there's an issue with session propagation

