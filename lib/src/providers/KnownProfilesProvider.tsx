/**
 * KnownProfilesProvider - Central provider for managing user profiles
 *
 * This provider manages all known user profiles from:
 * - Own profile (from userDoc.profile)
 * - 1st degree: Users I trust (trustGiven) and users who trust me (trustReceived)
 * - 2nd degree: Friends of friends (limited to MAX_2ND_DEGREE_PROFILES)
 * - External: Profiles registered via QR scanner
 * - Workspace: Fallback from workspace identities
 *
 * Uses React hooks (useDocument) for automatic reactivity instead of manual subscriptions.
 */

import React, { createContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Repo } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { UserDocLoader } from '../components/UserDocLoader';
import { verifyProfileSignature } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';
import type {
  KnownProfilesContextValue,
  KnownProfilesProviderProps,
  TrackedProfile,
  DocUrlEntry,
  ProfileLoadState,
} from './types';
import { MAX_2ND_DEGREE_PROFILES, SOURCE_PRIORITY } from './types';
import type { ProfileSource, ProfileSignatureStatus, DiscoverySource, KnownProfile } from '../hooks/useKnownProfiles';

// Create context with null default
export const KnownProfilesContext = createContext<KnownProfilesContextValue | null>(null);

/**
 * Verify profile signature and return status
 */
async function verifyUserProfileSignature(
  profile: UserDocument['profile'] | undefined,
  did: string
): Promise<ProfileSignatureStatus> {
  if (!profile?.signature) return 'missing';

  try {
    const publicKeyBytes = extractPublicKeyFromDid(did);
    if (!publicKeyBytes) return 'invalid';

    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const profileData = {
      displayName: profile.displayName || '',
      avatarUrl: profile.avatarUrl,
      updatedAt: profile.updatedAt,
      signature: profile.signature,
    };

    const result = await verifyProfileSignature(profileData, publicKeyBase64);
    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export function KnownProfilesProvider({
  repo,
  userDoc: userDocProp,
  currentUserDid,
  workspaceDoc: workspaceDocProp,
  children,
}: KnownProfilesProviderProps) {
  // Type assertions for internal use
  const userDoc = userDocProp as UserDocument | null;
  const workspaceDoc = workspaceDocProp as BaseDocument | null;

  // Core state: profiles indexed by DID
  const [profiles, setProfiles] = useState<Map<string, TrackedProfile>>(new Map());

  // Document URLs to load, with metadata
  const [docUrlRegistry, setDocUrlRegistry] = useState<Map<string, DocUrlEntry>>(new Map());

  // Track previous trust-given DIDs to detect external->trust-given transitions
  const prevTrustGivenDidsRef = useRef<Set<string>>(new Set());

  // Track loaded 2nd degree DIDs to prevent re-loading
  const loaded2ndDegreeDidsRef = useRef<Set<string>>(new Set());

  // === Helper: Update a single profile with source priority ===
  const updateProfile = useCallback(
    (
      did: string,
      update: Omit<TrackedProfile, 'did'>,
      options?: { force?: boolean }
    ) => {
      setProfiles((prev) => {
        const existing = prev.get(did);

        // Don't downgrade source priority unless forced
        if (existing && !options?.force) {
          if (SOURCE_PRIORITY[existing.source] > SOURCE_PRIORITY[update.source]) {
            // Keep higher-priority source but update profile data if newer
            if (update.lastUpdated > existing.lastUpdated) {
              const updated = new Map(prev);
              updated.set(did, {
                ...existing,
                displayName: update.displayName ?? existing.displayName,
                avatarUrl: update.avatarUrl ?? existing.avatarUrl,
                signatureStatus: update.signatureStatus,
                lastUpdated: update.lastUpdated,
                loadState: update.loadState,
              });
              return updated;
            }
            return prev;
          }
        }

        const updated = new Map(prev);
        updated.set(did, { did, ...update });
        return updated;
      });
    },
    []
  );

  // === Effect 1: Own profile from userDoc ===
  useEffect(() => {
    if (!userDoc || !currentUserDid) return;

    const loadOwnProfile = async () => {
      const signatureStatus = await verifyUserProfileSignature(userDoc.profile, currentUserDid);

      updateProfile(
        currentUserDid,
        {
          displayName: userDoc.profile?.displayName,
          avatarUrl: userDoc.profile?.avatarUrl,
          discoverySource: 'self',
          source: 'self', // @deprecated
          signatureStatus,
          lastUpdated: Date.now(),
          loadState: 'loaded',
          registeredAt: 0, // Self is never evicted
        },
        { force: true }
      );
    };

    loadOwnProfile();
  }, [userDoc?.profile?.displayName, userDoc?.profile?.avatarUrl, userDoc?.profile?.signature, currentUserDid, updateProfile]);

  // === Effect 2: Compute 1st-degree URLs from trust relationships ===
  useEffect(() => {
    if (!userDoc) return;

    const newFirstDegreeUrls = new Map<string, DocUrlEntry>();
    const newTrustGivenDids = new Set<string>();

    // From trustGiven: users I trust
    for (const [, attestation] of Object.entries(userDoc.trustGiven || {})) {
      const trusteeDid = attestation.trusteeDid;
      newTrustGivenDids.add(trusteeDid);

      if (attestation.trusteeUserDocUrl) {
        newFirstDegreeUrls.set(attestation.trusteeUserDocUrl, {
          url: attestation.trusteeUserDocUrl,
          expectedDid: trusteeDid,
          discoverySource: 'trust',
          source: 'trust-given', // @deprecated
          loadState: 'loading',
          registeredAt: Date.now(),
        });
      }
    }

    // From trustReceived: users who trust me
    for (const [, attestation] of Object.entries(userDoc.trustReceived || {})) {
      const trusterDid = attestation.trusterDid;

      if (attestation.trusterUserDocUrl && !newFirstDegreeUrls.has(attestation.trusterUserDocUrl)) {
        newFirstDegreeUrls.set(attestation.trusterUserDocUrl, {
          url: attestation.trusterUserDocUrl,
          expectedDid: trusterDid,
          discoverySource: 'trust',
          source: 'trust-received', // @deprecated
          loadState: 'loading',
          registeredAt: Date.now(),
        });
      }
    }

    // Update registry: handle external->trust-given transitions and add new 1st-degree URLs
    setDocUrlRegistry((prev) => {
      const updated = new Map(prev);

      // Remove external entries that are now in trust-given
      for (const [url, entry] of prev) {
        if (entry.source === 'external' && entry.expectedDid) {
          if (newTrustGivenDids.has(entry.expectedDid)) {
            // This external profile is now trust-given, remove external tracking
            updated.delete(url);
          }
        }
      }

      // Add/update 1st-degree URLs
      for (const [url, entry] of newFirstDegreeUrls) {
        const existing = updated.get(url);
        if (!existing || existing.source === 'external' || existing.source === 'workspace') {
          // Upgrade source or add new
          updated.set(url, {
            ...entry,
            loadState: existing?.loadState || 'loading',
            registeredAt: existing?.registeredAt || entry.registeredAt,
          });
        }
      }

      // Remove 1st-degree URLs that are no longer in trust relationships
      for (const [url, entry] of prev) {
        if (entry.source === 'trust-given' || entry.source === 'trust-received') {
          if (!newFirstDegreeUrls.has(url)) {
            updated.delete(url);
          }
        }
      }

      return updated;
    });

    prevTrustGivenDidsRef.current = newTrustGivenDids;
  }, [userDoc?.trustGiven, userDoc?.trustReceived]);

  // === Effect 3: Workspace identities as fallback ===
  useEffect(() => {
    if (!workspaceDoc?.identities) return;

    setProfiles((prev) => {
      const updated = new Map(prev);
      let hasChanges = false;

      for (const [did, identity] of Object.entries(workspaceDoc.identities)) {
        if (!updated.has(did)) {
          hasChanges = true;
          updated.set(did, {
            did,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
            discoverySource: 'workspace',
            source: 'workspace', // @deprecated
            signatureStatus: 'missing',
            lastUpdated: Date.now(),
            loadState: 'loaded',
            registeredAt: Date.now(),
          });
        }
      }

      return hasChanges ? updated : prev;
    });
  }, [workspaceDoc?.identities]);

  // === Callback: Register external doc (from QR scanner) ===
  const registerExternalDoc = useCallback((userDocUrl: string, expectedDid?: string, displayName?: string) => {
    setDocUrlRegistry((prev) => {
      if (prev.has(userDocUrl)) return prev;

      const updated = new Map(prev);
      updated.set(userDocUrl, {
        url: userDocUrl,
        expectedDid: expectedDid || null,
        discoverySource: 'external',
        source: 'external', // @deprecated
        loadState: 'loading',
        registeredAt: Date.now(),
      });
      return updated;
    });

    // Create placeholder profile with scanned name if we have both DID and name
    // This ensures the name from QR code is immediately available in all views
    if (expectedDid && displayName) {
      setProfiles((prev) => {
        const existing = prev.get(expectedDid);
        // Only create placeholder if no profile exists yet, or existing has no displayName
        if (!existing || (!existing.displayName && existing.discoverySource === 'external')) {
          const updated = new Map(prev);
          updated.set(expectedDid, {
            did: expectedDid,
            displayName,
            avatarUrl: undefined,
            userDocUrl,
            discoverySource: 'external',
            source: 'external', // @deprecated
            signatureStatus: 'pending',
            lastUpdated: Date.now(),
            loadState: 'loading',
            registeredAt: Date.now(),
          });
          return updated;
        }
        return prev;
      });
    }
  }, []);

  // === Callback: Handle loaded document (from UserDocLoader) ===
  const handleDocLoaded = useCallback(
    async (
      url: string,
      did: string,
      profile: { displayName?: string; avatarUrl?: string; updatedAt?: number; signature?: string }
    ) => {
      // Get the entry to know the source
      const entry = docUrlRegistry.get(url);
      const discoverySource = entry?.discoverySource || 'external';
      const source = entry?.source || 'external'; // @deprecated

      // Update registry with load state
      setDocUrlRegistry((prev) => {
        const existingEntry = prev.get(url);
        if (!existingEntry) return prev;

        const updated = new Map(prev);
        updated.set(url, { ...existingEntry, loadState: 'loaded', expectedDid: did });
        return updated;
      });

      // Verify signature
      const signatureStatus = await verifyUserProfileSignature(
        { displayName: profile.displayName, avatarUrl: profile.avatarUrl, updatedAt: profile.updatedAt, signature: profile.signature },
        did
      );

      // Update profile
      updateProfile(did, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        userDocUrl: url,
        discoverySource,
        source, // @deprecated
        signatureStatus,
        lastUpdated: Date.now(),
        loadState: 'loaded',
        registeredAt: entry?.registeredAt || Date.now(),
      });

      // For 1st-degree profiles, crawl 2nd-degree
      if (discoverySource === 'trust') {
        // We need to get the full doc to extract trust URLs
        // The UserDocLoader only gives us profile data, so we rely on the doc being in the repo
        // For now, we'll skip 2nd-degree crawling here and handle it separately
        // TODO: Consider passing full doc or trust URLs through callback
      }
    },
    [docUrlRegistry, updateProfile]
  );

  // === Effect 4: Crawl 2nd-degree profiles from loaded 1st-degree docs ===
  // This effect watches profiles and looks for opportunities to load 2nd-degree
  useEffect(() => {
    if (!repo || !userDoc) return;

    const crawl2ndDegree = async () => {
      // Get all 1st-degree DIDs that are loaded
      const firstDegreeDids = new Set<string>();
      for (const [, entry] of docUrlRegistry) {
        if ((entry.source === 'trust-given' || entry.source === 'trust-received') && entry.loadState === 'loaded' && entry.expectedDid) {
          firstDegreeDids.add(entry.expectedDid);
        }
      }

      // For each 1st-degree profile, check their trust relationships
      for (const [, entry] of docUrlRegistry) {
        if (entry.source !== 'trust-given' && entry.source !== 'trust-received') continue;
        if (entry.loadState !== 'loaded' || !entry.expectedDid) continue;

        // We need to access the loaded doc from the profile data
        // Since we can't access the full doc through the loader callback,
        // we'll need to rely on the profiles Map and infer 2nd-degree from there
        // This is a limitation - we may need to enhance the approach

        // For now, skip automatic 2nd-degree crawling
        // The profile data is already reactive through useDocument
      }
    };

    crawl2ndDegree();
  }, [repo, userDoc, docUrlRegistry, profiles]);

  // === Callback: Handle unavailable document ===
  const handleDocUnavailable = useCallback((url: string) => {
    // Update registry with unavailable state
    setDocUrlRegistry((prev) => {
      const entry = prev.get(url);
      if (!entry) return prev;

      const updated = new Map(prev);
      updated.set(url, { ...entry, loadState: 'unavailable' });
      return updated;
    });

    // Update profile if we have expectedDid
    const entry = docUrlRegistry.get(url);
    if (entry?.expectedDid) {
      setProfiles((prev) => {
        const profile = prev.get(entry.expectedDid!);
        if (!profile) return prev;

        const updated = new Map(prev);
        updated.set(entry.expectedDid!, {
          ...profile,
          loadState: 'unavailable',
        });
        return updated;
      });
    }
  }, [docUrlRegistry]);

  // === Compute loading state ===
  const isLoading = useMemo(() => {
    for (const entry of docUrlRegistry.values()) {
      if (entry.source === 'trust-given' || entry.source === 'trust-received') {
        if (entry.loadState === 'loading') return true;
      }
    }
    return false;
  }, [docUrlRegistry]);

  // === Get profile helper ===
  const getProfile = useCallback((did: string) => profiles.get(did), [profiles]);

  // === Context value ===
  const contextValue = useMemo<KnownProfilesContextValue>(
    () => ({
      profiles,
      getProfile,
      isLoading,
      registerExternalDoc,
    }),
    [profiles, getProfile, isLoading, registerExternalDoc]
  );

  // === Render invisible loaders ===
  const loaders = useMemo(() => {
    if (!repo) return null;

    return Array.from(docUrlRegistry.entries()).map(([url, entry]) => (
      <UserDocLoader
        key={url}
        url={url}
        expectedDid={entry.expectedDid}
        source={entry.source}
        onLoaded={handleDocLoaded}
        onUnavailable={handleDocUnavailable}
      />
    ));
  }, [repo, docUrlRegistry, handleDocLoaded, handleDocUnavailable]);

  return (
    <KnownProfilesContext.Provider value={contextValue}>
      {loaders}
      {children}
    </KnownProfilesContext.Provider>
  );
}
