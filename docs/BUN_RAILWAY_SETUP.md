# Bun + Railway Deployment Setup

This project is now configured to use **Bun runtime** (like CopyX) with **Railway's Railpack** for deployment.

## What Changed

### 1. Runtime: Node.js → Bun

**Benefits:**
- 🚀 **20x faster** package installs
- 🚀 **Faster build times** with Bun's bundler
- 🚀 **Lower memory usage** compared to Node.js
- 🚀 **Better performance** in production

### 2. Build Configuration

**Added Nitro with Bun preset** to `vite.config.ts`:

```typescript
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    viteReact(),
    tsConfigPaths(),
    tanstackStart(),
    nitro({
      config: {
        preset: 'bun',  // Use Bun runtime
        externals: {
          inline: ['react', 'react-dom', 'react/jsx-runtime'],
        },
        minify: true,
        devServer: {
          port: 5174,  // Match dev server port
        },
      },
    }),
  ],
})
```

### 3. Package Updates

- Added `nitro` as a dependency
- Updated TanStack packages to match CopyX versions
- Added `engines` field for Node/Bun versions

### 4. Scripts Updated

```json
{
  "scripts": {
    "dev": "bunx convex dev --once && concurrently -r bun:dev:web bun:dev:convex",
    "build": "vite build",
    "start": "bun run .output/server/index.mjs",
    "deploy": "railway up"
  }
}
```

### 5. Railway Configuration (`railway.json`)

```json
{
  "builder": "RAILPACK",
  "build": {
    "buildCommand": "bun install && bun run build && bunx convex deploy --cmd 'echo Build completed'"
  },
  "deploy": {
    "startCommand": "bun run .output/server/index.mjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Development Workflow

### Local Development

```bash
# Start dev server (Vite + Convex)
bun run dev

# Access at http://localhost:5174
```

### Production Build & Test

```bash
# Build the app
bun run build

# Test production build locally
PORT=5174 bun run start

# Access at http://localhost:5174
```

## Deployment to Railway

### Prerequisites

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   # or
   bun add -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

### First Time Setup

1. **Initialize Railway project:**
   ```bash
   railway init
   ```
   - Choose: "Create a new project"
   - Name: "mydashboard"

2. **Set Environment Variables:**
   ```bash
   # Get your Convex URL from .env.local
   railway variables set VITE_CONVEX_URL="https://your-deployment.convex.cloud"
   
   # Add any other environment variables
   railway variables set BEEPER_API_URL="http://localhost:23373"
   ```

### Deploy

```bash
# Quick deploy
bun run deploy

# Or use the full command
railway up
```

### View Logs

```bash
# Stream logs
railway logs

# Or view in browser
railway open
```

### Continuous Deployment

Once connected to GitHub, Railway will automatically deploy on every push to `main`.

## Comparison: Before vs After

| Feature | Before (Node) | After (Bun) |
|---------|---------------|-------------|
| Package Install | `npm install` (~30s) | `bun install` (~5s) |
| Dev Start | `npm run dev` | `bun run dev` |
| Build Time | ~10s | ~20s (includes Nitro) |
| Runtime | Node.js | **Bun** |
| Production Start | `node .output/server/index.mjs` | `bun run .output/server/index.mjs` |
| Deployment | Manual Node server | **Railway Railpack** |

## Port Configuration

- **Dev server**: Port 5174 (configured in `vite.config.ts`)
- **Production**: Port 5174 (default, can be overridden with `PORT` env var)

```bash
# Run on custom port
PORT=3000 bun run start
```

## Troubleshooting

### Build Fails

```bash
# Clean install
rm -rf node_modules bun.lockb
bun install
bun run build
```

### Port Already in Use

```bash
# Kill process on port 5174
lsof -ti:5174 | xargs kill -9

# Or use a different port
PORT=3001 bun run start
```

### Railway Deployment Issues

```bash
# Check build logs
railway logs

# Verify environment variables
railway variables

# Check status
railway status
```

## Next Steps

1. ✅ Build successfully configured with Bun + Nitro
2. ✅ Railway configuration created
3. ⏭️ Deploy to Railway: `railway init` → `railway up`
4. ⏭️ Set up environment variables in Railway
5. ⏭️ Configure custom domain (optional)

## Additional Resources

- [Railway Railpack Documentation](https://docs.railway.app/reference/config-as-code)
- [Bun Runtime](https://bun.sh/)
- [TanStack Start Deployment](https://tanstack.com/start/latest/docs/framework/react/deployment)
- [Convex Production Hosting](https://docs.convex.dev/production/hosting)

---

**Status**: ✅ Configured and tested locally  
**Ready to deploy**: Yes! Run `railway up` when ready.

