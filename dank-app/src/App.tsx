import { useRepository, AppShell, OnboardingScreen } from 'narrative-ui';
import { createEmptyDankWalletDoc } from './schema';
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
      createEmptyDocument={createEmptyDankWalletDoc}
      storagePrefix="dankWallet"
      enableUserDocument
      onboardingComponent={OnboardingScreen}
      appTitle="Dank"
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
