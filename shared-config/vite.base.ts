import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

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
  // GITHUB_REPOSITORY is e.g. "it4change/narrative" -> extract repo name
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
  const base = isGithubActions && appName && repoName ? `/${repoName}/${appName}/` : '/';

  return defineConfig({
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
    optimizeDeps: {
      exclude: ['@automerge/automerge', '@automerge/automerge/next'],
    },
    ...extend,
  });
}

export default createViteConfig;
