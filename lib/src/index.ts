/**
 * Narrative UI Library
 *
 * Shared infrastructure for Narrative apps including:
 * - Schema definitions (BaseDocument, OpinionGraph, Identity, Trust)
 * - React hooks (useOpinionGraph, useRepository)
 * - React components (AppShell, LoadingScreen, ProfileModal, etc.)
 * - Utilities (DID generation, signatures, storage, image processing)
 */

// Schema exports
export type {
  // Identity types (shared across all apps)
  UserIdentity,
  IdentityProfile,
  TrustAttestation,
  TrustLevel,
  // Generic document structure
  BaseDocument,
  ContextMetadata,
  // User Document (personal, cross-workspace)
  UserDocument,
  UserProfile,
  Voucher,
  WorkspaceRef,
} from './schema';

export {
  // Generic document utilities
  createBaseDocument,
  generateId,
  // User Document utilities (trust attestations are now here)
  createUserDocument,
  addWorkspace,
  removeWorkspace,
  touchWorkspace,
  updateUserProfile,
  addTrustGiven,
  removeTrustGiven,
  addTrustReceived,
  removeTrustReceived,
} from './schema';

// Hooks exports
export { useRepository, type RepositoryOptions } from './hooks/useRepository';
export { useTrustNotifications } from './hooks/useTrustNotifications';
export { useAppContext, type UseAppContextOptions, type AppContextValue, type TrustedUserProfile } from './hooks/useAppContext';
export {
  useUserDocument,
  loadUserDocId,
  saveUserDocId,
  clearUserDocId,
  type UseUserDocumentOptions,
  type UseUserDocumentResult,
} from './hooks/useUserDocument';
export { useProfileUrl } from './hooks/useProfileUrl';
export {
  useCrossTabSync,
  notifyCrossTabSync,
  getCrossTabState,
  broadcastProfileUpdate,
  broadcastIdentityChange,
  broadcastUserDocChange,
  type CrossTabSyncOptions,
} from './hooks/useCrossTabSync';
export {
  useDocumentChanges,
  type ChangeEntry,
  type EntityType,
  type ChangePriority,
  type UseDocumentChangesOptions,
  type UseDocumentChangesResult,
} from './hooks/useDocumentChanges';

// Components exports
export { AppShell, type AppShellProps, type AppShellChildProps } from './components/AppShell';
export { AppNavbar, type AppNavbarProps } from './components/AppNavbar';
export {
  WorkspaceSwitcher,
  loadWorkspaceList,
  saveWorkspaceList,
  upsertWorkspace,
  type WorkspaceInfo,
} from './components/WorkspaceSwitcher';
export { LoadingScreen } from './components/LoadingScreen';
export { UserAvatar } from './components/UserAvatar';
export { ProfileModal } from './components/ProfileModal';
export { CollaboratorsModal } from './components/CollaboratorsModal';
export { ParticipantsModal } from './components/ParticipantsModal';
export { UserListItem, type UserListItemProps } from './components/UserListItem';
export { QRScannerModal } from './components/QRScannerModal';
export { TrustReciprocityModal } from './components/TrustReciprocityModal';
export { UserProfileModal, type ProfileAction } from './components/UserProfileModal';
export { ClickableUserName } from './components/ClickableUserName';
export { Toast } from './components/Toast';
export { NewWorkspaceModal, type NewWorkspaceModalProps } from './components/NewWorkspaceModal';
export { AppLayout, type AppLayoutProps } from './components/AppLayout';
export { Confetti } from './components/Confetti';
export { DebugDashboard } from './components/DebugDashboard';
export { TrustGraph, type TrustGraphProps } from './components/TrustGraph';

// DID utilities exports
export {
  generateKeypair,
  generateDidIdentity,
  deriveDidFromPublicKey,
  extractPublicKeyFromDid,
  isFakeDid,
  isValidDid,
  base64Encode,
  base64Decode,
  getDefaultDisplayName,
  type Keypair,
  type DidIdentity,
} from './utils/did';

// Signature utilities exports
export {
  signJws,
  verifyJws,
  extractJwsPayload,
  signEntity,
  verifyEntitySignature,
} from './utils/signature';

// Storage utilities exports
export type { StoredIdentity } from './utils/storage';
export {
  loadSharedIdentity,
  saveSharedIdentity,
  clearSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  clearDocumentId,
  exportIdentityToFile,
  importIdentityFromFile,
} from './utils/storage';

// Image processing utilities exports
export {
  processImageFile,
  isAvatarSizeValid,
} from './utils/imageProcessing';

// Module system exports
export type {
  ModuleContext,
  ModuleProps,
  ModuleDefinition,
} from './modules/types';

// Debug utilities exports
export {
  initDebugTools,
  updateDebugState,
  type NarrativeDebug,
} from './utils/debug';

// Time formatting utilities exports
export {
  formatRelativeTime,
  formatFullDateTime,
} from './utils/time';
