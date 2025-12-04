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
} from './schema';

export {
  // Generic document utilities
  createBaseDocument,
  generateId,
  // Trust attestation utilities
  addTrustAttestation,
  removeTrustAttestation,
  getTrustAttestations,
  getTrustAttestation,
} from './schema';

// Hooks exports
export { useRepository, type RepositoryOptions } from './hooks/useRepository';
export { useTrustNotifications } from './hooks/useTrustNotifications';

// Components exports
export { AppShell, type AppShellProps, type AppShellChildProps } from './components/AppShell';
export { LoadingScreen } from './components/LoadingScreen';
export { UserAvatar } from './components/UserAvatar';
export { ProfileModal } from './components/ProfileModal';
export { CollaboratorsModal } from './components/CollaboratorsModal';
export { QRScannerModal } from './components/QRScannerModal';
export { TrustReciprocityModal } from './components/TrustReciprocityModal';
export { Toast } from './components/Toast';

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
