/**
 * AppNavbar - Shared navigation bar with integrated modals for all Narrative apps
 *
 * Features:
 * - Workspace switcher (left)
 * - Optional center content slot (for module tabs, etc.)
 * - User menu with profile, collaborators, verify, etc. (right)
 * - Integrated modals (ProfileModal, CollaboratorsModal, QRScannerModal)
 *
 * Usage:
 * ```tsx
 * <AppNavbar
 *   currentUserDid={did}
 *   doc={doc}
 *   workspaces={workspaces}
 *   currentWorkspace={currentWorkspace}
 *   onSwitchWorkspace={handleSwitch}
 *   onNewWorkspace={handleNew}
 *   onUpdateIdentity={handleUpdateIdentity}
 *   onTrustUser={handleTrustUser}
 *   onResetIdentity={handleReset}
 * >
 *   <ModuleSwitcher ... />
 * </AppNavbar>
 * ```
 */

import { useState, useCallback, type ReactNode } from 'react';
import { UserAvatar } from './UserAvatar';
import { CollaboratorsModal } from './CollaboratorsModal';
import { QRScannerModal } from './QRScannerModal';
import { WorkspaceModal } from './WorkspaceModal';
import {
  WorkspaceSwitcher,
  type WorkspaceInfo,
} from './WorkspaceSwitcher';
import { useProfileUrl } from '../hooks/useProfileUrl';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustedUserProfile, KnownProfile } from '../hooks/useAppContext';

export interface AppNavbarProps<TData = unknown> {
  /** Current user's DID */
  currentUserDid: string;

  /** The Automerge document (for modals) - may be null in start/loading states */
  doc: BaseDocument<TData> | null;

  /** Current workspace info */
  currentWorkspace: WorkspaceInfo | null;

  /** List of all workspaces */
  workspaces: WorkspaceInfo[];

  /** Callback when switching workspace */
  onSwitchWorkspace: (workspaceId: string) => void;

  /** Callback to create new workspace */
  onNewWorkspace: () => void;

  /** Callback when user trusts another user (with optional userDocUrl for bidirectional trust) */
  onTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;

  /** Callback to toggle user visibility in views */
  onToggleUserVisibility?: (did: string) => void;

  /** Set of hidden user DIDs */
  hiddenUserDids?: Set<string>;

  /** Optional: Center content (e.g., module tabs) */
  children?: ReactNode;

  /** Optional: App title to show in navbar (only if no workspace switcher) */
  appTitle?: string;

  /** Optional: Hide workspace switcher (for simple single-doc apps) */
  hideWorkspaceSwitcher?: boolean;

  /** User document for trust information (optional) */
  userDoc?: UserDocument | null;

  /** User document URL for QR code generation (optional) */
  userDocUrl?: string;

  /**
   * Profiles loaded from trusted users' UserDocuments (optional)
   * Used as primary source for avatar/name of verified friends
   */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;

  /** Callback to open a user's profile */
  onOpenProfile?: (did: string) => void;

  /** Callback when mutual trust is established */
  onMutualTrustEstablished?: (friendDid: string, friendName: string) => void;

  /** Callback to toggle debug dashboard */
  onToggleDebugDashboard?: () => void;

  /** Document URL for sharing (for WorkspaceModal) */
  documentUrl?: string;

  /** Callback to update workspace (name, avatar) */
  onUpdateWorkspace?: (updates: { name?: string; avatar?: string }) => void;

  /** Show toast message */
  onShowToast?: (message: string) => void;

  /** Whether currently in start state (no workspace loaded) */
  isStart?: boolean;

  /** Callback to go to start screen */
  onGoToStart?: () => void;

  /** Callback to leave workspace (removes from list and goes to start) */
  onLeaveWorkspace?: () => void;

  /** All known profiles for reactive UI updates */
  knownProfiles?: Map<string, KnownProfile>;

  /** Get profile from central known profiles */
  getProfile?: (did: string) => KnownProfile | undefined;

  /** Register external doc for reactive profile loading */
  registerExternalDoc?: (userDocUrl: string) => void;
}

export function AppNavbar<TData = unknown>({
  currentUserDid,
  doc,
  currentWorkspace,
  workspaces,
  onSwitchWorkspace,
  onNewWorkspace,
  onTrustUser,
  onToggleUserVisibility,
  hiddenUserDids = new Set(),
  children,
  appTitle,
  hideWorkspaceSwitcher = false,
  userDoc,
  userDocUrl,
  trustedUserProfiles,
  onOpenProfile,
  onMutualTrustEstablished,
  onToggleDebugDashboard,
  documentUrl,
  onUpdateWorkspace,
  onShowToast,
  isStart = false,
  onGoToStart,
  onLeaveWorkspace,
  knownProfiles,
  getProfile,
  registerExternalDoc,
}: AppNavbarProps<TData>) {
  // Modal states
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // URL-based profile support
  const { openProfile } = useProfileUrl();

  const identities = doc?.identities || {};
  const workspaceProfile = identities[currentUserDid];
  // Prefer UserDocument profile (syncs across tabs), fallback to workspace identity
  const displayName = userDoc?.profile?.displayName || workspaceProfile?.displayName || currentUserDid.slice(0, 12) + '...';
  const avatarUrl = userDoc?.profile?.avatarUrl || workspaceProfile?.avatarUrl;

  const handleToggleVisibility = useCallback((did: string) => {
    onToggleUserVisibility?.(did);
  }, [onToggleUserVisibility]);

  return (
    <>
      <div className="navbar bg-base-100 shadow-lg z-[1100] flex-shrink-0 sticky top-0">
        {/* Left: Workspace Switcher or App Title */}
        <div className="navbar-start">
          {hideWorkspaceSwitcher ? (
            <span className="text-xl font-bold px-4">{appTitle || 'Narrative'}</span>
          ) : (
            <WorkspaceSwitcher
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              onSwitchWorkspace={onSwitchWorkspace}
              onNewWorkspace={onNewWorkspace}
              onOpenWorkspaceModal={() => setShowWorkspaceModal(true)}
              showStartEntry={workspaces.length > 0}
              isStart={isStart}
              onGoToStart={onGoToStart}
            />
          )}
        </div>

        {/* Center: Optional content (module tabs, etc.) */}
        <div className="navbar-center">
          {children}
        </div>

        {/* Right: User Menu */}
        <div className="navbar-end gap-2">
          <div className="flex items-center gap-2">
            <button
              className="w-11 h-11 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => openProfile(currentUserDid)}
              title="Profil"
            >
              <UserAvatar
                did={currentUserDid}
                avatarUrl={avatarUrl}
                size={44}
              />
            </button>
            <span
              className="hidden lg:block font-medium max-w-[120px] truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => openProfile(currentUserDid)}
            >
              {displayName}
            </span>
          </div>

          {/* Dropdown Menu */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-6 w-52 p-2 shadow"
            >
              <li>
                <a onClick={() => openProfile(currentUserDid)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Profil
                </a>
              </li>
              <li>
                <a onClick={() => setShowCollaboratorsModal(true)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Vertrauensnetzwerk
                </a>
              </li>
              <li>
                <a onClick={() => setShowVerifyModal(true)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 12v4a1 1 0 0 1-1 1h-4" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M17 8V7" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M7 17h.01" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <rect x="7" y="7" width="5" height="5" rx="1" />
                  </svg>
                  Scanner
                </a>
              </li>
              {onToggleDebugDashboard && (
                <>
                  <div className="divider my-1"></div>
                  <li>
                    <a onClick={onToggleDebugDashboard}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                        />
                      </svg>
                      Debug Dashboard
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* WorkspaceModal - only render when doc is available (workspace-specific) */}
      {doc && (
        <WorkspaceModal
          isOpen={showWorkspaceModal}
          onClose={() => setShowWorkspaceModal(false)}
          currentWorkspace={currentWorkspace}
          doc={doc}
          currentUserDid={currentUserDid}
          documentUrl={documentUrl}
          onUpdateWorkspace={onUpdateWorkspace}
          onShowToast={onShowToast}
          onUserClick={(did: string) => {
            setShowWorkspaceModal(false);
            openProfile(did);
          }}
          hiddenUserDids={hiddenUserDids}
          onToggleUserVisibility={handleToggleVisibility}
          userDoc={userDoc}
          trustedUserProfiles={trustedUserProfiles}
          onLeaveWorkspace={onLeaveWorkspace}
        />
      )}

      {/* Trust modals - work with userDoc, doc is optional */}
      <CollaboratorsModal
        isOpen={showCollaboratorsModal}
        onClose={() => setShowCollaboratorsModal(false)}
        doc={doc}
        currentUserDid={currentUserDid}
        hiddenUserDids={hiddenUserDids}
        onToggleUserVisibility={handleToggleVisibility}
        onTrustUser={onTrustUser}
        onUserClick={(did) => {
          setShowCollaboratorsModal(false);
          openProfile(did);
        }}
        userDoc={userDoc}
        trustedUserProfiles={trustedUserProfiles}
        knownProfiles={knownProfiles}
        getProfile={getProfile}
        registerExternalDoc={registerExternalDoc}
      />

      <QRScannerModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        doc={doc}
        currentUserDid={currentUserDid}
        onTrustUser={onTrustUser}
        userDocUrl={userDocUrl}
        userDoc={userDoc}
        onOpenProfile={onOpenProfile}
        onMutualTrustEstablished={onMutualTrustEstablished}
        knownProfiles={knownProfiles}
        getProfile={getProfile}
        registerExternalDoc={registerExternalDoc}
      />
    </>
  );
}
