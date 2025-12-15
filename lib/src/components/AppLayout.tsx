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
import { useDocumentTitle, generateLetterFavicon, generateHomeFavicon } from '../hooks/useDocumentTitle';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import { removeWorkspace } from '../schema/userDocument';
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
import { KnownProfilesProvider } from '../providers/KnownProfilesProvider';

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

  /**
   * Callback to import identity (from AppShell, handles state update without page reload)
   */
  onImportIdentity?: () => void;
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
/**
 * AppLayout - Main export that wraps content with KnownProfilesProvider
 *
 * This ensures all profile-related hooks have access to the context.
 */
export function AppLayout<TDoc extends BaseDocument<unknown>>(props: AppLayoutProps<TDoc>) {
  const repo = useRepo();

  return (
    <KnownProfilesProvider
      repo={repo}
      userDoc={props.userDoc ?? null}
      currentUserDid={props.currentUserDid}
      workspaceDoc={props.doc ?? null}
    >
      <AppLayoutInner {...props} />
    </KnownProfilesProvider>
  );
}

/**
 * AppLayoutInner - Inner component with actual layout logic
 */
function AppLayoutInner<TDoc extends BaseDocument<unknown>>({
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
  onImportIdentity,
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

  // Effective workspace name and avatar for display
  const effectiveWorkspaceName = workspaceInfo?.name || workspaceName;
  const effectiveWorkspaceAvatar = workspaceInfo?.avatar;

  // Check if we're in start state (no workspace)
  const isStartState = contentState === 'start';
  const isLoadingState = contentState === 'loading';

  // Get workspace info from UserDocument for loading state (before doc is loaded)
  const loadingWorkspaceInfo = useMemo(() => {
    if (!isLoadingState || !workspaceLoading?.documentUrl || !userDoc?.workspaces) {
      return null;
    }
    // Try to find workspace by URL (documentUrl may be full automerge: URL)
    const entries = Object.entries(userDoc.workspaces);
    for (const [_, workspace] of entries) {
      if (workspaceLoading.documentUrl.includes(workspace.docId || '')) {
        return workspace;
      }
    }
    return null;
  }, [isLoadingState, workspaceLoading?.documentUrl, userDoc?.workspaces]);

  // Dynamic browser title and favicon based on workspace or start state
  const { titleToShow, faviconUrl } = useMemo(() => {
    // Start state: show "Start - Web of Trust" with home icon
    if (isStartState) {
      return {
        titleToShow: 'Start - Web of Trust',
        faviconUrl: generateHomeFavicon(),
      };
    }

    // Loading state: use workspace info from UserDocument if available
    if (isLoadingState && loadingWorkspaceInfo) {
      const name = loadingWorkspaceInfo.name;
      const avatar = loadingWorkspaceInfo.avatar;
      if (avatar) {
        return { titleToShow: `${name} - Web of Trust`, faviconUrl: avatar };
      }
      if (name) {
        return { titleToShow: `${name} - Web of Trust`, faviconUrl: generateLetterFavicon(name.charAt(0)) };
      }
    }

    // Workspace state: show workspace name with avatar or letter
    if (effectiveWorkspaceAvatar) {
      return {
        titleToShow: `${effectiveWorkspaceName} - Web of Trust`,
        faviconUrl: effectiveWorkspaceAvatar,
      };
    }

    // Generate letter favicon from workspace name
    if (effectiveWorkspaceName) {
      const letter = effectiveWorkspaceName.charAt(0);
      return {
        titleToShow: `${effectiveWorkspaceName} - Web of Trust`,
        faviconUrl: generateLetterFavicon(letter),
      };
    }

    return {
      titleToShow: undefined,
      faviconUrl: undefined,
    };
  }, [isStartState, isLoadingState, loadingWorkspaceInfo, effectiveWorkspaceAvatar, effectiveWorkspaceName]);

  useDocumentTitle({
    workspaceName: titleToShow,
    workspaceAvatar: faviconUrl,
    appName: appTitle,
  });

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
    if (onImportIdentity) {
      // Use AppShell's handler for proper state management without reload
      onImportIdentity();
    } else {
      // Fallback: legacy behavior with reload
      importIdentityFromFile(
        () => window.location.reload(),
        (error) => ctx.showToast(error)
      );
    }
  }, [onImportIdentity, ctx]);

  // Open QR scanner for verification (closes profile modal first)
  const handleOpenScanner = useCallback(() => {
    closeProfile();
    setIsScannerOpen(true);
  }, [closeProfile]);

  // Leave workspace: remove from UserDocument and go to start
  const handleLeaveWorkspace = useCallback(() => {
    if (userDocHandle && documentId) {
      userDocHandle.change((d) => {
        removeWorkspace(d, documentId);
      });
    }
    onGoToStart?.();
  }, [userDocHandle, documentId, onGoToStart]);

  // Render content based on contentState
  const renderContent = () => {
    switch (contentState) {
      case 'start':
        return (
          <StartContent
            onCreateWorkspace={onCreateWorkspace}
            onOpenProfile={() => ctx.openProfile(currentUserDid)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onShowMyQR={() => ctx.openProfile(currentUserDid)}
            identity={{
              did: currentUserDid,
              displayName: userDoc?.profile?.displayName || identity?.displayName,
              avatarUrl: userDoc?.profile?.avatarUrl,
            }}
          />
        );
      case 'loading':
        return workspaceLoading ? (
          <WorkspaceLoadingContent
            documentUrl={workspaceLoading.documentUrl}
            secondsElapsed={workspaceLoading.secondsElapsed}
            onCreateNew={workspaceLoading.onCreateNew}
            showCreateNewAfterSeconds={workspaceLoading.showCreateNewAfterSeconds}
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
          onLeaveWorkspace={handleLeaveWorkspace}
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
          knownProfiles={ctx.knownProfiles}
          getProfile={ctx.getProfile}
          registerExternalDoc={ctx.registerExternalDoc}
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
          knownProfiles={ctx.knownProfiles}
          getProfile={ctx.getProfile}
          registerExternalDoc={ctx.registerExternalDoc}
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
