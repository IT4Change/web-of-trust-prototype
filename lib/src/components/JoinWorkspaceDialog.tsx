/**
 * JoinWorkspaceDialog - Confirmation dialog when joining a new workspace
 *
 * Shows workspace info and asks user to confirm before joining.
 * On confirm: writes user identity to workspace
 * On decline: returns to start state
 */

import { useState } from 'react';
import type { BaseDocument } from '../schema/document';
import { UserAvatar } from './UserAvatar';

export interface JoinWorkspaceDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** The workspace document to join */
  doc: BaseDocument<unknown>;
  /** Current user's DID */
  currentUserDid: string;
  /** Workspace name */
  workspaceName?: string;
  /** Workspace avatar URL */
  workspaceAvatar?: string;
  /** List of DIDs already in the workspace */
  memberDids: string[];
  /** Callback when user confirms joining */
  onConfirm: () => void;
  /** Callback when user declines */
  onDecline: () => void;
}

export function JoinWorkspaceDialog({
  isOpen,
  doc,
  currentUserDid,
  workspaceName,
  workspaceAvatar,
  memberDids,
  onConfirm,
  onDecline,
}: JoinWorkspaceDialogProps) {
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsJoining(true);
    try {
      await onConfirm();
    } finally {
      setIsJoining(false);
    }
  };

  // Get member profiles from doc.identities
  const memberProfiles = memberDids
    .filter(did => did !== currentUserDid)
    .map(did => ({
      did,
      displayName: doc.identities?.[did]?.displayName,
      avatarUrl: doc.identities?.[did]?.avatarUrl,
    }))
    .slice(0, 5); // Show max 5 members

  const totalMembers = memberDids.filter(did => did !== currentUserDid).length;
  const hiddenMembersCount = Math.max(0, totalMembers - 5);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Workspace Avatar/Icon */}
        <div className="flex justify-center mb-4">
          {workspaceAvatar ? (
            <div className="w-20 h-20 rounded-xl overflow-hidden shadow-lg">
              <img
                src={workspaceAvatar}
                alt={workspaceName || 'Workspace'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl bg-primary/20 flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-primary">
                {(workspaceName || 'W').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-xl text-center mb-2">
          Workspace beitreten?
        </h3>

        {/* Workspace Name */}
        <p className="text-center text-lg mb-4">
          <span className="font-semibold">{workspaceName || 'Unbenannter Workspace'}</span>
        </p>

        {/* Member Info */}
        {totalMembers > 0 && (
          <div className="bg-base-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-base-content/70 mb-2">
              {totalMembers === 1
                ? '1 Mitglied'
                : `${totalMembers} Mitglieder`}
            </p>

            {/* Member Avatars */}
            <div className="flex items-center gap-1">
              {memberProfiles.map((member) => (
                <div
                  key={member.did}
                  className="tooltip"
                  data-tip={member.displayName || member.did.slice(0, 12) + '...'}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-base-100 -ml-2 first:ml-0">
                    <UserAvatar
                      did={member.did}
                      avatarUrl={member.avatarUrl}
                      size={32}
                    />
                  </div>
                </div>
              ))}
              {hiddenMembersCount > 0 && (
                <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-xs font-medium -ml-2 ring-2 ring-base-100">
                  +{hiddenMembersCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Text */}
        <p className="text-sm text-base-content/70 text-center mb-6">
          Wenn du beitrittst, wird dein Profil für alle Mitglieder sichtbar.
        </p>

        {/* Actions */}
        <div className="modal-action justify-center gap-3">
          <button
            className="btn btn-ghost"
            onClick={onDecline}
            disabled={isJoining}
          >
            Abbrechen
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Beitritt...
              </>
            ) : (
              'Beitreten'
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onDecline}></div>
    </div>
  );
}
