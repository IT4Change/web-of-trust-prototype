import { defineConfig, type UserConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export interface AppViteConfigOptions {
  /** App name for GitHub Pages base path (e.g., 'narrative' -> '/narrative/') */
  appName?: string;
  /** Development server port (default: 3000) */
  port?: number;
  /** Additional Vite config to merge */
  extend?: UserConfig;
}

/**
 * Creates a Vite config with common settings for Narrative apps.
 *
 * Usage in app's vite.config.ts:
 * ```ts
 * import { createViteConfig } from '../shared-config/vite.base';
 * export default createViteConfig({ appName: 'my-app', port: 3002 });
 * ```
 */
export function createViteConfig(options: AppViteConfigOptions = {}) {
  const { appName, port = 3000, extend = {} } = options;

  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
  // Custom domain deployment: only use app name as subpath
  const base = isGithubActions && appName ? `/${appName}/` : '/';

  // Monorepo root directory (one level up from app directories)
  const monorepoRoot = path.resolve(__dirname, '..');

  return defineConfig(({ mode }) => {
    // Load env from monorepo root first, then app-specific
    const rootEnv = loadEnv(mode, monorepoRoot, '');
    const appEnv = loadEnv(mode, process.cwd(), '');

    // Merge: app-specific env takes precedence over root env
    const env = { ...rootEnv, ...appEnv };

    return {
      base,
      plugins: [
        react(),
        wasm(),
        topLevelAwait(),
      ],
      server: {
        port,
        open: true,
      },
      define: {
        // Make VITE_ prefixed env vars available
        'import.meta.env.VITE_SYNC_SERVER': JSON.stringify(env.VITE_SYNC_SERVER),
      },
      optimizeDeps: {
        // Allow Vite to prebundle Automerge for proper WASM initialization order
        // The vite-plugin-wasm handles WASM loading
      },
      ...extend,
    };
  });
}

export default createViteConfig;
