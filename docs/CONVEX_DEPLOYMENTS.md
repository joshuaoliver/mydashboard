# Convex Deployment Management

This guide explains how to work with multiple Convex deployments (dev and production) on your local machine.

## Quick Start

### Initial Setup (One-Time)

Run the setup script to configure your environment:

```bash
npm run setup:deployments
```

This will:
1. Detect your Convex deployment URLs
2. Create a configuration file with your deployment URLs
3. Optionally add the configuration to your `~/.zshrc`

After setup, reload your shell:

```bash
source ~/.zshrc
```

## Usage

### Method 1: Using Different npm Commands (Recommended)

Simply run different commands based on which deployment you want to use:

```bash
# Use dev deployment (default)
npm run dev

# Use production deployment
npm run dev:prod
```

The `dev:prod` command will:
- Connect to your production Convex deployment
- Watch for changes and sync them to production
- Run your local web server pointing to production data

### Method 2: Manual Switching

You can also manually switch between deployments using helper scripts:

```bash
# Switch to dev deployment
npm run switch:dev

# Switch to prod deployment
npm run switch:prod
```

These scripts update your `.env.local` file with the appropriate deployment URL.

## Understanding the Setup

### Environment Variables

The setup creates two environment variables in your shell:

- `CONVEX_URL_DEV` - Your development deployment URL
- `CONVEX_URL_PROD` - Your production deployment URL

These are stored in `~/.convex-deployments-mydashboard` and sourced in your shell profile.

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "...",              // Uses default dev deployment
    "dev:prod": "...",         // Uses production deployment
    "setup:deployments": "...", // One-time setup
    "switch:dev": "...",       // Switch .env.local to dev
    "switch:prod": "..."       // Switch .env.local to prod
  }
}
```

## Creating a Production Deployment

If you don't have a production deployment yet:

```bash
npx convex deploy --prod
```

This creates a new production deployment in your Convex project.

## Viewing Your Deployments

To see all available deployments:

```bash
npx convex deployments
```

To get the URL of your current deployment:

```bash
cat .env.local | grep VITE_CONVEX_URL
```

## Configuration Files

### `scripts/setup-deployments.sh`
Automated setup script that detects your deployments and configures your shell environment.

### `scripts/switch-deployment.sh`
Helper script to manually switch between deployments by updating `.env.local`.

### `~/.convex-deployments-mydashboard`
Generated file containing your deployment URLs. This is sourced in your shell profile.

## Troubleshooting

### "CONVEX_URL_PROD not set" Error

This means you haven't run the setup script yet:

```bash
npm run setup:deployments
source ~/.zshrc
```

### Changes Not Syncing

Make sure you're running the correct command:
- `npm run dev` for dev deployment
- `npm run dev:prod` for production deployment

### Multiple Terminal Sessions

If you open a new terminal and the environment variables aren't available:

```bash
source ~/.zshrc
```

Or close and reopen your terminal.

## Best Practices

1. **Default to dev**: Use `npm run dev` for day-to-day development
2. **Test in prod cautiously**: When using `npm run dev:prod`, remember you're working with production data
3. **Sync schema changes**: Make sure to test schema migrations in dev before applying to prod
4. **Environment variables**: Keep sensitive variables synced between deployments using `npx convex env set`

## Safety Tips

⚠️ **When running `npm run dev:prod`:**
- You're connected to your production database
- Any mutations will affect production data
- Schema changes will be applied to production
- Consider using this only for debugging production issues

✅ **Recommended workflow:**
1. Develop and test with `npm run dev` (dev deployment)
2. Push code changes to GitHub
3. Deploy to production via CI/CD or `npx convex deploy --prod`
4. Use `npm run dev:prod` only when you need to debug production issues locally







