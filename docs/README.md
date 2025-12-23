# Dashboard Documentation

Welcome to the mydashboard project documentation! This folder contains comprehensive guides and references for working with the codebase.

## 📚 Documentation Index

### Query Caching
- **[QUERY_CACHING.md](./QUERY_CACHING.md)** - Complete guide to query caching with `convex-helpers`
  - Overview and benefits
  - Implementation details
  - Migration guide
  - Debugging tips
  - Examples and best practices

- **[QUERY_CACHING_IMPLEMENTATION.md](./QUERY_CACHING_IMPLEMENTATION.md)** - Implementation summary
  - What was implemented
  - Changes made
  - Success metrics
  - Next steps

- **[QUERY_CACHING_QUICK_REF.md](./QUERY_CACHING_QUICK_REF.md)** - Quick reference card
  - Quick start guide
  - Migration cheat sheet
  - Common patterns

## 🚀 Quick Links

### For New Developers
1. Start with the main [README.md](../README.md) in the project root
2. Review [AGENTS.md](../AGENTS.md) for architecture overview
3. Check [QUERY_CACHING_QUICK_REF.md](./QUERY_CACHING_QUICK_REF.md) for common patterns

### For Query Migration
1. Read [QUERY_CACHING.md](./QUERY_CACHING.md) for comprehensive guide
2. Use [QUERY_CACHING_QUICK_REF.md](./QUERY_CACHING_QUICK_REF.md) as reference
3. Run `bash scripts/find-query-usage.sh` to find files to migrate

### For Debugging
1. Enable debug mode in `src/main.tsx`
2. Check browser console for cache logs
3. Review [QUERY_CACHING.md](./QUERY_CACHING.md) debugging section

## 📖 Documentation Standards

### File Naming
- Use `UPPER_SNAKE_CASE.md` for documentation files
- Be descriptive and specific (e.g., `QUERY_CACHING.md` not `CACHING.md`)
- Group related docs with common prefixes (e.g., `QUERY_CACHING_*.md`)

### Content Structure
- Start with clear title and brief description
- Include table of contents for long documents
- Use code examples liberally
- Provide both conceptual and practical information
- Include troubleshooting sections

### Code Examples
- Use syntax highlighting (```tsx, ```bash, etc.)
- Show both "before" and "after" for migrations
- Include imports and context
- Keep examples realistic and practical

## 🔧 Maintenance

### When to Update Docs
- After implementing new features
- When changing architecture or patterns
- After discovering common issues
- When best practices evolve

### What to Document
- ✅ New features and capabilities
- ✅ Migration guides
- ✅ Common patterns and anti-patterns
- ✅ Troubleshooting steps
- ✅ Configuration options
- ❌ Obvious code behavior
- ❌ Implementation details that change frequently
- ❌ Temporary workarounds

## 🤝 Contributing

When adding new documentation:
1. Place it in the `docs/` folder
2. Use clear, descriptive filenames
3. Update this README with a link and description
4. Include practical examples
5. Test all code examples
6. Keep it up to date with code changes

## 📞 Getting Help

- Check relevant documentation first
- Review code examples in migrated files
- Enable debug mode for troubleshooting
- Consult external resources (Convex docs, convex-helpers GitHub)

---

**Last Updated:** December 23, 2025
