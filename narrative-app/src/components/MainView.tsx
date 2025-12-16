import type { DocHandle, DocumentId, AutomergeUrl } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import {
  AppLayout,
  type AppContextValue,
  type UserDocument,
  type WorkspaceLoadingState,
  type ContentState,
} from 'narrative-ui';
import type { OpinionGraphDoc } from '../schema/opinion-graph';
import { DataProviderWrapper } from './DataProviderWrapper';
import { NarrativeWorkspaceContent } from './NarrativeWorkspaceContent';
// Debug extensions are auto-initialized via main.tsx import
import '../debug';

interface MainViewProps {
  documentId: DocumentId | null;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
  // Workspace loading state (from AppShell when document is still loading)
  workspaceLoading?: WorkspaceLoadingState;
  // Debug Dashboard toggle (from AppShell)
  onToggleDebugDashboard: () => void;
  // Content state from AppShell
  contentState: ContentState;
  // Callbacks for content state transitions
  onJoinWorkspace: (docUrl: string) => void;
  onCancelLoading: () => void;
  // Callback to go to start screen (from workspace switcher)
  onGoToStart?: () => void;
  // Callback to switch workspace without page reload
  onSwitchWorkspace?: (workspaceId: string) => void;
  // Callback to import identity (handles state update without page reload)
  onImportIdentity?: () => void;
}

/**
 * Main application view with AppLayout
 * Shows list of assumptions and allows creating new ones
 *
 * This component renders AppLayout unconditionally (for start screen etc.)
 * and wraps the workspace content with DataProviderWrapper.
 */
export function MainView({
  documentId,
  currentUserDid,
  privateKey: _privateKey,
  publicKey: _publicKey,
  displayName,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
  workspaceLoading,
  onToggleDebugDashboard,
  contentState,
  onJoinWorkspace,
  onCancelLoading,
  onGoToStart,
  onSwitchWorkspace,
  onImportIdentity,
}: MainViewProps) {
  // Get the document handle for the DataProviderWrapper
  const docHandle = useDocHandle<OpinionGraphDoc>(documentId ?? undefined);

  // Load the workspace document reactively
  const [doc] = useDocument<OpinionGraphDoc>(documentId as unknown as AutomergeUrl | undefined);

  // Load user document reactively
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={currentUserDid}
      appTitle="Narrative"
      workspaceName="Narrative Board"
      hideWorkspaceSwitcher={false}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={undefined} // Will be set by NarrativeWorkspaceContent when available
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
      onToggleDebugDashboard={onToggleDebugDashboard}
      workspaceLoading={workspaceLoading}
      contentState={contentState}
      onJoinWorkspace={onJoinWorkspace}
      onCancelLoading={onCancelLoading}
      identity={{ did: currentUserDid, displayName }}
      onGoToStart={onGoToStart}
      onSwitchWorkspace={onSwitchWorkspace}
      onImportIdentity={onImportIdentity}
    >
      {(ctx: AppContextValue) => (
        <DataProviderWrapper
          docHandle={docHandle}
          currentUserDid={currentUserDid}
          storagePrefix="narrative"
        >
          <NarrativeWorkspaceContent
            currentUserDid={currentUserDid}
            userDoc={userDoc}
            ctx={ctx}
            doc={doc}
          />
        </DataProviderWrapper>
      )}
    </AppLayout>
  );
}
