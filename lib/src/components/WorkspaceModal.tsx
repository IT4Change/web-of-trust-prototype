/**
 * WorkspaceModal - Modal for viewing and managing the current workspace
 *
 * Features:
 * - View/edit workspace name and avatar
 * - List of participants
 * - Share link
 * - Workspace settings
 */

import { useState, useCallback } from 'react';
import { UserListItem } from './UserListItem';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustedUserProfile } from '../hooks/useAppContext';
import type { WorkspaceInfo } from './WorkspaceSwitcher';
import { processImageFile } from '../utils/imageProcessing';

interface WorkspaceModalProps<TData = unknown> {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Current workspace info */
  currentWorkspace: WorkspaceInfo | null;
  /** The Automerge document */
  doc: BaseDocument<TData>;
  /** Current user's DID */
  currentUserDid: string;
  /** Document URL for sharing */
  documentUrl?: string;
  /** Callback to update workspace (name, avatar) */
  onUpdateWorkspace?: (updates: { name?: string; avatar?: string }) => void;
  /** Callback when share link is copied */
  onShareLink?: () => void;
  /** Show toast message */
  onShowToast?: (message: string) => void;
  /** Callback when clicking on a user */
  onUserClick?: (did: string) => void;
  /** Set of hidden user DIDs */
  hiddenUserDids?: Set<string>;
  /** Callback to toggle user visibility */
  onToggleUserVisibility?: (did: string) => void;
  /** User document for trust information */
  userDoc?: UserDocument | null;
  /** Profiles loaded from trusted users' UserDocuments */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
  /** Callback to leave the workspace */
  onLeaveWorkspace?: () => void;
}

export function WorkspaceModal<TData = unknown>({
  isOpen,
  onClose,
  currentWorkspace,
  doc,
  currentUserDid,
  documentUrl,
  onUpdateWorkspace,
  onShareLink,
  onShowToast,
  onUserClick,
  hiddenUserDids = new Set(),
  onToggleUserVisibility,
  userDoc,
  trustedUserProfiles = {},
  onLeaveWorkspace,
}: WorkspaceModalProps<TData>) {
  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentWorkspace?.name || '');
  const [avatarError, setAvatarError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const canEdit = !!onUpdateWorkspace;
  const displayName = currentWorkspace?.name || 'Workspace';
  const avatarUrl = currentWorkspace?.avatar;

  // Get participants from doc.identities
  const participants = Object.entries(doc.identities || {}).map(([did, profile]) => {
    const trustedProfile = trustedUserProfiles[did];
    return {
      did,
      displayName: trustedProfile?.displayName || profile?.displayName,
      avatarUrl: trustedProfile?.avatarUrl || profile?.avatarUrl,
      profileSignatureStatus: trustedProfile?.profileSignatureStatus,
    };
  });

  // Sort: current user first, then by name
  participants.sort((a, b) => {
    if (a.did === currentUserDid) return -1;
    if (b.did === currentUserDid) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  // Handle name save
  const handleSaveName = useCallback(() => {
    const trimmed = nameInput.trim();
    if (!trimmed || !onUpdateWorkspace) return;
    onUpdateWorkspace({ name: trimmed });
    setIsEditingName(false);
  }, [nameInput, onUpdateWorkspace]);

  // Handle avatar upload
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateWorkspace) return;

    setAvatarError('');

    try {
      const { dataUrl, sizeKB } = await processImageFile(file, 128, 0.8);

      if (sizeKB > 50) {
        setAvatarError(`Warnung: Avatar ist ${sizeKB}KB (empfohlen: max 50KB)`);
      }

      onUpdateWorkspace({ avatar: dataUrl });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Fehler beim Verarbeiten');
    }
  };

  // Handle avatar remove
  const handleRemoveAvatar = () => {
    if (!onUpdateWorkspace) return;
    onUpdateWorkspace({ avatar: '' });
    setAvatarError('');
  };

  // Handle share link
  const handleCopyLink = useCallback(() => {
    if (onShareLink) {
      onShareLink();
    } else if (documentUrl) {
      navigator.clipboard.writeText(documentUrl);
      onShowToast?.('Link in Zwischenablage kopiert!');
    }
  }, [onShareLink, documentUrl, onShowToast]);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-md">
        {/* Close button */}
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Workspace Header: Avatar + Name */}
        <div className="flex flex-col items-center mb-6 pt-2">
          {/* Avatar */}
          <div className="relative mb-3">
            {avatarUrl ? (
              <div className="w-20 h-20 rounded-xl overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary/20 flex items-center justify-center ring-2 ring-primary ring-offset-2 ring-offset-base-100">
                <span className="text-3xl font-bold text-primary">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Edit overlay for avatar */}
            {canEdit && (
              <>
                <label
                  htmlFor="workspace-avatar-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </label>
                <input
                  id="workspace-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileSelect}
                />
                {/* Remove avatar button */}
                {avatarUrl && (
                  <button
                    className="absolute -bottom-1 -right-2 w-7 h-7 bg-error rounded-lg flex items-center justify-center border-2 border-base-100 hover:bg-error/80 transition-colors"
                    onClick={handleRemoveAvatar}
                    title="Avatar entfernen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-error-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Name display or edit */}
          {canEdit && isEditingName ? (
            <div className="w-full max-w-[280px]">
              <input
                type="text"
                className="input input-bordered w-full text-center text-xl font-bold"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Workspace Name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setNameInput(displayName);
                    setIsEditingName(false);
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  className="btn btn-ghost btn-sm flex-1"
                  onClick={() => {
                    setNameInput(displayName);
                    setIsEditingName(false);
                  }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary btn-sm flex-1"
                  onClick={handleSaveName}
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{displayName}</h2>
              {canEdit && (
                <button
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={() => {
                    setNameInput(displayName);
                    setIsEditingName(true);
                  }}
                  title="Name bearbeiten"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {avatarError && (
            <div className="text-xs p-2 rounded mt-2 bg-warning/20 text-warning">
              {avatarError}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-6">
          {documentUrl && (
            <button
              className="btn btn-outline flex-1"
              onClick={handleCopyLink}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Link teilen
            </button>
          )}
        </div>

        {/* Participants Section */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm text-base-content/70 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Teilnehmer ({participants.length})
          </h3>

          <div className="space-y-1 max-h-[200px] overflow-y-auto bg-base-200 rounded-lg p-2">
            {participants.map(({ did, displayName, avatarUrl, profileSignatureStatus }) => (
              <UserListItem
                key={did}
                did={did}
                displayName={displayName}
                avatarUrl={avatarUrl}
                currentUserDid={currentUserDid}
                isHidden={hiddenUserDids.has(did)}
                outgoingTrust={userDoc?.trustGiven?.[did]}
                incomingTrust={userDoc?.trustReceived?.[did]}
                profileSignatureStatus={profileSignatureStatus}
                onUserClick={onUserClick}
                onToggleVisibility={onToggleUserVisibility}
                showVisibilityToggle={true}
                showTrustBadges={true}
                compact={true}
              />
            ))}

            {participants.length === 0 && (
              <div className="text-center py-4 text-base-content/50 text-sm">
                Noch keine Teilnehmer
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-action justify-between">
          {/* Leave Workspace - left side */}
          {onLeaveWorkspace && !showLeaveConfirm && (
            <button
              className="btn btn-ghost text-error"
              onClick={() => setShowLeaveConfirm(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Verlassen
            </button>
          )}

          {/* Leave confirmation */}
          {onLeaveWorkspace && showLeaveConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-error">Wirklich verlassen?</span>
              <button
                className="btn btn-error"
                onClick={() => {
                  onLeaveWorkspace();
                  onClose();
                }}
              >
                Ja
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Nein
              </button>
            </div>
          )}

          {/* Spacer when no leave button */}
          {!onLeaveWorkspace && <div />}

          {/* Close button - right side */}
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
