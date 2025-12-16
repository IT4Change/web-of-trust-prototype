/**
 * DataProviderWrapper
 *
 * Wrapper-Komponente, die den DataProvider für die narrative-app bereitstellt.
 * Nutzt das bestehende Workspace-Dokument aus AppShell und erstellt daraus
 * einen AutomergeDataProvider.
 */

import { useMemo, type ReactNode } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import {
  DataProviderProvider,
  AutomergeDataProvider,
  type AutomergeWorkspaceDataDoc,
} from 'narrative-ui';
import type { OpinionGraphDoc } from '../schema/opinion-graph';

interface DataProviderWrapperProps {
  /** The loaded workspace document handle */
  docHandle: DocHandle<OpinionGraphDoc> | undefined;
  /** Current user DID (reserved for future use) */
  currentUserDid: string;
  /** Storage prefix for localStorage keys */
  storagePrefix: string;
  /** Children to render inside the DataProviderProvider */
  children: ReactNode;
}

/**
 * Wraps children with DataProviderProvider using the AutomergeDataProvider.
 *
 * This component bridges the existing AppShell infrastructure with the new
 * Data Layer by creating an AutomergeDataProvider from the loaded workspace document.
 */
export function DataProviderWrapper({
  docHandle,
  currentUserDid: _currentUserDid,
  storagePrefix,
  children,
}: DataProviderWrapperProps) {
  const repo = useRepo();

  // Create AutomergeDataProvider when docHandle is available
  const dataProvider = useMemo(() => {
    if (!docHandle || !repo) return null;

    try {
      const provider = new AutomergeDataProvider({
        repo,
        storagePrefix,
        // Cast the doc handle to the expected type
        // The workspace document will have items/relations added as needed
        workspaceDocHandle: docHandle as unknown as DocHandle<AutomergeWorkspaceDataDoc>,
        enableUserDocument: false, // UserDocument is handled by AppShell
      });

      return provider;
    } catch (error) {
      console.error('Failed to create AutomergeDataProvider:', error);
      return null;
    }
  }, [docHandle, repo, storagePrefix]);

  // If no provider available, don't render children yet
  // NarrativeContent requires the DataProvider context to be present
  if (!dataProvider) {
    return null;
  }

  return (
    <DataProviderProvider provider={dataProvider}>
      {children}
    </DataProviderProvider>
  );
}
