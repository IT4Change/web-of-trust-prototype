import { useRepository, AppShell } from 'narrative-ui';
import { createEmptyDankWalletDoc } from './schema';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmptyDankWalletDoc}
      storagePrefix="dankWallet"
      enableUserDocument
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
