/**
 * DataProvider React Context
 *
 * Stellt den DataProvider für die gesamte App bereit.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { DataProvider } from './types';

// =============================================================================
// Context
// =============================================================================

const DataProviderContext = createContext<DataProvider | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export interface DataProviderProps {
  provider: DataProvider;
  children: ReactNode;
}

export function DataProviderProvider({
  provider,
  children,
}: DataProviderProps) {
  return (
    <DataProviderContext.Provider value={provider}>
      {children}
    </DataProviderContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook zum Zugriff auf den DataProvider
 *
 * @throws Error wenn außerhalb des DataProviderProvider verwendet
 */
export function useDataProvider(): DataProvider {
  const provider = useContext(DataProviderContext);
  if (!provider) {
    throw new Error(
      'useDataProvider must be used within a DataProviderProvider'
    );
  }
  return provider;
}

/**
 * Hook zum Zugriff auf den DataProvider (nullable)
 *
 * Gibt null zurück wenn außerhalb des Providers verwendet.
 * Nützlich für optionale Integrationen.
 */
export function useDataProviderOptional(): DataProvider | null {
  return useContext(DataProviderContext);
}
