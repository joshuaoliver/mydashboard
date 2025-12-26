import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// Tauri dev host for mobile/external device development
const host = process.env.TAURI_DEV_HOST

// Pure SPA configuration - no SSR, with Tauri support
export default defineConfig({
  plugins: [
    // TanStack Router plugin for automatic route generation
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    react(),
    tsConfigPaths(),
  ],
  // Clear screen disabled for better Tauri CLI output
  clearScreen: false,
  server: {
    port: 5174,
    host: host || false,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host: host,
          port: 5175,
        }
      : {
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
  // Force re-bundle of dependencies (remove after restart)
  optimizeDeps: {
    force: true,
  },
})
