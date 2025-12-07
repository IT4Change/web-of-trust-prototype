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

import { useCallback, useState, type ReactNode } from 'react';
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
import { Toast } from './Toast';
import { Confetti } from './Confetti';
import { exportIdentityToFile, importIdentityFromFile } from '../utils/storage';

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

  /** Logo URL for workspace switcher */
  logoUrl?: string;

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
  logoUrl = '/logo.svg',
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
}: AppLayoutProps<TDoc>) {
  // Get repo for bidirectional trust sync
  const repo = useRepo();

  // URL-based profile support
  const { profileDid, closeProfile } = useProfileUrl();

  // QR Scanner state for verification
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Centralized app context - handles ALL standard functionality
  const ctx = useAppContext({
    doc,
    docHandle,
    documentId,
    currentUserDid,
    appTitle,
    workspaceName: workspaceName ?? (doc as BaseDocument<unknown>)?.context?.name ?? 'Workspace',
    hideWorkspaceSwitcher,
    logoUrl,
    onResetIdentity,
    onCreateWorkspace,
    onUpdateIdentityInDoc,
    userDocHandle,
    userDoc,
    userDocUrl,
    repo,
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

  // Show loading while document is not ready
  if (!doc || !docHandle) {
    return <>{loadingComponent ?? <DefaultLoading />}</>;
  }

  return (
    <div className="w-screen h-dvh bg-base-200 flex flex-col overflow-hidden">
      {/* Navbar */}
      {ctx.navbarProps && (
        <AppNavbar {...ctx.navbarProps} onToggleDebugDashboard={onToggleDebugDashboard}>
          {navbarChildren}
        </AppNavbar>
      )}

      {/* App Content */}
      {children(ctx, docHandle)}

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
      {isScannerOpen && doc && (
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
    </div>
  );
}
