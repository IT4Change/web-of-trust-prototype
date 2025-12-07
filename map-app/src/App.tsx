import { useRepository, AppShell, OnboardingScreen } from 'narrative-ui';
import { createEmptyMapDoc } from './schema/map-data';
import { MapView } from './components/MapView';

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
      createEmptyDocument={createEmptyMapDoc}
      storagePrefix="map"
      enableUserDocument
      onboardingComponent={OnboardingScreen}
      appTitle="Narrative Map"
    >
      {(props) => <MapView {...props} />}
    </AppShell>
  );
}

export default App;
