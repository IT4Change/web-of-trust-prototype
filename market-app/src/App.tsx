import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyMarketAppDoc } from './schema';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: import.meta.env.VITE_SYNC_SERVER || 'wss://sync.automerge.org',
    enableBroadcastChannel: true,
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyMarketAppDoc}
      storagePrefix="marketApp"
      enableUserDocument
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
