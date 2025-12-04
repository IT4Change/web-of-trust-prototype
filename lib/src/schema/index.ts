/**
 * Narrative schema exports
 *
 * This module re-exports all schema types and utilities.
 * Organized into modular files for better maintainability.
 */

// Identity types (shared across all apps)
export type {
  UserIdentity,
  IdentityProfile,
  TrustAttestation,
  TrustLevel,
} from './identity';

// Generic document structure (shared across all apps)
export type { BaseDocument, ContextMetadata } from './document';
export {
  createBaseDocument,
  generateId,
  addTrustAttestation,
  removeTrustAttestation,
  getTrustAttestations,
  getTrustAttestation,
} from './document';
