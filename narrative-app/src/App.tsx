import { useRepository, AppShell, OnboardingScreen } from 'narrative-ui';
import { createEmptyOpinionGraphDoc } from './schema/opinion-graph';
import { MainView } from './components/MainView';

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
      createEmptyDocument={createEmptyOpinionGraphDoc}
      storagePrefix="narrative"
      enableUserDocument
      onboardingComponent={OnboardingScreen}
      appTitle="Narrative"
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
