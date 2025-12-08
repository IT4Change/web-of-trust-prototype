/**
 * Central hook for managing all known user profiles
 *
 * This hook provides a single source of truth for user profiles from:
 * - Own profile (from userDoc.profile)
 * - 1st degree: Users I trust (trustGiven) and users who trust me (trustReceived)
 * - 2nd degree: Friends of friends (from loaded UserDocs' trust relationships)
 * - Workspace identities (as fallback)
 * - Externally registered docs (e.g., from QR scanner)
 *
 * Features:
 * - Reactive updates via Automerge subscriptions
 * - Profile signature verification
 * - 2-level deep network crawling
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Repo, DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';
import { verifyProfileSignature } from '../utils/signature';

/** Profile signature verification status */
export type ProfileSignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/** Source of profile data - indicates trust distance */
export type ProfileSource =
  | 'self' // Own profile
  | 'trust-given' // User I trust (1st degree)
  | 'trust-received' // User who trusts me (1st degree)
  | 'network-2nd' // Friend of a friend (2nd degree)
  | 'external' // Registered externally (e.g., QR scan before trust)
  | 'workspace'; // Workspace identity (fallback)

/** Known profile with metadata */
export interface KnownProfile {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  userDocUrl?: string;
  source: ProfileSource;
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

/** Status of a UserDoc being loaded */
export type DocLoadStatus = 'pending' | 'loading' | 'ready' | 'error' | 'timeout';

/** Debug info for a tracked UserDoc */
export interface TrackedDocInfo {
  url: string;
  expectedDid: string | null;
  source: ProfileSource;
  status: DocLoadStatus;
  startedAt: number;
  readyAt?: number;
  error?: string;
  attempt?: number;
}

/** Timeout for a single document loading attempt (ms) */
const DOC_LOAD_TIMEOUT = 8000;

/** Max retry attempts for document loading */
const MAX_RETRY_ATTEMPTS = 5;

/** Delay between retries (ms) - exponential backoff starting point */
const RETRY_DELAY_BASE = 1000;

/** Return type for useKnownProfiles hook */
export interface UseKnownProfilesResult {
  /** All known profiles indexed by DID */
  profiles: Map<string, KnownProfile>;
  /** Get a specific profile by DID */
  getProfile: (did: string) => KnownProfile | undefined;
  /** Whether initial loading is in progress */
  isLoading: boolean;
  /** Register an external UserDoc URL for reactive updates (e.g., from QR scanner) */
  registerExternalDoc: (userDocUrl: string) => void;
  /** Debug: All tracked UserDocs with their load status */
  trackedDocs: Map<string, TrackedDocInfo>;
}

// Internal type for subscription management
interface ProfileSubscription {
  handle: DocHandle<UserDocument>;
  handler: (payload: { doc: UserDocument }) => void;
  source: ProfileSource;
}

/**
 * Verify a user profile signature
 */
async function verifyUserProfileSignature(
  profile: { displayName?: string; avatarUrl?: string; updatedAt?: number; signature?: string },
  ownerDid: string
): Promise<ProfileSignatureStatus> {
  if (!profile.signature) {
    return 'missing';
  }

  try {
    const publicKeyBytes = extractPublicKeyFromDid(ownerDid);
    if (!publicKeyBytes) {
      return 'invalid';
    }

    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const result = await verifyProfileSignature(
      profile as { displayName: string; avatarUrl?: string; updatedAt?: number; signature?: string },
      publicKeyBase64
    );

    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

/**
 * Extract userDocUrls from a UserDocument's trust relationships
 */
function extractTrustUrls(
  userDoc: UserDocument | undefined
): { trustGiven: Map<string, string>; trustReceived: Map<string, string> } {
  const trustGiven = new Map<string, string>();
  const trustReceived = new Map<string, string>();

  if (!userDoc) {
    return { trustGiven, trustReceived };
  }

  // From trustGiven: users I trust - they provided trusteeUserDocUrl
  for (const [trusteeDid, attestation] of Object.entries(userDoc.trustGiven || {})) {
    if (attestation.trusteeUserDocUrl) {
      trustGiven.set(trusteeDid, attestation.trusteeUserDocUrl);
    }
  }

  // From trustReceived: users who trust me - they provided trusterUserDocUrl
  for (const [trusterDid, attestation] of Object.entries(userDoc.trustReceived || {})) {
    if (attestation.trusterUserDocUrl) {
      trustReceived.set(trusterDid, attestation.trusterUserDocUrl);
    }
  }

  return { trustGiven, trustReceived };
}

/**
 * Central hook for managing all known user profiles
 */
export function useKnownProfiles({
  repo,
  userDoc,
  currentUserDid,
  workspaceDoc,
}: UseKnownProfilesOptions): UseKnownProfilesResult {
  const [profiles, setProfiles] = useState<Map<string, KnownProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [trackedDocs, setTrackedDocs] = useState<Map<string, TrackedDocInfo>>(new Map());

  // Track subscriptions for cleanup
  const subscriptionsRef = useRef<Map<string, ProfileSubscription>>(new Map());

  // Track externally registered doc URLs (e.g., from QR scanner)
  const externalDocsRef = useRef<Set<string>>(new Set());

  // Track loaded 2nd degree DIDs to avoid re-loading
  const loaded2ndDegreeRef = useRef<Set<string>>(new Set());

  // Helper to update tracked doc status
  const updateTrackedDoc = useCallback(
    (url: string, update: Partial<TrackedDocInfo>) => {
      setTrackedDocs((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(url);
        if (existing) {
          newMap.set(url, { ...existing, ...update });
        } else if (update.expectedDid !== undefined && update.source !== undefined) {
          // New entry
          newMap.set(url, {
            url,
            expectedDid: update.expectedDid ?? null,
            source: update.source!,
            status: update.status ?? 'pending',
            startedAt: update.startedAt ?? Date.now(),
            ...update,
          });
        }
        return newMap;
      });
    },
    []
  );

  // Log tracked docs summary whenever it changes
  useEffect(() => {
    if (trackedDocs.size === 0) return;

    const summary = Array.from(trackedDocs.values()).map((doc) => ({
      url: doc.url.substring(0, 25) + '...',
      did: doc.expectedDid?.substring(0, 20) || '(unknown)',
      source: doc.source,
      status: doc.status,
      duration: doc.readyAt ? `${doc.readyAt - doc.startedAt}ms` : 'pending',
    }));

    console.log('[useKnownProfiles] Tracked docs:', summary);
    console.table(summary);
  }, [trackedDocs]);

  // Helper to update a profile in state
  const updateProfile = useCallback(
    (did: string, profile: Omit<KnownProfile, 'did'>) => {
      console.log('[useKnownProfiles] updateProfile called:', {
        did: did.substring(0, 30),
        displayName: profile.displayName,
        avatarUrl: !!profile.avatarUrl,
        source: profile.source,
        signatureStatus: profile.signatureStatus,
      });

      setProfiles((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(did);

        // Don't downgrade source priority (self > trust-given/trust-received > network-2nd > external > workspace)
        const sourcePriority: Record<ProfileSource, number> = {
          self: 5,
          'trust-given': 4,
          'trust-received': 4,
          'network-2nd': 3,
          external: 2,
          workspace: 1,
        };

        if (existing && sourcePriority[existing.source] > sourcePriority[profile.source]) {
          // Keep existing profile with higher priority source, but update profile data if new is fresher
          if (profile.lastUpdated > existing.lastUpdated) {
            console.log('[useKnownProfiles] Updating existing profile (fresher data):', did.substring(0, 30));
            newMap.set(did, {
              ...existing,
              displayName: profile.displayName ?? existing.displayName,
              avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
              signatureStatus: profile.signatureStatus,
              lastUpdated: profile.lastUpdated,
            });
          } else {
            console.log('[useKnownProfiles] Skipping update (existing has higher priority):', did.substring(0, 30));
          }
          return newMap;
        }

        console.log('[useKnownProfiles] Setting new profile:', did.substring(0, 30));
        newMap.set(did, { did, ...profile });
        return newMap;
      });
    },
    []
  );

  // Ref to track current profiles for 2nd degree checks (avoids dependency on profiles state)
  const profilesRef = useRef<Map<string, KnownProfile>>(new Map());

  // Keep profilesRef in sync with profiles state
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // Helper to process a loaded UserDoc and set up subscription
  const processLoadedDoc = useCallback(
    async (
      handle: DocHandle<UserDocument>,
      doc: UserDocument,
      docUrl: string,
      expectedDid: string | null,
      source: ProfileSource
    ) => {
      const did = doc.did;
      if (expectedDid && did !== expectedDid) {
        console.warn(`[useKnownProfiles] DID mismatch: expected ${expectedDid}, got ${did}`);
        return;
      }

      // Mark as ready
      updateTrackedDoc(docUrl, { status: 'ready', readyAt: Date.now() });

      const signatureStatus = doc.profile
        ? await verifyUserProfileSignature(doc.profile, did)
        : 'missing';

      updateProfile(did, {
        displayName: doc.profile?.displayName,
        avatarUrl: doc.profile?.avatarUrl,
        userDocUrl: docUrl,
        source,
        signatureStatus,
        lastUpdated: Date.now(),
      });

      // Set up change handler for reactive updates
      const changeHandler = async ({ doc: changedDoc }: { doc: UserDocument }) => {
        if (!changedDoc) return;

        console.log(`[useKnownProfiles] Change event for: ${docUrl.substring(0, 30)}...`);

        const changedSignatureStatus = changedDoc.profile
          ? await verifyUserProfileSignature(changedDoc.profile, changedDoc.did)
          : 'missing';

        updateProfile(changedDoc.did, {
          displayName: changedDoc.profile?.displayName,
          avatarUrl: changedDoc.profile?.avatarUrl,
          userDocUrl: docUrl,
          source,
          signatureStatus: changedSignatureStatus,
          lastUpdated: Date.now(),
        });
      };

      // Subscribe to future changes
      handle.on('change', changeHandler);
      subscriptionsRef.current.set(docUrl, { handle, handler: changeHandler, source });

      // For 1st degree connections, also crawl their trust relationships (2nd degree)
      if (source === 'trust-given' || source === 'trust-received') {
        const { trustGiven, trustReceived } = extractTrustUrls(doc);
        const secondDegreeUrls = new Map<string, string>();

        // Combine trust relationships for 2nd degree
        for (const [did2, url] of trustGiven) {
          if (did2 !== currentUserDid && !profilesRef.current.has(did2) && !loaded2ndDegreeRef.current.has(did2)) {
            secondDegreeUrls.set(did2, url);
          }
        }
        for (const [did2, url] of trustReceived) {
          if (did2 !== currentUserDid && !profilesRef.current.has(did2) && !loaded2ndDegreeRef.current.has(did2)) {
            secondDegreeUrls.set(did2, url);
          }
        }

        // Load 2nd degree profiles (in background, don't await)
        for (const [did2, url2] of secondDegreeUrls) {
          loaded2ndDegreeRef.current.add(did2);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          loadAndSubscribe(url2, did2, 'network-2nd');
        }
      }
    },
    [currentUserDid, updateProfile, updateTrackedDoc]
  );

  // Helper to load a UserDoc with retry logic (like AppShell pattern)
  // IMPORTANT: This callback must NOT depend on `profiles` to avoid infinite loops
  const loadAndSubscribe = useCallback(
    async (docUrl: string, expectedDid: string | null, source: ProfileSource) => {
      if (!repo) return null;

      // Skip if already subscribed
      if (subscriptionsRef.current.has(docUrl)) {
        return subscriptionsRef.current.get(docUrl)!.handle;
      }

      // Track this doc as loading
      const startedAt = Date.now();
      updateTrackedDoc(docUrl, {
        expectedDid,
        source,
        status: 'loading',
        startedAt,
        attempt: 1,
      });

      console.log(`[useKnownProfiles] Loading doc: ${docUrl.substring(0, 30)}... (expected DID: ${expectedDid?.substring(0, 20) || 'unknown'})`);

      // Create placeholder profile while loading
      if (expectedDid) {
        updateProfile(expectedDid, {
          displayName: undefined,
          avatarUrl: undefined,
          userDocUrl: docUrl,
          source,
          signatureStatus: 'pending',
          lastUpdated: Date.now(),
        });
      }

      // Retry loop with timeout (same pattern as AppShell)
      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          console.log(`[useKnownProfiles] Loading attempt ${attempt}/${MAX_RETRY_ATTEMPTS} for: ${docUrl.substring(0, 30)}...`);
          updateTrackedDoc(docUrl, { attempt });

          // Create timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Document load timeout')), DOC_LOAD_TIMEOUT);
          });

          // Use repo.find() with timeout (blocks until document is ready or timeout)
          const handle = await Promise.race([
            repo.find<UserDocument>(docUrl as AutomergeUrl),
            timeoutPromise,
          ]);

          // Verify document was actually loaded
          const doc = handle.doc();
          if (!doc) {
            throw new Error('Document not found or empty');
          }

          console.log(`[useKnownProfiles] Doc loaded successfully: ${docUrl.substring(0, 30)}...`);

          // Process the loaded document
          await processLoadedDoc(handle, doc, docUrl, expectedDid, source);

          return handle;
        } catch (err) {
          console.warn(`[useKnownProfiles] Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed for ${docUrl.substring(0, 30)}:`, err);

          if (attempt < MAX_RETRY_ATTEMPTS) {
            // Wait before retry with exponential backoff
            const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            console.log(`[useKnownProfiles] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // All retries failed
            console.error(`[useKnownProfiles] All ${MAX_RETRY_ATTEMPTS} attempts failed for: ${docUrl.substring(0, 30)}`);
            updateTrackedDoc(docUrl, { status: 'timeout', error: String(err) });
            return null;
          }
        }
      }

      return null;
    },
    [repo, updateProfile, updateTrackedDoc, processLoadedDoc]
  );

  // Register external doc (e.g., from QR scanner)
  const registerExternalDoc = useCallback(
    (userDocUrl: string) => {
      console.log(`[useKnownProfiles] registerExternalDoc called: ${userDocUrl.substring(0, 40)}...`);

      if (externalDocsRef.current.has(userDocUrl)) {
        console.log(`[useKnownProfiles] Doc already registered, skipping: ${userDocUrl.substring(0, 40)}...`);
        return;
      }
      externalDocsRef.current.add(userDocUrl);

      console.log(`[useKnownProfiles] Starting loadAndSubscribe for: ${userDocUrl.substring(0, 40)}...`);
      // Load and subscribe
      loadAndSubscribe(userDocUrl, null, 'external');
    },
    [loadAndSubscribe]
  );

  // Create stable keys for trust relationships (only changes when DIDs or URLs change)
  const trustGivenKey = useMemo(() => {
    if (!userDoc?.trustGiven) return '';
    return Object.entries(userDoc.trustGiven)
      .filter(([, att]) => att.trusteeUserDocUrl)
      .map(([did, att]) => `${did}:${att.trusteeUserDocUrl}`)
      .sort()
      .join('|');
  }, [userDoc?.trustGiven]);

  const trustReceivedKey = useMemo(() => {
    if (!userDoc?.trustReceived) return '';
    return Object.entries(userDoc.trustReceived)
      .filter(([, att]) => att.trusterUserDocUrl)
      .map(([did, att]) => `${did}:${att.trusterUserDocUrl}`)
      .sort()
      .join('|');
  }, [userDoc?.trustReceived]);

  // Compute 1st degree URLs from trust relationships
  // Uses stable keys to prevent unnecessary recalculations
  const firstDegreeUrls = useMemo(() => {
    const urls = new Map<string, { url: string; source: ProfileSource }>();

    if (!userDoc) return urls;

    // From trustReceived: users who trust me
    for (const [trusterDid, attestation] of Object.entries(userDoc.trustReceived || {})) {
      if (attestation.trusterUserDocUrl) {
        urls.set(trusterDid, { url: attestation.trusterUserDocUrl, source: 'trust-received' });
      }
    }

    // From trustGiven: users I trust (may override trustReceived source - both are 1st degree)
    for (const [trusteeDid, attestation] of Object.entries(userDoc.trustGiven || {})) {
      if (attestation.trusteeUserDocUrl) {
        urls.set(trusteeDid, { url: attestation.trusteeUserDocUrl, source: 'trust-given' });
      }
    }

    return urls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustGivenKey, trustReceivedKey]);

  // Create stable key for own profile (only changes when displayName, avatarUrl, or signature changes)
  const ownProfileKey = useMemo(() => {
    if (!userDoc?.profile) return '';
    return `${userDoc.profile.displayName || ''}|${userDoc.profile.avatarUrl || ''}|${userDoc.profile.signature || ''}`;
  }, [userDoc?.profile?.displayName, userDoc?.profile?.avatarUrl, userDoc?.profile?.signature]);

  // Load own profile
  useEffect(() => {
    if (!userDoc || !currentUserDid) return;

    const loadOwnProfile = async () => {
      const signatureStatus = userDoc.profile
        ? await verifyUserProfileSignature(userDoc.profile, currentUserDid)
        : 'missing';

      updateProfile(currentUserDid, {
        displayName: userDoc.profile?.displayName,
        avatarUrl: userDoc.profile?.avatarUrl,
        userDocUrl: undefined, // Own doc URL not needed
        source: 'self',
        signatureStatus,
        lastUpdated: Date.now(),
      });
    };

    loadOwnProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownProfileKey, currentUserDid, updateProfile]);

  // Load 1st degree profiles and subscribe to changes
  useEffect(() => {
    if (!repo) {
      setIsLoading(false);
      return;
    }

    // Cleanup subscriptions that are no longer in 1st degree
    const currentUrls = new Set(Array.from(firstDegreeUrls.values()).map((v) => v.url));
    for (const [url, subscription] of subscriptionsRef.current.entries()) {
      // Only cleanup 1st degree subscriptions that are no longer needed
      if (
        (subscription.source === 'trust-given' || subscription.source === 'trust-received') &&
        !currentUrls.has(url) &&
        !externalDocsRef.current.has(url)
      ) {
        subscription.handle.off('change', subscription.handler);
        subscriptionsRef.current.delete(url);
      }
    }

    if (firstDegreeUrls.size === 0) {
      setIsLoading(false);
      return;
    }

    const loadAllProfiles = async () => {
      setIsLoading(true);

      const loadPromises = Array.from(firstDegreeUrls.entries()).map(([did, { url, source }]) =>
        loadAndSubscribe(url, did, source)
      );

      await Promise.all(loadPromises);
      setIsLoading(false);
    };

    loadAllProfiles();

    // Cleanup on unmount
    return () => {
      for (const subscription of subscriptionsRef.current.values()) {
        subscription.handle.off('change', subscription.handler);
      }
      subscriptionsRef.current.clear();
      loaded2ndDegreeRef.current.clear();
    };
  }, [repo, firstDegreeUrls, loadAndSubscribe]);

  // Create stable key for workspace identities
  const workspaceIdentitiesKey = useMemo(() => {
    if (!workspaceDoc?.identities) return '';
    return Object.entries(workspaceDoc.identities)
      .map(([did, id]) => `${did}:${id.displayName || ''}:${id.avatarUrl || ''}`)
      .sort()
      .join('|');
  }, [workspaceDoc?.identities]);

  // Merge workspace identities as fallback
  // Use profilesRef to avoid dependency on profiles state (which would cause infinite loop)
  useEffect(() => {
    if (!workspaceDoc?.identities) return;

    for (const [did, identity] of Object.entries(workspaceDoc.identities)) {
      // Only add if not already known from a higher-priority source
      if (!profilesRef.current.has(did)) {
        updateProfile(did, {
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          userDocUrl: undefined,
          source: 'workspace',
          signatureStatus: 'missing', // Workspace identities have no signature
          lastUpdated: Date.now(),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceIdentitiesKey, updateProfile]);

  // Get profile helper
  const getProfile = useCallback(
    (did: string): KnownProfile | undefined => {
      return profiles.get(did);
    },
    [profiles]
  );

  return {
    profiles,
    getProfile,
    isLoading,
    registerExternalDoc,
    trackedDocs,
  };
}
