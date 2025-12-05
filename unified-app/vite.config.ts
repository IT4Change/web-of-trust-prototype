import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const base = isGithubActions && repoName ? `/${repoName}/unified/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    basicSsl(), // Enable HTTPS for local development (required for crypto.subtle)
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
            // JS bundles - network first (get updates), fall back to cache
            urlPattern: /\.js$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache',
              networkTimeoutSeconds: 3, // Fall back to cache after 3s
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
          {
            // WASM files - cache first for fast loading after initial download
            urlPattern: /\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
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
        // Only precache small essential files - large JS/WASM are runtime-cached
        globPatterns: ['**/*.{css,html,ico,png,svg}'],
        // Allow the plugin to work, but we exclude large files via globPatterns
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB (just to prevent errors)
        // Skip waiting and claim clients immediately when user accepts update
        skipWaiting: false,
        clientsClaim: false,
        // Don't block navigation with precache
        navigateFallback: null,
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-automerge': [
            '@automerge/automerge',
            '@automerge/automerge-repo',
            '@automerge/automerge-repo-react-hooks',
            '@automerge/automerge-repo-network-websocket',
            '@automerge/automerge-repo-storage-indexeddb',
          ],
          'vendor-map': ['leaflet'],
        },
      },
    },
  },
});
