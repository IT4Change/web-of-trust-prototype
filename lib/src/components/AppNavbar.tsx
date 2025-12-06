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
import { ParticipantsModal } from './ParticipantsModal';
import { CollaboratorsModal } from './CollaboratorsModal';
import { QRScannerModal } from './QRScannerModal';
import {
  WorkspaceSwitcher,
  type WorkspaceInfo,
} from './WorkspaceSwitcher';
import { useProfileUrl } from '../hooks/useProfileUrl';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustedUserProfile } from '../hooks/useAppContext';

export interface AppNavbarProps<TData = unknown> {
  /** Current user's DID */
  currentUserDid: string;

  /** The Automerge document (for modals) */
  doc: BaseDocument<TData>;

  /** Logo URL for workspace switcher */
  logoUrl: string;

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

  /** Optional: Callback when share link is clicked (default: copy to clipboard) */
  onShareLink?: () => void;

  /** Optional: Show toast message */
  onShowToast?: (message: string) => void;

  /** User document for trust information (optional) */
  userDoc?: UserDocument | null;

  /**
   * Profiles loaded from trusted users' UserDocuments (optional)
   * Used as primary source for avatar/name of verified friends
   */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
}

export function AppNavbar<TData = unknown>({
  currentUserDid,
  doc,
  logoUrl,
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
  onShareLink,
  onShowToast,
  userDoc,
  trustedUserProfiles,
}: AppNavbarProps<TData>) {
  // Modal states
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // URL-based profile support
  const { openProfile } = useProfileUrl();

  const identities = doc.identities || {};
  const workspaceProfile = identities[currentUserDid];
  // Prefer UserDocument profile (syncs across tabs), fallback to workspace identity
  const displayName = userDoc?.profile?.displayName || workspaceProfile?.displayName || currentUserDid.slice(0, 12) + '...';
  const avatarUrl = userDoc?.profile?.avatarUrl || workspaceProfile?.avatarUrl;

  const handleShareLink = useCallback(() => {
    if (onShareLink) {
      onShareLink();
    } else {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      onShowToast?.('Link in Zwischenablage kopiert!');
    }
  }, [onShareLink, onShowToast]);

  const handleToggleVisibility = useCallback((did: string) => {
    onToggleUserVisibility?.(did);
  }, [onToggleUserVisibility]);

  return (
    <>
      <div className="navbar bg-base-100 shadow-lg z-[600] flex-shrink-0">
        {/* Left: Workspace Switcher or App Title */}
        <div className="navbar-start">
          {hideWorkspaceSwitcher ? (
            <span className="text-xl font-bold px-4">{appTitle || 'Narrative'}</span>
          ) : (
            <WorkspaceSwitcher
              currentWorkspace={currentWorkspace}
              workspaces={workspaces}
              logoUrl={logoUrl}
              onSwitchWorkspace={onSwitchWorkspace}
              onNewWorkspace={onNewWorkspace}
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
                <a onClick={() => setShowParticipantsModal(true)}>
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Teilnehmer
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
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                  Verify
                </a>
              </li>
              <div className="divider my-1"></div>
              <li>
                <a onClick={onNewWorkspace}>
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
                      d="M12 6v12m6-6H6"
                    />
                  </svg>
                  Neuer Workspace
                </a>
              </li>
              <li>
                <a onClick={handleShareLink}>
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Link teilen
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Integrated Modals */}
      <ParticipantsModal
        isOpen={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        doc={doc}
        currentUserDid={currentUserDid}
        hiddenUserDids={hiddenUserDids}
        onToggleUserVisibility={handleToggleVisibility}
        onUserClick={(did) => {
          setShowParticipantsModal(false);
          openProfile(did);
        }}
        userDoc={userDoc}
        trustedUserProfiles={trustedUserProfiles}
      />

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
      />

      <QRScannerModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        doc={doc}
        currentUserDid={currentUserDid}
        onTrustUser={onTrustUser}
      />
    </>
  );
}
