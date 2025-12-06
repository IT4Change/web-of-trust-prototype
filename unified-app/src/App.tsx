/**
 * Unified App - Root Component
 *
 * Uses the standard AppShell pattern like all other apps.
 */

import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyUnifiedDoc } from './types';
import { UnifiedApp } from './UnifiedApp';

function App() {
  const repo = useRepository({
    syncServer: import.meta.env.VITE_SYNC_SERVER || 'wss://sync.automerge.org',
    enableBroadcastChannel: true,
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyUnifiedDoc}
      storagePrefix="unified"
      enableUserDocument
    >
      {(props) => <UnifiedApp {...props} />}
    </AppShell>
  );
}

export { App };
