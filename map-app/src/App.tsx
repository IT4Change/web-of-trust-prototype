import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyMapDoc } from './schema/map-data';
import { MapView } from './components/MapView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
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
