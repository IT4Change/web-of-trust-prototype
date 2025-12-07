/**
 * Identity types shared across all Narrative apps
 *
 * These types define the DID-based identity system used for authentication
 * and Web of Trust features.
 */

/**
 * User identity (DID-based)
 * Uses real did:key with Ed25519 keypair (format: did:key:z6Mk...)
 */
export interface UserIdentity {
  did: string;          // did:key:z6Mk... (derived from Ed25519 public key)
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;   // Base64-encoded Ed25519 public key (32 bytes)
}

/**
 * Identity profile stored in document
 * Maps DID → profile information
 */
export interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;   // Base64-encoded Ed25519 public key for signature verification
}

/**
 * Trust attestation for Web of Trust
 * Represents a cryptographic assertion that one user trusts another
 *
 * Security: Attestations should be signed by the truster to prevent forgery.
 * Invalid signatures should be ignored at read time.
 */
export interface TrustAttestation {
  id: string;
  trusterDid: string;      // Who is trusting
  trusteeDid: string;      // Who is being trusted
  level: 'verified' | 'endorsed';
  verificationMethod?: 'in-person' | 'video-call' | 'email' | 'social-proof';
  notes?: string;          // Optional: "Met at conference 2025"
  createdAt: number;
  updatedAt: number;

  /**
   * UserDoc URL of the truster (for bidirectional trust)
   * Allows the trustee to resolve the truster's profile and
   * write back to truster's trustReceived when trust is reciprocated.
   */
  trusterUserDocUrl?: string;

  /**
   * UserDoc URL of the trustee (from QR code scan or incoming trust)
   * Allows the truster to load the trustee's profile from their UserDocument.
   * This is essential for cross-workspace trust relationships.
   */
  trusteeUserDocUrl?: string;

  /**
   * JWS signature proving this attestation was created by the truster
   * Format: header.payload.signature (compact serialization)
   * Signed payload excludes: signature field itself
   */
  signature?: string;
}

/**
 * Trust level calculated for a user
 */
export type TrustLevel =
  | 'verified'    // Direct attestation from trusted user
  | 'trusted'     // 2nd degree (friend-of-friend)
  | 'endorsed'    // 3rd degree (friend-of-friend-of-friend)
  | 'unknown'     // No trust path
  | 'blocked';    // Explicitly blocked
