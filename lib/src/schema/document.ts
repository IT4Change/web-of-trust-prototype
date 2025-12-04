/**
 * Generic document structure shared by all Narrative apps
 *
 * This provides a common wrapper around app-specific data, ensuring all apps
 * have access to shared identity and trust infrastructure.
 */

import type { IdentityProfile, TrustAttestation, UserIdentity } from './identity';

/**
 * Context/Workspace metadata
 * Provides human-readable information about this collaboration space
 */
export interface ContextMetadata {
  /** Display name of this workspace/context */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional avatar/icon URL */
  avatar?: string;
}

/**
 * Base document structure shared by all Narrative apps
 * Wraps app-specific data with shared identity & trust infrastructure
 *
 * @template TData - App-specific data type (e.g., OpinionGraphData, MapData, or multi-module data)
 */
export interface BaseDocument<TData = unknown> {
  // Metadata
  version: string;
  lastModified: number;

  // Context information (for workspaces/multi-module support)
  context?: ContextMetadata;

  // Enabled modules (for multi-module documents)
  // Maps module ID to enabled state
  enabledModules?: Record<string, boolean>;

  // Identity (shared across all apps)
  identities: Record<string, IdentityProfile>;  // DID → profile

  // Web of Trust (shared across all apps)
  trustAttestations: Record<string, TrustAttestation>;

  // App-specific data (can be single module or multi-module)
  data: TData;
}

/**
 * Create empty base document with creator identity
 *
 * @param initialData - App-specific initial data
 * @param creatorIdentity - Identity of the user creating the document
 * @returns BaseDocument with initialized identity and empty trust attestations
 */
export function createBaseDocument<TData>(
  initialData: TData,
  creatorIdentity: UserIdentity
): BaseDocument<TData> {
  // Build identity profile from creator identity
  const profile: IdentityProfile = {};
  if (creatorIdentity.displayName !== undefined) {
    profile.displayName = creatorIdentity.displayName;
  }
  if (creatorIdentity.avatarUrl !== undefined) {
    profile.avatarUrl = creatorIdentity.avatarUrl;
  }
  if (creatorIdentity.publicKey !== undefined) {
    profile.publicKey = creatorIdentity.publicKey;
  }

  return {
    version: '1.0.0',
    lastModified: Date.now(),
    identities: {
      [creatorIdentity.did]: profile,
    },
    trustAttestations: {},
    data: initialData,
  };
}

/**
 * Generate a simple unique ID
 * Can be used for any entity (assumptions, votes, tags, etc.)
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function generateId(prefix?: string): string {
  const base = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  return prefix ? `${prefix}-${base}` : base;
}

/**
 * Generate unique ID for trust attestation
 */
function generateAttestationId(): string {
  return generateId('trust');
}

/**
 * Add or update trust attestation
 *
 * @param doc - Document to modify
 * @param trusterDid - DID of user making the trust attestation
 * @param trusteeDid - DID of user being trusted
 * @param level - Trust level ('verified' or 'endorsed')
 * @param verificationMethod - How trust was verified
 * @param notes - Optional notes about the trust relationship
 * @returns The created/updated attestation ID
 */
export function addTrustAttestation(
  doc: BaseDocument<any>,
  trusterDid: string,
  trusteeDid: string,
  level: 'verified' | 'endorsed',
  verificationMethod?: 'in-person' | 'video-call' | 'email' | 'social-proof',
  notes?: string
): string {
  console.log('[addTrustAttestation] START', {
    trusterDid,
    trusteeDid,
    level,
    verificationMethod,
    currentAttestationsCount: Object.keys(doc.trustAttestations).length,
    attestations: doc.trustAttestations
  });

  // Check if attestation already exists
  const existingId = Object.keys(doc.trustAttestations).find((id) => {
    const att = doc.trustAttestations[id];
    return att.trusterDid === trusterDid && att.trusteeDid === trusteeDid;
  });

  console.log('[addTrustAttestation] Existing attestation?', existingId);

  const now = Date.now();

  if (existingId) {
    // Update existing attestation
    console.log('[addTrustAttestation] UPDATING existing attestation');
    const att = doc.trustAttestations[existingId];
    att.level = level;
    if (verificationMethod !== undefined) {
      att.verificationMethod = verificationMethod;
    }
    if (notes !== undefined) {
      att.notes = notes;
    }
    att.updatedAt = now;
    console.log('[addTrustAttestation] DONE - Updated attestation:', existingId);
    return existingId;
  } else {
    // Create new attestation
    console.log('[addTrustAttestation] CREATING new attestation');
    const id = generateAttestationId();
    console.log('[addTrustAttestation] Generated ID:', id);

    // Create base attestation object
    const attestation: any = {
      id,
      trusterDid,
      trusteeDid,
      level,
      createdAt: now,
      updatedAt: now,
    };

    // Only set optional fields if they're defined (Automerge doesn't allow undefined)
    if (verificationMethod !== undefined) {
      attestation.verificationMethod = verificationMethod;
    }
    if (notes !== undefined) {
      attestation.notes = notes;
    }

    doc.trustAttestations[id] = attestation;

    console.log('[addTrustAttestation] DONE - Created attestation:', {
      id,
      attestation: doc.trustAttestations[id],
      totalCount: Object.keys(doc.trustAttestations).length
    });
    return id;
  }
}

/**
 * Remove trust attestation
 *
 * @param doc - Document to modify
 * @param trusterDid - DID of user who made the attestation
 * @param trusteeDid - DID of user being trusted
 * @returns true if attestation was removed, false if not found
 */
export function removeTrustAttestation(
  doc: BaseDocument<any>,
  trusterDid: string,
  trusteeDid: string
): boolean {
  const id = Object.keys(doc.trustAttestations).find((attestationId) => {
    const att = doc.trustAttestations[attestationId];
    return att.trusterDid === trusterDid && att.trusteeDid === trusteeDid;
  });

  if (id) {
    delete doc.trustAttestations[id];
    return true;
  }
  return false;
}

/**
 * Get all trust attestations made by a user
 *
 * @param doc - Document to query
 * @param trusterDid - DID of user who made attestations
 * @returns Array of attestations made by the user
 */
export function getTrustAttestations(
  doc: BaseDocument<any>,
  trusterDid: string
): TrustAttestation[] {
  return Object.values(doc.trustAttestations).filter(
    (att) => att.trusterDid === trusterDid
  );
}

/**
 * Check if one user trusts another
 *
 * @param doc - Document to query
 * @param trusterDid - DID of user checking trust
 * @param trusteeDid - DID of user to check
 * @returns Trust attestation if exists, undefined otherwise
 */
export function getTrustAttestation(
  doc: BaseDocument<any>,
  trusterDid: string,
  trusteeDid: string
): TrustAttestation | undefined {
  return Object.values(doc.trustAttestations).find(
    (att) => att.trusterDid === trusterDid && att.trusteeDid === trusteeDid
  );
}
