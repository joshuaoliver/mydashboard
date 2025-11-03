import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 5174,
  },
  // Handle font files for KaTeX and other libraries
  assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.eot'],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress certain warnings
        if (warning.code === 'PLUGIN_WARNING') return
        warn(warning)
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  plugins: [
    tailwindcss(),
    viteReact(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    nitro({
      config: {
        preset: 'bun',
        externals: {
          inline: ['react', 'react-dom', 'react/jsx-runtime'],
        },
        minify: true,
        devServer: {
          port: 5174,
        },
      },
    }),
  ],
})
