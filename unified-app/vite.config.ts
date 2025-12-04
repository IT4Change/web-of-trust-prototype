import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const base = isGithubActions && repoName ? `/${repoName}/unified/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      // Use 'prompt' strategy - shows update notification to user
      registerType: 'prompt',

      // Include all assets for offline support
      includeAssets: ['logo.svg', 'favicon.ico'],

      manifest: {
        name: 'Unified',
        short_name: 'Unified',
        description: 'Collaborative local-first workspace with maps, marketplace and discussions',
        theme_color: '#1d2440',
        background_color: '#1d2440',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Map tiles - cache first, but update in background
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Automerge sync server - network only (real-time sync)
            urlPattern: /^wss:\/\/sync\.automerge\.org\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
        // Don't precache source maps
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        // Skip waiting and claim clients immediately when user accepts update
        skipWaiting: false,
        clientsClaim: false,
      },

      // Dev options
      devOptions: {
        enabled: false, // Disable in dev to avoid confusion
      },
    }),
  ],
  server: {
    port: 3003,
    open: true,
  },
  optimizeDeps: {
    exclude: ['@automerge/automerge', '@automerge/automerge/next'],
  },
});
