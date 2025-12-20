import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// Pure SPA configuration - no SSR
export default defineConfig({
  plugins: [
    // TanStack Router plugin for automatic route generation
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
      // Enable experimental HMR support for code splitting
      experimental: {
        enableCodeSplittingCache: true,
      },
    }),
    tailwindcss(),
    react(),
    tsConfigPaths(),
  ],
  server: {
    port: 5174,
    // Reduce HMR sensitivity for generated files
    hmr: {
      overlay: true,
    },
    watch: {
      // Ignore the generated route tree from triggering additional rebuilds
      // The router plugin handles this file specially
      ignored: ['**/routeTree.gen.ts'],
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
})
