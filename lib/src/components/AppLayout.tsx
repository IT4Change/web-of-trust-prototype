/**
 * AppLayout - Wrapper component that handles all standard app infrastructure
 *
 * Combines:
 * - AppNavbar with all standard functionality
 * - Standard modals (TrustReciprocityModal, NewWorkspaceModal, Toast)
 * - useAppContext hook integration
 *
 * Apps only need to provide their content via children render prop.
 */

import { useCallback, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { useAppContext, type AppContextValue } from '../hooks/useAppContext';
import { useProfileUrl } from '../hooks/useProfileUrl';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import { AppNavbar } from './AppNavbar';
import { TrustReciprocityModal } from './TrustReciprocityModal';
import { NewWorkspaceModal } from './NewWorkspaceModal';
import { UserProfileModal, type ProfileAction } from './UserProfileModal';
import { QRScannerModal } from './QRScannerModal';
import { JoinWorkspaceDialog } from './JoinWorkspaceDialog';
import { Toast } from './Toast';
import { Confetti } from './Confetti';
import { WorkspaceLoadingContent } from './LoadingScreen';
import { StartContent } from './StartContent';
import { exportIdentityToFile, importIdentityFromFile, loadSharedIdentity } from '../utils/storage';
import type { WorkspaceLoadingState, ContentState } from './AppShell';

export interface AppLayoutProps<TDoc extends BaseDocument<unknown>> {
  /** The Automerge document */
  doc: TDoc | null | undefined;

  /** The Automerge document handle for mutations */
  docHandle: DocHandle<TDoc> | null | undefined;

  /** Document ID as string */
  documentId: string;

  /** Current user's DID */
  currentUserDid: string;

  /** App title shown in navbar (when workspace switcher is hidden) */
  appTitle?: string;

  /** Workspace name for this document (defaults to doc.context?.name or 'Workspace') */
  workspaceName?: string;

  /** Whether to hide the workspace switcher (simple single-doc apps) */
  hideWorkspaceSwitcher?: boolean;

  /** Callback when identity needs to be reset */
  onResetIdentity: () => void;

  /** Callback when a new workspace is created via the modal */
  onCreateWorkspace: (name: string, avatarDataUrl?: string) => void;

  /** Callback to update identity in the document (app-specific) */
  onUpdateIdentityInDoc?: (updates: { displayName?: string; avatarUrl?: string }) => void;

  /** Optional children to render in the navbar (e.g., ModuleSwitcher) */
  navbarChildren?: ReactNode;

  /**
   * Render function that receives the app context and doc handle.
   * Return the app-specific content.
   */
  children: (ctx: AppContextValue<unknown>, docHandle: DocHandle<TDoc>) => ReactNode;

  /** Loading component to show while document is loading */
  loadingComponent?: ReactNode;

  /**
   * User Document handle for personal trust attestations (optional)
   * When provided, trust operations use User-Doc instead of Workspace-Doc
   */
  userDocHandle?: DocHandle<UserDocument>;

  /**
   * User Document for reading trust data (optional)
   * Reactive document from useDocument hook
   */
  userDoc?: UserDocument | null;

  /**
   * User Document URL for bidirectional trust sync (optional)
   * Included in QR code so others can write to our trustReceived
   */
  userDocUrl?: string;

  /**
   * Whether to enable URL-based profile viewing (default: true)
   * When enabled, profiles can be opened via #profile=did:key:...
   */
  enableProfileUrl?: boolean;

  /**
   * Custom actions to show in the profile modal
   * Receives the profile DID and close handler
   */
  profileActions?: (profileDid: string, closeProfile: () => void) => ProfileAction[];

  /**
   * Whether to hide trust actions in the profile modal (default: false)
   */
  hideProfileTrustActions?: boolean;

  /**
   * Callback to toggle the debug dashboard (from AppShell)
   */
  onToggleDebugDashboard?: () => void;

  /**
   * Workspace loading state (from AppShell when document is still loading)
   * When present, shows loading UI in content area instead of children
   */
  workspaceLoading?: WorkspaceLoadingState;

  /**
   * Content state from AppShell: 'start', 'loading', or 'ready'
   * Determines what content to show in the main area
   */
  contentState: ContentState;

  /**
   * Callback when user wants to join a workspace (for start state)
   */
  onJoinWorkspace: (docUrl: string) => void;

  /**
   * Callback to cancel loading and return to start state
   */
  onCancelLoading: () => void;

  /**
   * Current user's identity (for start content display)
   */
  identity?: {
    did: string;
    displayName?: string;
  };

  /**
   * Callback to go to start screen (from workspace switcher)
   */
  onGoToStart?: () => void;

  /**
   * Callback to switch workspace without page reload (from AppShell)
   */
  onSwitchWorkspace?: (workspaceId: string) => void;
}

/**
 * Default loading component
 */
function DefaultLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-base-content">Loading document...</p>
      </div>
    </div>
  );
}

/**
 * AppLayout wraps your app content with standard infrastructure.
 *
 * @example
 * ```tsx
 * <AppLayout
 *   doc={narrative?.doc}
 *   docHandle={docHandle}
 *   documentId={documentId.toString()}
 *   currentUserDid={currentUserDid}
 *   appTitle="Narrative"
 *   logoUrl={logoUrl}
 *   onResetIdentity={onResetIdentity}
 *   onCreateWorkspace={onNewDocument}
 *   onUpdateIdentityInDoc={narrative?.updateIdentity}
 * >
 *   {(ctx, docHandle) => (
 *     <AssumptionList
 *       assumptions={sortedAssumptions}
 *       hiddenUserDids={ctx.hiddenUserDids}
 *       // ...
 *     />
 *   )}
 * </AppLayout>
 * ```
 */
export function AppLayout<TDoc extends BaseDocument<unknown>>({
  doc,
  docHandle,
  documentId,
  currentUserDid,
  appTitle,
  workspaceName,
  hideWorkspaceSwitcher = false,
  onResetIdentity,
  onCreateWorkspace,
  onUpdateIdentityInDoc,
  navbarChildren,
  children,
  loadingComponent,
  userDocHandle,
  userDoc,
  userDocUrl,
  enableProfileUrl = true,
  profileActions,
  hideProfileTrustActions = false,
  onToggleDebugDashboard,
  workspaceLoading,
  contentState,
  onJoinWorkspace,
  onCancelLoading,
  identity,
  onGoToStart,
  onSwitchWorkspace,
}: AppLayoutProps<TDoc>) {
  // Get repo for bidirectional trust sync
  const repo = useRepo();

  // URL-based profile support
  const { profileDid, closeProfile } = useProfileUrl();

  // QR Scanner state for verification
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Join workspace confirmation state
  // null = no pending join, 'pending' = waiting for user confirmation, 'joined' = user has joined
  const [joinState, setJoinState] = useState<'pending' | 'joined' | null>(null);

  // Check if user is already a member of this workspace
  const isUserMember = useMemo(() => {
    if (!doc || !currentUserDid) return false;
    return Boolean(doc.identities?.[currentUserDid]);
  }, [doc, currentUserDid]);

  // Get workspace info for join dialog
  const workspaceInfo = useMemo(() => {
    if (!doc) return null;
    return {
      name: (doc as BaseDocument<unknown>).context?.name || workspaceName || 'Workspace',
      avatar: (doc as BaseDocument<unknown>).context?.avatar,
      memberDids: Object.keys(doc.identities || {}),
    };
  }, [doc, workspaceName]);

  // When doc becomes ready and user is NOT a member, show join dialog
  useEffect(() => {
    if (contentState === 'ready' && doc && !isUserMember && joinState === null) {
      console.log('[AppLayout] User is not a member of this workspace, showing join dialog');
      setJoinState('pending');
    }
  }, [contentState, doc, isUserMember, joinState]);

  // Reset join state when document changes
  useEffect(() => {
    setJoinState(null);
  }, [documentId]);

  // Handle joining the workspace
  const handleConfirmJoin = useCallback(() => {
    if (!docHandle || !currentUserDid) return;

    // Load user's identity to get display name and avatar
    const storedIdentity = loadSharedIdentity();
    const displayName = storedIdentity?.displayName || userDoc?.profile?.displayName;
    const avatarUrl = userDoc?.profile?.avatarUrl;

    console.log('[AppLayout] User confirmed join, writing identity to workspace');

    // Write identity to workspace document
    // Note: Automerge cannot store undefined values, so we only set properties that have values
    docHandle.change((d: BaseDocument<unknown>) => {
      if (!d.identities) {
        d.identities = {};
      }
      // Create empty profile object first
      d.identities[currentUserDid] = {};
      // Only set displayName if it has a value
      if (displayName) {
        d.identities[currentUserDid].displayName = displayName;
      }
      // Only set avatarUrl if it has a value
      if (avatarUrl) {
        d.identities[currentUserDid].avatarUrl = avatarUrl;
      }
    });

    setJoinState('joined');
  }, [docHandle, currentUserDid, userDoc]);

  // Handle declining to join
  const handleDeclineJoin = useCallback(() => {
    console.log('[AppLayout] User declined join, returning to start');
    setJoinState(null);
    onCancelLoading();
  }, [onCancelLoading]);

  // Centralized app context - handles ALL standard functionality
  const ctx = useAppContext({
    doc,
    docHandle,
    documentId,
    currentUserDid,
    appTitle,
    workspaceName: workspaceName ?? (doc as BaseDocument<unknown>)?.context?.name ?? 'Workspace',
    hideWorkspaceSwitcher,
    onResetIdentity,
    onCreateWorkspace,
    onUpdateIdentityInDoc,
    userDocHandle,
    userDoc,
    userDocUrl,
    repo,
    onSwitchWorkspace,
  });

  // Identity management handlers for profile modal
  const handleExportIdentity = useCallback(() => {
    exportIdentityToFile();
  }, []);

  const handleImportIdentity = useCallback(() => {
    importIdentityFromFile(
      undefined,
      (error) => ctx.showToast(error)
    );
  }, [ctx]);

  // Open QR scanner for verification (closes profile modal first)
  const handleOpenScanner = useCallback(() => {
    closeProfile();
    setIsScannerOpen(true);
  }, [closeProfile]);

  // Render content based on contentState
  const renderContent = () => {
    switch (contentState) {
      case 'start':
        return (
          <StartContent
            onJoinWorkspace={onJoinWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            identity={identity || { did: currentUserDid, displayName: userDoc?.profile?.displayName }}
            appTitle={appTitle}
          />
        );
      case 'loading':
        return workspaceLoading ? (
          <WorkspaceLoadingContent
            documentId={workspaceLoading.documentId}
            attempt={workspaceLoading.attempt}
            maxAttempts={workspaceLoading.maxAttempts}
            elapsedTime={workspaceLoading.elapsedTime}
            onCreateNew={workspaceLoading.onCreateNew}
            showCreateNewAfter={workspaceLoading.showCreateNewAfter}
            onCancel={onCancelLoading}
          />
        ) : (
          <>{loadingComponent ?? <DefaultLoading />}</>
        );
      case 'ready':
        if (!doc || !docHandle) {
          return <>{loadingComponent ?? <DefaultLoading />}</>;
        }
        // If join is pending, show a placeholder content (dialog overlays it)
        if (joinState === 'pending') {
          return (
            <div className="flex-1 flex items-center justify-center bg-base-200">
              <div className="text-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="mt-4 text-base-content/70">Workspace wird geladen...</p>
              </div>
            </div>
          );
        }
        return children(ctx, docHandle);
    }
  };

  // Determine if we're in start state for workspace switcher
  const isStart = contentState === 'start';

  return (
    <div className="w-screen h-dvh bg-base-200 flex flex-col overflow-hidden">
      {/* Full Navbar - always shown when navbarProps available */}
      {ctx.navbarProps && (
        <AppNavbar
          {...ctx.navbarProps}
          onToggleDebugDashboard={onToggleDebugDashboard}
          isStart={isStart}
          onGoToStart={onGoToStart}
        >
          {navbarChildren}
        </AppNavbar>
      )}

      {/* Content Area */}
      {renderContent()}

      {/* Standard Modals - all from context */}
      {ctx.trustReciprocityModalProps && (
        <TrustReciprocityModal
          {...ctx.trustReciprocityModalProps}
          trustedUserProfiles={ctx.trustedUserProfiles}
        />
      )}
      {ctx.toastProps && <Toast {...ctx.toastProps} />}
      <NewWorkspaceModal {...ctx.newWorkspaceModalProps} />

      {/* URL-based Profile Modal */}
      {enableProfileUrl && profileDid && (
        <UserProfileModal
          did={profileDid}
          isOpen={true}
          onClose={closeProfile}
          doc={doc}
          currentUserDid={currentUserDid}
          trustGiven={userDoc?.trustGiven?.[profileDid]}
          trustReceived={userDoc?.trustReceived?.[profileDid]}
          onTrust={ctx.handleTrustUser}
          onOpenScanner={handleOpenScanner}
          onRevokeTrust={ctx.handleRevokeTrust}
          userDocUrl={userDocUrl}
          customActions={profileActions?.(profileDid, closeProfile) ?? []}
          hideTrustActions={hideProfileTrustActions}
          trustedUserProfiles={ctx.trustedUserProfiles}
          // Edit features for own profile
          userDoc={userDoc}
          onUpdateIdentity={ctx.handleUpdateIdentity}
          onExportIdentity={handleExportIdentity}
          onImportIdentity={handleImportIdentity}
          onResetIdentity={onResetIdentity}
        />
      )}

      {/* QR Scanner Modal for verification */}
      {isScannerOpen && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          currentUserDid={currentUserDid}
          doc={doc}
          onTrustUser={ctx.handleTrustUser}
          userDocUrl={userDocUrl}
          userDoc={userDoc}
          onOpenProfile={ctx.openProfile}
          onMutualTrustEstablished={ctx.handleMutualTrustEstablished}
        />
      )}

      {/* Confetti animation for mutual trust celebration */}
      <Confetti
        isActive={ctx.showConfetti}
        onComplete={ctx.clearConfetti}
      />

      {/* Join Workspace Dialog - shown when user is not a member */}
      {joinState === 'pending' && doc && workspaceInfo && (
        <JoinWorkspaceDialog
          isOpen={true}
          doc={doc}
          currentUserDid={currentUserDid}
          workspaceName={workspaceInfo.name}
          workspaceAvatar={workspaceInfo.avatar}
          memberDids={workspaceInfo.memberDids}
          onConfirm={handleConfirmJoin}
          onDecline={handleDeclineJoin}
        />
      )}
    </div>
  );
}
