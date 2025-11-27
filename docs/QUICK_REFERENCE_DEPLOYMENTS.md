# Convex Deployments - Quick Reference

## Initial Setup (One-Time)
```bash
npm run setup:deployments
source ~/.zshrc
```

## Daily Usage

### Development (Default)
```bash
npm run dev
```
Uses your dev deployment. Safe for testing and development.

### Production Testing
```bash
npm run dev:prod
```
⚠️ Uses your production deployment. Be careful with data changes!

## Manual Switching
```bash
npm run switch:dev    # Switch to dev
npm run switch:prod   # Switch to prod
```

## Check Current Deployment
```bash
cat .env.local | grep VITE_CONVEX_URL
```

## View All Deployments
```bash
npx convex deployments
```

## Create Production Deployment
```bash
npx convex deploy --prod
```

## Environment Variables
- `$CONVEX_URL_DEV` - Your dev deployment URL
- `$CONVEX_URL_PROD` - Your production deployment URL

## File Locations
- Config: `~/.convex-deployments-mydashboard`
- Scripts: `scripts/setup-deployments.sh`, `scripts/switch-deployment.sh`
- Docs: `docs/CONVEX_DEPLOYMENTS.md`

## Troubleshooting

**Error: "CONVEX_URL_PROD not set"**
```bash
npm run setup:deployments
source ~/.zshrc
```

**Changes not syncing**
- Make sure you're running the right command (`dev` vs `dev:prod`)
- Restart the dev server

**Environment variables not available in new terminal**
```bash
source ~/.zshrc
```







