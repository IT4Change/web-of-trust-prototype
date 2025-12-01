import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { NarriApp } from './NarriApp';

// Create Automerge Repo with browser adapters
const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [
    // Connect to Automerge sync server
    new BrowserWebSocketClientAdapter('wss://sync.automerge.org'),
  ],
});

function App() {
  return (
    <RepoContext.Provider value={repo}>
      <NarriApp />
    </RepoContext.Provider>
  );
}

export default App;
