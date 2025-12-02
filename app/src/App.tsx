import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { NarrativeApp } from './NarrativeApp';

// Create Automerge Repo with browser adapters
// Note: BroadcastChannelNetworkAdapter temporarily removed to diagnose cross-browser sync issue
const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [
    new BrowserWebSocketClientAdapter('wss://sync.automerge.org'),
  ],
});

function App() {
  return (
    <RepoContext.Provider value={repo}>
      <NarrativeApp />
    </RepoContext.Provider>
  );
}

export default App;
