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
    }),
    tailwindcss(),
    react(),
    tsConfigPaths(),
  ],
  server: {
    port: 5174,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
})
