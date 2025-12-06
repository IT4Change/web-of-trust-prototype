import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyOpinionGraphDoc } from './schema/opinion-graph';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
    enableBroadcastChannel: true,
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyOpinionGraphDoc}
      storagePrefix="narrative"
      enableUserDocument
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
