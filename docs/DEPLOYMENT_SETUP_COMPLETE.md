# ✅ Convex Deployment Setup - Complete

Your project is now configured to easily switch between Convex dev and production deployments!

## What Was Set Up

### 1. Scripts Created
- **`scripts/setup-deployments.sh`** - Automated setup that detects your deployments and configures environment variables
- **`scripts/switch-deployment.sh`** - Quick switcher to manually change deployments

### 2. npm Commands Added
```json
{
  "dev": "...",                    // Use dev deployment (default)
  "dev:prod": "...",               // Use production deployment
  "setup:deployments": "...",      // Run setup (one-time)
  "switch:dev": "...",             // Switch to dev
  "switch:prod": "..."             // Switch to prod
}
```

### 3. Documentation Created
- **`docs/CONVEX_DEPLOYMENTS.md`** - Full guide with troubleshooting
- **`docs/QUICK_REFERENCE_DEPLOYMENTS.md`** - Quick reference card
- **`README.md`** - Updated with deployment info

### 4. Environment Configuration
- Creates `~/.convex-deployments-mydashboard` with your deployment URLs
- Can be sourced in `~/.zshrc` for automatic loading

## How to Use

### Initial Setup (First Time Only)

1. **Run the setup script:**
   ```bash
   npm run setup:deployments
   ```
   This will:
   - Detect your current Convex deployment(s)
   - Create a config file with your URLs
   - Prompt to add to your `~/.zshrc` (recommended: yes)

2. **Reload your shell:**
   ```bash
   source ~/.zshrc
   ```
   Or close and reopen your terminal.

3. **Optional: Create a production deployment** (if you don't have one):
   ```bash
   npx convex deploy --prod
   ```
   Then re-run setup:
   ```bash
   npm run setup:deployments
   source ~/.zshrc
   ```

### Daily Development

**Method 1: Use Different Commands (Recommended)**

```bash
# Regular development (uses dev deployment)
npm run dev

# Test against production data
npm run dev:prod
```

**Method 2: Manual Switching**

```bash
# Switch to dev
npm run switch:dev
npm run dev

# Switch to prod
npm run switch:prod
npm run dev
```

## Quick Start Commands

```bash
# Check what you currently have
npx convex deployments
cat .env.local | grep VITE_CONVEX_URL

# First-time setup
npm run setup:deployments
source ~/.zshrc

# Daily use
npm run dev          # Dev deployment
npm run dev:prod     # Production deployment
```

## File Structure

```
mydashboard/
├── scripts/
│   ├── setup-deployments.sh        # Setup script
│   └── switch-deployment.sh        # Switcher script
├── docs/
│   ├── CONVEX_DEPLOYMENTS.md       # Full guide
│   ├── QUICK_REFERENCE_DEPLOYMENTS.md  # Quick ref
│   └── DEPLOYMENT_SETUP_COMPLETE.md    # This file
├── package.json                     # Updated with new commands
└── ~/.convex-deployments-mydashboard  # Your config (in home dir)
```

## Environment Variables

After setup, these will be available in your shell:

```bash
$CONVEX_URL_DEV   # Your dev deployment URL
$CONVEX_URL_PROD  # Your production deployment URL
```

Check them with:
```bash
echo $CONVEX_URL_DEV
echo $CONVEX_URL_PROD
```

## Safety & Best Practices

### ✅ Safe - Regular Development
```bash
npm run dev
```
- Uses dev deployment
- Safe to experiment
- No impact on production data

### ⚠️ Use Carefully - Production Testing
```bash
npm run dev:prod
```
- Connects to production database
- Any mutations affect live data
- Schema changes apply to production
- **Only use for debugging production issues**

### 🎯 Recommended Workflow

1. **Daily work** → Use `npm run dev` (dev deployment)
2. **Test features** → Test thoroughly in dev
3. **Deploy to prod** → Use CI/CD or `npx convex deploy --prod`
4. **Debug prod issues** → Use `npm run dev:prod` only when needed

## Troubleshooting

### Environment Variables Not Found

```bash
# Re-run setup
npm run setup:deployments

# Reload shell
source ~/.zshrc

# Check if configured
cat ~/.convex-deployments-mydashboard
```

### New Terminal Session Doesn't Have Variables

```bash
# Quick fix
source ~/.zshrc

# Permanent fix: Verify this line is in ~/.zshrc
source ~/.convex-deployments-mydashboard
```

### Don't Have a Production Deployment Yet

```bash
# Create one
npx convex deploy --prod

# Re-run setup to detect it
npm run setup:deployments
source ~/.zshrc
```

### Want to Check Current Deployment

```bash
# Check .env.local
cat .env.local | grep VITE_CONVEX_URL

# List all deployments
npx convex deployments
```

## Next Steps

1. ✅ Run `npm run setup:deployments` to configure everything
2. ✅ Try `npm run dev` to verify dev deployment works
3. ✅ (Optional) Create production deployment with `npx convex deploy --prod`
4. ✅ (Optional) Test production with `npm run dev:prod`

## Questions?

- **Full guide**: `docs/CONVEX_DEPLOYMENTS.md`
- **Quick reference**: `docs/QUICK_REFERENCE_DEPLOYMENTS.md`
- **Convex docs**: https://docs.convex.dev/production/hosting/deployments

---

**You're all set!** 🎉

Run `npm run setup:deployments` to get started.







