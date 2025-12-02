import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isGithubActions ? '/narrative/' : '/',
  plugins: [
    react(),
    wasm(),
    topLevelAwait()
  ],
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    exclude: ['@automerge/automerge']
  }
})
