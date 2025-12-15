/**
 * Type definitions for KnownProfilesProvider
 */

import type { ProfileSource, ProfileSignatureStatus, DiscoverySource } from '../hooks/useKnownProfiles';

/** Loading state for each profile */
export type ProfileLoadState = 'loading' | 'loaded' | 'unavailable';

/** Extended profile with load state tracking (internal use) */
export interface TrackedProfile {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  userDocUrl?: string;
  /** How we discovered this profile (immutable) */
  discoverySource: DiscoverySource;
  /** @deprecated Kept for backwards compatibility during transition */
  source: ProfileSource;
  signatureStatus: ProfileSignatureStatus;
  lastUpdated: number;
  loadState: ProfileLoadState;
  /** When this profile was first registered (for 2nd degree FIFO eviction) */
  registeredAt: number;
}

/** Document URL tracking metadata */
export interface DocUrlEntry {
  url: string;
  expectedDid: string | null;
  /** How we discovered this URL */
  discoverySource: DiscoverySource;
  /** @deprecated Kept for backwards compatibility */
  source: ProfileSource;
  loadState: ProfileLoadState;
  /** Timestamp when registered (for FIFO eviction) */
  registeredAt: number;
}

/** Context value for KnownProfilesProvider */
export interface KnownProfilesContextValue {
  /** All known profiles indexed by DID */
  profiles: Map<string, TrackedProfile>;
  /** Get a specific profile by DID */
  getProfile: (did: string) => TrackedProfile | undefined;
  /** Whether initial 1st-degree loading is in progress */
  isLoading: boolean;
  /** Register an external UserDoc URL for reactive updates (e.g., from QR scanner)
   * @param userDocUrl - The URL of the user's document
   * @param expectedDid - The DID we expect the document to contain
   * @param displayName - Optional display name from QR code (used as placeholder until document loads)
   */
  registerExternalDoc: (userDocUrl: string, expectedDid?: string, displayName?: string) => void;
}

/** Props for KnownProfilesProvider */
export interface KnownProfilesProviderProps {
  /** Automerge repository instance */
  repo: unknown | null;
  /** Current user's UserDocument (reactive) */
  userDoc: unknown | null;
  /** Current user's DID */
  currentUserDid: string;
  /** Workspace document for fallback identities */
  workspaceDoc?: unknown | null;
  /** Children to render */
  children: React.ReactNode;
}

/** Props for UserDocLoader component */
export interface UserDocLoaderProps {
  url: string;
  expectedDid: string | null;
  source: ProfileSource;
  onLoaded: (url: string, did: string, profile: { displayName?: string; avatarUrl?: string; updatedAt?: number; signature?: string }) => void;
  onUnavailable: (url: string) => void;
}

/** Maximum number of 2nd-degree profiles to load */
export const MAX_2ND_DEGREE_PROFILES = 50;

/** Source priority for profile merging */
export const SOURCE_PRIORITY: Record<ProfileSource, number> = {
  self: 5,
  'trust-given': 4,
  'trust-received': 4,
  'network-2nd': 3,
  external: 2,
  workspace: 1,
};
