import { useState } from 'react';
import {
  DataProviderProvider,
  createMockDataProvider,
  type DataProvider,
} from 'narrative-ui';
import { DataTestView } from './components/DataTestView';

/**
 * Test App für die neue Data Layer Abstraction
 *
 * Verwendet den MockDataProvider für lokales Testing ohne Backend.
 */
function App() {
  // Erstelle MockDataProvider mit initialer Identity
  const [provider] = useState<DataProvider>(() =>
    createMockDataProvider({
      initialIdentity: {
        id: 'test-user-1',
        displayName: 'Test User',
      },
      workspaceName: 'Data Layer Test Workspace',
    })
  );

  return (
    <DataProviderProvider provider={provider}>
      <DataTestView />
    </DataProviderProvider>
  );
}

export default App;
