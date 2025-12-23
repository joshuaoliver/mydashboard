# AGENTS.md

## Commands
- `bun run dev` - Start dev server (Vite + Convex)
- `bun run build` - Build for production (typecheck: `bunx tsc --noEmit`)
- `bun run format` - Format with Prettier
- **Package manager: Bun only** - Do not use npm/yarn

## Architecture
- **Frontend**: TanStack Router (file-based routing in `src/routes/`), React 19, Shadcn/ui, Tailwind CSS v4
- **Backend**: Convex real-time database in `convex/` (queries, mutations, actions)
- **Imports**: Use `~/*` or `@/*` path aliases for `src/` (e.g., `~/components/ui/button`)
- **Schema**: `convex/schema.ts` - tables: users, beeperChats, beeperMessages, contacts, prompts, todoDocuments, todoItems, etc.
- **Query Caching**: Use `useCachedQuery` from `@/lib/convex-cache` for better navigation performance (keeps subscriptions alive 5min after unmount)
- **API pattern**: `useCachedQuery(api.module.function, {})` (preferred) or `convexQuery(api.module.function, {})` with `@tanstack/react-query`

## Code Style
- TypeScript strict mode; no `any` types
- Functional components with hooks; named exports
- Convex functions: use `v` from `convex/values` for validation
- Route files: export `Route` via `createFileRoute()`
- Icons: Lucide React; Forms: React Hook Form + Zod
- Keep components small, no unnecessary comments
