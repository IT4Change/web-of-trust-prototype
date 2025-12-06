/**
 * @deprecated Use UserProfileModal instead. This is a backward-compatible wrapper.
 */
import { UserProfileModal } from './UserProfileModal';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';

interface ProfileModalProps<TData = unknown> {
  isOpen: boolean;
  onClose: () => void;
  currentUserDid: string;
  doc: BaseDocument<TData>;
  /** UserDocument for consistent profile data (preferred source) */
  userDoc?: UserDocument | null;
  onUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
  onExportIdentity: () => void;
  onImportIdentity: () => void;
  onResetId: () => void;
  initialDisplayName?: string;
  /** User document URL for bidirectional trust synchronization */
  userDocUrl?: string;
}

/**
 * @deprecated Use UserProfileModal instead.
 * ProfileModal is now a wrapper around UserProfileModal for backward compatibility.
 */
export function ProfileModal<TData = unknown>({
  isOpen,
  onClose,
  currentUserDid,
  doc,
  userDoc,
  onUpdateIdentity,
  onExportIdentity,
  onImportIdentity,
  onResetId,
  userDocUrl,
}: ProfileModalProps<TData>) {
  return (
    <UserProfileModal
      did={currentUserDid}
      isOpen={isOpen}
      onClose={onClose}
      doc={doc}
      currentUserDid={currentUserDid}
      userDoc={userDoc}
      userDocUrl={userDocUrl}
      onUpdateIdentity={onUpdateIdentity}
      onExportIdentity={onExportIdentity}
      onImportIdentity={onImportIdentity}
      onResetIdentity={onResetId}
      hideTrustActions
    />
  );
}
