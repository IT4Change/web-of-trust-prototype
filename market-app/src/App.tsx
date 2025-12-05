import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyMarketAppDoc } from './schema';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
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
