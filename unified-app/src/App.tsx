/**
 * Unified App - Root Component
 *
 * Sets up Automerge Repo with storage and network adapters.
 */

import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import { UnifiedApp } from './UnifiedApp';

// Initialize Automerge Repo with IndexedDB storage and WebSocket sync
const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [new BrowserWebSocketClientAdapter('wss://sync.automerge.org')],
});

export function App() {
  return (
    <RepoContext.Provider value={repo}>
      <UnifiedApp />
    </RepoContext.Provider>
  );
}