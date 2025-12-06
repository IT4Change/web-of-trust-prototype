import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyMapDoc } from './schema/map-data';
import { MapView } from './components/MapView';

function App() {
  const repo = useRepository({
    syncServer: import.meta.env.VITE_SYNC_SERVER || 'wss://sync.automerge.org',
    enableBroadcastChannel: true,
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyMapDoc}
      storagePrefix="map"
      enableUserDocument
    >
      {(props) => <MapView {...props} />}
    </AppShell>
  );
}

export default App;
