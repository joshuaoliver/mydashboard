#!/bin/bash

# Script to find all files using Convex queries that could be migrated to cached versions
# This helps identify files that haven't been migrated yet

echo "🔍 Finding files using Convex queries..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Pattern 1: useQuery from @tanstack/react-query with convexQuery"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
rg "useQuery.*convexQuery" src/ --type tsx --type ts -l 2>/dev/null || echo "No matches found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Pattern 2: useQuery from convex/react (native hooks)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
rg "import.*useQuery.*from.*['\"]convex/react['\"]" src/ --type tsx --type ts -l 2>/dev/null || echo "No matches found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Pattern 3: usePaginatedQuery from convex/react"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
rg "import.*usePaginatedQuery.*from.*['\"]convex/react['\"]" src/ --type tsx --type ts -l 2>/dev/null || echo "No matches found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Already migrated (using cached hooks)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
rg "useCached(Query|PaginatedQuery|Queries)" src/ --type tsx --type ts -l 2>/dev/null || echo "No files migrated yet"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total files with useQuery + convexQuery: $(rg "useQuery.*convexQuery" src/ --type tsx --type ts -l 2>/dev/null | wc -l | xargs)"
echo "Total files with native useQuery: $(rg "import.*useQuery.*from.*['\"]convex/react['\"]" src/ --type tsx --type ts -l 2>/dev/null | wc -l | xargs)"
echo "Total files with usePaginatedQuery: $(rg "import.*usePaginatedQuery.*from.*['\"]convex/react['\"]" src/ --type tsx --type ts -l 2>/dev/null | wc -l | xargs)"
echo "Total files already migrated: $(rg "useCached(Query|PaginatedQuery|Queries)" src/ --type tsx --type ts -l 2>/dev/null | wc -l | xargs)"
echo ""
echo "💡 To migrate a file, replace:"
echo "   - useQuery from '@tanstack/react-query' → useCachedQuery from '@/lib/convex-cache'"
echo "   - useQuery from 'convex/react' → useCachedQuery from '@/lib/convex-cache'"
echo "   - usePaginatedQuery from 'convex/react' → useCachedPaginatedQuery from '@/lib/convex-cache'"
echo ""
echo "📖 See docs/QUERY_CACHING.md for detailed migration guide"
