/**
 * Unified App - Root Component
 *
 * Uses the standard AppShell pattern like all other apps.
 */

import { useRepository, AppShell, OnboardingScreen } from 'narrative-ui';
import { createEmptyUnifiedDoc } from './types';
import { UnifiedApp } from './UnifiedApp';

/**
 * Parse sync servers from environment variable
 * Supports comma-separated list: "wss://server1.com,wss://server2.com"
 */
function getSyncServers(): string[] {
  const envServers = import.meta.env.VITE_SYNC_SERVERS;
  if (envServers) {
    return envServers.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  return ['wss://sync.automerge.org'];
}

function App() {
  const repo = useRepository({
    syncServers: getSyncServers(),
    enableBroadcastChannel: true,
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyUnifiedDoc}
      storagePrefix="unified"
      enableUserDocument
      onboardingComponent={OnboardingScreen}
      appTitle="Narrative"
    >
      {(props) => <UnifiedApp {...props} />}
    </AppShell>
  );
}

export { App };
