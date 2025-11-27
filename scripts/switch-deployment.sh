#!/bin/bash
# Quick script to switch between Convex deployments
# Usage: ./scripts/switch-deployment.sh [dev|prod]

DEPLOYMENT=${1:-dev}

if [ "$DEPLOYMENT" = "dev" ]; then
    if [ -n "$CONVEX_URL_DEV" ]; then
        echo "Switching to DEV deployment: $CONVEX_URL_DEV"
        echo "VITE_CONVEX_URL=$CONVEX_URL_DEV" > .env.local
        echo "✅ Now using DEV deployment"
    else
        echo "❌ CONVEX_URL_DEV not set. Run: npm run setup:deployments"
        exit 1
    fi
elif [ "$DEPLOYMENT" = "prod" ]; then
    if [ -n "$CONVEX_URL_PROD" ]; then
        echo "Switching to PROD deployment: $CONVEX_URL_PROD"
        echo "VITE_CONVEX_URL=$CONVEX_URL_PROD" > .env.local
        echo "✅ Now using PROD deployment"
    else
        echo "❌ CONVEX_URL_PROD not set. Run: npm run setup:deployments"
        exit 1
    fi
else
    echo "Usage: $0 [dev|prod]"
    exit 1
fi







