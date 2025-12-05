/**
 * Unified App - Root Component
 *
 * Uses the standard AppShell pattern like all other apps.
 */

import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyUnifiedDoc } from './types';
import { UnifiedApp } from './UnifiedApp';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
  });

  return (
    <>
      <AppShell
        repo={repo}
        createEmptyDocument={createEmptyUnifiedDoc}
        storagePrefix="unified"
        enableUserDocument
      >
        {(props) => <UnifiedApp {...props} />}
      </AppShell>
      <PWAUpdatePrompt />
    </>
  );
}

export { App };
