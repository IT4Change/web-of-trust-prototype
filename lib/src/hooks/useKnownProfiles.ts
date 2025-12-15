/**
 * useKnownProfiles - Central hook for managing all known user profiles
 *
 * This hook provides a single source of truth for user profiles from:
 * - Own profile (from userDoc.profile)
 * - 1st degree: Users I trust (trustGiven) and users who trust me (trustReceived)
 * - 2nd degree: Friends of friends (limited to 50)
 * - Workspace identities (as fallback)
 * - Externally registered docs (e.g., from QR scanner)
 *
 * IMPLEMENTATION NOTE:
 * This hook is now a thin wrapper around KnownProfilesProvider context.
 * The actual profile loading is done via React hooks (useDocument) in UserDocLoader components.
 * This ensures automatic reactivity without manual subscriptions.
 *
 * MIGRATION:
 * - For new code, prefer using KnownProfilesProvider + useKnownProfilesContext directly.
 * - This wrapper exists for backwards compatibility with existing components.
 */

import { useMemo } from 'react';
import type { Repo } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { useKnownProfilesContextOptional } from './useKnownProfilesContext';
import type { TrackedProfile } from '../providers/types';

// ============================================================================
// Type Exports (kept for backwards compatibility)
// ============================================================================

/** Profile signature verification status */
export type ProfileSignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/** How we discovered this profile (immutable after discovery) */
export type DiscoverySource =
  | 'self'        // Own profile
  | 'trust'       // From trust network (1st or 2nd degree)
  | 'external'    // QR scan, manual entry
  | 'workspace';  // Workspace member

/**
 * @deprecated Use DiscoverySource instead. Kept for backwards compatibility.
 * This type conflated "how we found the profile" with "what is the trust relationship"
 */
export type ProfileSource =
  | 'self' // Own profile
  | 'trust-given' // User I trust (1st degree)
  | 'trust-received' // User who trusts me (1st degree)
  | 'network-2nd' // Friend of a friend (2nd degree)
  | 'external' // Registered externally (e.g., QR scan before trust)
  | 'workspace'; // Workspace identity (fallback)

/** Known profile with computed trust flags */
export interface KnownProfile {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  userDocUrl?: string;
  /** How we discovered this profile */
  discoverySource: DiscoverySource;
  /** @deprecated Use isTrustGiven/isTrustReceived instead */
  source: ProfileSource;
  // Trust flags - computed from userDoc, not stored
  /** I trust this person (exists in userDoc.trustGiven) */
  isTrustGiven: boolean;
  /** This person trusts me (exists in userDoc.trustReceived) */
  isTrustReceived: boolean;
  /** Both directions - mutual trust */
  isMutualTrust: boolean;
  signatureStatus: ProfileSignatureStatus;
  lastUpdated: number;
}

/** Options for useKnownProfiles hook */
export interface UseKnownProfilesOptions {
  repo: Repo | null;
  userDoc: UserDocument | null;
  currentUserDid: string;
  workspaceDoc?: BaseDocument | null;
}

/** Return type for useKnownProfiles hook */
export interface UseKnownProfilesResult {
  /** All known profiles indexed by DID */
  profiles: Map<string, KnownProfile>;
  /** Get a specific profile by DID */
  getProfile: (did: string) => KnownProfile | undefined;
  /** Whether initial loading is in progress */
  isLoading: boolean;
  /** Register an external UserDoc URL for reactive updates (e.g., from QR scanner)
   * @param userDocUrl - The URL of the user's document
   * @param expectedDid - The DID we expect the document to contain
   * @param displayName - Optional display name from QR code (used as placeholder until document loads)
   */
  registerExternalDoc: (userDocUrl: string, expectedDid?: string, displayName?: string) => void;
}

// ============================================================================
// Helper: Convert TrackedProfile to KnownProfile with computed trust flags
// ============================================================================

function trackedToKnown(
  tracked: TrackedProfile,
  userDoc: UserDocument | null
): KnownProfile {
  const isTrustGiven = Boolean(userDoc?.trustGiven?.[tracked.did]);
  const isTrustReceived = Boolean(userDoc?.trustReceived?.[tracked.did]);

  return {
    did: tracked.did,
    displayName: tracked.displayName,
    avatarUrl: tracked.avatarUrl,
    userDocUrl: tracked.userDocUrl,
    discoverySource: tracked.discoverySource,
    source: tracked.source, // @deprecated
    isTrustGiven,
    isTrustReceived,
    isMutualTrust: isTrustGiven && isTrustReceived,
    signatureStatus: tracked.signatureStatus,
    lastUpdated: tracked.lastUpdated,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook that provides known profiles from the KnownProfilesProvider context.
 *
 * NOTE: This hook requires KnownProfilesProvider to be present in the component tree.
 * The options.userDoc is used to compute trust flags (isTrustGiven, isTrustReceived).
 *
 * @param options - Configuration options (userDoc is used for trust flag computation)
 * @returns Object with profiles, getProfile, isLoading, and registerExternalDoc
 */
export function useKnownProfiles(options: UseKnownProfilesOptions): UseKnownProfilesResult {
  const context = useKnownProfilesContextOptional();
  const { userDoc } = options;

  // Convert TrackedProfile to KnownProfile with computed trust flags
  // Trust flags are computed from userDoc.trustGiven and userDoc.trustReceived
  const profiles = useMemo(() => {
    if (!context) return new Map<string, KnownProfile>();

    const result = new Map<string, KnownProfile>();
    for (const [did, tracked] of context.profiles) {
      result.set(did, trackedToKnown(tracked, userDoc));
    }
    return result;
  }, [context?.profiles, userDoc?.trustGiven, userDoc?.trustReceived]);

  // Wrap getProfile to return KnownProfile with computed trust flags
  const getProfile = useMemo(() => {
    if (!context) return () => undefined;

    return (did: string): KnownProfile | undefined => {
      const tracked = context.getProfile(did);
      return tracked ? trackedToKnown(tracked, userDoc) : undefined;
    };
  }, [context?.getProfile, userDoc?.trustGiven, userDoc?.trustReceived]);

  // Return default values if context is not available
  if (!context) {
    console.warn(
      '[useKnownProfiles] KnownProfilesProvider not found in component tree. ' +
      'Profile loading will not work. Make sure to wrap your app with KnownProfilesProvider.'
    );
    return {
      profiles: new Map(),
      getProfile: () => undefined,
      isLoading: false,
      registerExternalDoc: () => {
        console.warn('[useKnownProfiles] Cannot register external doc - no provider found');
      },
    };
  }

  return {
    profiles,
    getProfile,
    isLoading: context.isLoading,
    registerExternalDoc: context.registerExternalDoc,
  };
}
