#!/bin/bash
# Verify Convex deployment setup

echo "🔍 Verifying Convex Deployment Setup"
echo "======================================"
echo ""

# Check if config file exists
if [ -f "$HOME/.convex-deployments-mydashboard" ]; then
    echo "✅ Configuration file exists"
else
    echo "❌ Configuration file missing"
    echo "   Run: npm run setup:deployments"
    exit 1
fi

# Check if sourced in zshrc
if grep -q "convex-deployments-mydashboard" ~/.zshrc 2>/dev/null; then
    echo "✅ Configuration loaded in ~/.zshrc"
else
    echo "⚠️  Configuration not in ~/.zshrc"
    echo "   Add: source ~/.convex-deployments-mydashboard"
fi

# Source the config
source "$HOME/.convex-deployments-mydashboard"

# Check environment variables
echo ""
echo "📍 Environment Variables:"
if [ -n "$CONVEX_URL_DEV" ] && [ "$CONVEX_URL_DEV" != "YOUR_DEV_URL_HERE" ]; then
    echo "  ✅ CONVEX_URL_DEV: $CONVEX_URL_DEV"
else
    echo "  ❌ CONVEX_URL_DEV not set"
fi

if [ -n "$CONVEX_URL_PROD" ] && [ "$CONVEX_URL_PROD" != "YOUR_PROD_URL_HERE" ]; then
    echo "  ✅ CONVEX_URL_PROD: $CONVEX_URL_PROD"
else
    echo "  ⚠️  CONVEX_URL_PROD not set (create with: npx convex deploy --prod)"
fi

# Check current deployment
echo ""
echo "🎯 Current Deployment:"
if [ -f .env.local ]; then
    CURRENT=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2 | tr -d ' ' | tr -d '"')
    echo "  $CURRENT"
    
    if [ "$CURRENT" = "$CONVEX_URL_DEV" ]; then
        echo "  Type: DEV ✅"
    elif [ "$CURRENT" = "$CONVEX_URL_PROD" ]; then
        echo "  Type: PROD ⚠️"
    else
        echo "  Type: Unknown"
    fi
else
    echo "  ⚠️  No .env.local file found"
fi

echo ""
echo "📝 Available Commands:"
echo "  npm run dev           - Use dev deployment"
echo "  npm run dev:prod      - Use prod deployment"
echo "  npm run switch:dev    - Switch to dev"
echo "  npm run switch:prod   - Switch to prod"
echo "  npm run deployments   - List all deployments"
echo ""
echo "✨ Setup complete!"







