#!/bin/bash
# Convex Deployment Setup Script
# This script helps you configure your shell to easily switch between dev and prod deployments

set -e

echo "🔧 Convex Deployment Setup"
echo "================================"
echo ""

# Get current deployment info
echo "📋 Fetching your Convex deployments..."
DEPLOYMENTS=$(npx convex deployments 2>&1)
echo "$DEPLOYMENTS"
echo ""

# Get the deployment URLs
echo "🔍 Getting deployment URLs..."

# Primary method: Get dev URL from .env.local (most reliable)
DEV_URL=""
PROD_URL=""

if [ -f .env.local ]; then
    DEV_URL=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2 | tr -d ' ' | tr -d '"' || echo "")
    if [ -n "$DEV_URL" ]; then
        echo "✅ Found dev deployment: $DEV_URL"
    fi
fi

# Check if there's a production deployment
if echo "$DEPLOYMENTS" | grep -q "Type: prod"; then
    echo "✅ Production deployment detected!"
    # Try to extract prod URL from deployments output
    PROD_URL=$(echo "$DEPLOYMENTS" | grep -A 20 "Type: prod" | grep -o "https://[^ ]*\.convex\.cloud" | head -1 || echo "")
    if [ -n "$PROD_URL" ]; then
        echo "✅ Found prod deployment: $PROD_URL"
    fi
else
    echo "ℹ️  No production deployment found (this is normal for new projects)"
fi

echo ""

# Create environment variables file
ENV_FILE="$HOME/.convex-deployments-mydashboard"

echo "📝 Creating deployment configuration..."

cat > "$ENV_FILE" << EOF
# Convex Deployment URLs for mydashboard
# Source this file in your shell profile (~/.zshrc or ~/.bashrc)
# Generated on $(date)

# Development deployment
export CONVEX_URL_DEV="${DEV_URL:-YOUR_DEV_URL_HERE}"

# Production deployment
export CONVEX_URL_PROD="${PROD_URL:-YOUR_PROD_URL_HERE}"
EOF

echo "✅ Created configuration file: $ENV_FILE"
echo ""

# Display the URLs
echo "📍 Your Deployment URLs:"
if [ -n "$DEV_URL" ]; then
    echo "  Dev:  ✅ $DEV_URL"
else
    echo "  Dev:  ⚠️  Not found - this should be auto-configured"
fi

if [ -n "$PROD_URL" ]; then
    echo "  Prod: ✅ $PROD_URL"
else
    echo "  Prod: ⚠️  Not found - create one with: npx convex deploy --prod"
fi
echo ""

# Instructions for shell setup
echo "🎯 Next Steps:"
echo ""
echo "1. Add this line to your ~/.zshrc file:"
echo "   source $ENV_FILE"
echo ""
echo "2. Reload your shell:"
echo "   source ~/.zshrc"
echo ""
echo "3. Run your app with different deployments:"
echo "   npm run dev        # Use dev deployment (default)"
echo "   npm run dev:prod   # Use production deployment"
echo ""

# Offer to automatically add to zshrc
read -p "Would you like me to automatically add this to your ~/.zshrc? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! grep -q "source $ENV_FILE" ~/.zshrc 2>/dev/null; then
        echo "" >> ~/.zshrc
        echo "# Convex Deployments for mydashboard" >> ~/.zshrc
        echo "source $ENV_FILE" >> ~/.zshrc
        echo "✅ Added to ~/.zshrc"
        echo "🔄 Run: source ~/.zshrc"
    else
        echo "ℹ️  Already configured in ~/.zshrc"
    fi
fi

echo ""
echo "✨ Setup complete!"

