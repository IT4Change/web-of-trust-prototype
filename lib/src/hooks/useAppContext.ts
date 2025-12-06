/**
 * useAppContext - Centralized hook for app-wide state management
 *
 * Manages:
 * - Identity (loading, saving, updating)
 * - Workspaces (list, switching, creating)
 * - Hidden users
 * - Trust attestations + notifications (from User-Doc)
 * - Toast notifications
 * - All standard modal props (TrustReciprocityModal, NewWorkspaceModal, Toast)
 *
 * Apps should use this hook and simply spread the provided props to components.
 * No manual state management or handlers needed for standard functionality.
 *
 * Trust Source: User document (userDoc.trustGiven/trustReceived)
 * Trust attestations are stored in the personal UserDocument, not workspace documents.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DocHandle, AutomergeUrl, Repo } from '@automerge/automerge-repo';
import { useProfileUrl } from './useProfileUrl';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  type StoredIdentity,
} from '../utils/storage';
import {
  loadWorkspaceList,
  saveWorkspaceList,
  upsertWorkspace,
  type WorkspaceInfo,
} from '../components/WorkspaceSwitcher';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import type { UserDocument } from '../schema/userDocument';
import { addTrustGiven, addTrustReceived, removeTrustGiven, updateUserProfile } from '../schema/userDocument';
import { signEntity, verifyEntitySignature } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';
import { updateDebugState } from '../utils/debug';
import { broadcastProfileUpdate } from './useCrossTabSync';

// Storage key for seen trust attestations
const TRUST_STORAGE_KEY = 'narrativeTrustNotifications';

interface SeenAttestations {
  [documentId: string]: string[];
}

function getSeenAttestations(documentId: string): Set<string> {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    if (!stored) return new Set();
    const data: SeenAttestations = JSON.parse(stored);
    return new Set(data[documentId] || []);
  } catch {
    return new Set();
  }
}

function markAttestationsAsSeen(documentId: string, attestationIds: string[]): void {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    const data: SeenAttestations = stored ? JSON.parse(stored) : {};
    if (!data[documentId]) {
      data[documentId] = [];
    }
    const currentSet = new Set(data[documentId]);
    attestationIds.forEach(id => currentSet.add(id));
    data[documentId] = Array.from(currentSet);
    localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Verify an attestation's signature
 * Returns true if valid, false if invalid or missing signature
 */
async function verifyAttestationSignature(attestation: TrustAttestation): Promise<boolean> {
  if (!attestation.signature) {
    console.warn('🔐 Attestation has no signature:', attestation.id);
    return false;
  }

  try {
    // Extract public key from truster's DID
    const publicKeyBytes = extractPublicKeyFromDid(attestation.trusterDid);
    if (!publicKeyBytes) {
      console.warn('🔐 Could not extract public key from DID:', attestation.trusterDid);
      return false;
    }

    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const result = await verifyEntitySignature(
      attestation as unknown as Record<string, unknown>,
      publicKeyBase64
    );

    if (!result.valid) {
      console.warn('🔐 Invalid signature for attestation:', attestation.id, result.error);
    }

    return result.valid;
  } catch (err) {
    console.error('🔐 Error verifying attestation signature:', err);
    return false;
  }
}

export interface UseAppContextOptions<TData = unknown> {
  /** The Automerge document */
  doc: BaseDocument<TData> | null | undefined;

  /** The Automerge document handle for mutations */
  docHandle: DocHandle<BaseDocument<TData>> | null | undefined;

  /** Document ID as string (for workspace tracking and trust notifications) */
  documentId: string;

  /** Current user's DID (required for trust features) */
  currentUserDid?: string;

  /** App title shown in navbar (when workspace switcher is hidden) */
  appTitle?: string;

  /** Workspace name for this document */
  workspaceName?: string;

  /** Whether to hide the workspace switcher (simple single-doc apps) */
  hideWorkspaceSwitcher?: boolean;

  /** Logo URL for workspace switcher */
  logoUrl?: string;

  /** Callback when identity needs to be reset */
  onResetIdentity?: () => void;

  /**
   * Callback when a new workspace is created via the modal.
   * If provided, the modal will be available and this will be called with the name and optional avatar.
   */
  onCreateWorkspace?: (name: string, avatarDataUrl?: string) => void;

  /** Callback to update identity in the document (app-specific) */
  onUpdateIdentityInDoc?: (updates: { displayName?: string; avatarUrl?: string }) => void;

  /**
   * User Document handle for personal trust attestations (optional)
   * When provided, trust operations use User-Doc instead of Workspace-Doc
   */
  userDocHandle?: DocHandle<UserDocument>;

  /**
   * User Document for reading trust data (optional)
   * Reactive document from useDocument hook
   */
  userDoc?: UserDocument | null;

  /**
   * User Document URL for bidirectional trust sync (optional)
   * Included in QR code so others can write to our trustReceived
   */
  userDocUrl?: string;

  /**
   * Automerge Repo for finding other user documents (optional)
   * Required for bidirectional trust sync
   */
  repo?: Repo;
}

/**
 * Profile data loaded from a trusted user's UserDocument
 */
export interface TrustedUserProfile {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  /** The UserDoc URL (for reference) */
  userDocUrl?: string;
  /** When the profile was last fetched */
  fetchedAt: number;
}

export interface AppContextValue<TData = unknown> {
  // Identity
  identity: StoredIdentity | null;
  currentUserDid: string;

  // Workspaces
  workspaces: WorkspaceInfo[];
  currentWorkspace: WorkspaceInfo | null;

  // UI State
  hiddenUserDids: Set<string>;
  toastMessage: string | null;
  isNewWorkspaceModalOpen: boolean;

  // Trust notifications
  pendingAttestations: TrustAttestation[];
  hasPendingTrust: boolean;

  /**
   * Profiles loaded from trusted users' UserDocuments
   * Key is the DID, value is the profile data
   * Use this for displaying avatars/names of verified friends
   */
  trustedUserProfiles: Record<string, TrustedUserProfile>;

  // Handlers
  handleSwitchWorkspace: (workspaceId: string) => void;
  handleNewWorkspace: () => void;
  handleUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
  handleTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
  handleRevokeTrust: (did: string) => void;
  handleTrustBack: (trusterDid: string) => void;
  handleDeclineTrust: (attestationId: string) => void;
  handleResetIdentity: () => void;
  toggleUserVisibility: (did: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  openNewWorkspaceModal: () => void;
  closeNewWorkspaceModal: () => void;
  handleCreateWorkspace: (name: string, avatarDataUrl?: string) => void;

  // Profile viewing
  openProfile: (did: string) => void;

  // Props ready for components - just spread these!
  navbarProps: {
    currentUserDid: string;
    doc: BaseDocument<TData>;
    logoUrl: string;
    currentWorkspace: WorkspaceInfo | null;
    workspaces: WorkspaceInfo[];
    onSwitchWorkspace: (workspaceId: string) => void;
    onNewWorkspace: () => void;
    onTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
    onToggleUserVisibility: (did: string) => void;
    hiddenUserDids: Set<string>;
    onShowToast: (message: string) => void;
    hideWorkspaceSwitcher?: boolean;
    appTitle?: string;
    userDoc?: UserDocument | null;
    trustedUserProfiles?: Record<string, TrustedUserProfile>;
  } | null;

  newWorkspaceModalProps: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, avatarDataUrl?: string) => void;
  };

  trustReciprocityModalProps: {
    pendingAttestations: TrustAttestation[];
    doc: BaseDocument<TData>;
    currentUserDid: string;
    onTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
    onDecline: (attestationId: string) => void;
    onShowToast: (message: string) => void;
  } | null;

  toastProps: {
    message: string;
    type: 'success';
    onClose: () => void;
  } | null;
}

export function useAppContext<TData = unknown>(
  options: UseAppContextOptions<TData>
): AppContextValue<TData> {
  const {
    doc,
    docHandle,
    documentId,
    currentUserDid: providedUserDid,
    appTitle,
    workspaceName = 'Workspace',
    hideWorkspaceSwitcher = false,
    logoUrl = '/logo.svg',
    onResetIdentity,
    onCreateWorkspace,
    onUpdateIdentityInDoc,
    userDocHandle,
    userDoc,
    userDocUrl,
    repo,
  } = options;

  // Identity state
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => loadSharedIdentity());

  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>(() => loadWorkspaceList());

  // UI state
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);

  // Trust notifications state
  const [pendingAttestations, setPendingAttestations] = useState<TrustAttestation[]>([]);

  // Trusted user profiles (loaded from their UserDocs)
  const [trustedUserProfiles, setTrustedUserProfiles] = useState<Record<string, TrustedUserProfile>>({});

  // Subscription tracking for trusted user profiles
  // Maps userDocUrl -> { handle, handler } for cleanup via handle.off()
  const profileSubscriptionsRef = useRef<Map<string, {
    handle: DocHandle<UserDocument>;
    handler: (payload: { doc: UserDocument }) => void;
  }>>(new Map());

  // URL-based profile support
  const { openProfile } = useProfileUrl();

  // Current user DID - prefer provided, fallback to identity
  const currentUserDid = providedUserDid ?? identity?.did ?? '';

  // Get workspace name and avatar from document context (prefer doc.context over props)
  const docContext = (doc as BaseDocument<TData> | null)?.context;
  const effectiveWorkspaceName = docContext?.name || workspaceName;
  const workspaceAvatar = docContext?.avatar;

  // Track current workspace in list
  // Use a ref to track last saved values to avoid infinite loops
  const [lastSavedWorkspaceKey, setLastSavedWorkspaceKey] = useState('');

  useEffect(() => {
    if (!doc || !documentId) return;

    // Create a stable key to check if we need to update
    const currentKey = `${documentId}|${effectiveWorkspaceName}|${workspaceAvatar || ''}`;
    if (currentKey === lastSavedWorkspaceKey) {
      return;
    }

    const workspaceInfo: WorkspaceInfo = {
      id: documentId,
      name: effectiveWorkspaceName,
      lastAccessed: Date.now(),
      ...(workspaceAvatar && { avatar: workspaceAvatar }),
    };

    setWorkspaces((prev) => {
      const updated = upsertWorkspace(prev, workspaceInfo);
      saveWorkspaceList(updated);
      return updated;
    });
    setLastSavedWorkspaceKey(currentKey);
  }); // No dependencies - we check manually with lastSavedWorkspaceKey

  // Update debug state when documents change (for console debugging)
  useEffect(() => {
    updateDebugState({
      userDoc: userDoc ?? null,
      userDocUrl: userDocUrl ?? null,
      doc: doc as BaseDocument<unknown> | null,
      docUrl: documentId ? `automerge:${documentId}` : null,
      repo,
      trustedUserProfiles,
    });
  }, [doc, userDoc, repo, userDocUrl, documentId, trustedUserProfiles]);

  // Register own identity in workspace identityLookup on join
  // Use a key to track last saved values and avoid infinite loops
  const [lastIdentityLookupKey, setLastIdentityLookupKey] = useState('');

  useEffect(() => {
    if (!docHandle || !identity || !doc) return;

    // Create a stable key for what we want to save
    const desiredKey = `${identity.did}|${identity.displayName || ''}|${identity.avatarUrl || ''}|${userDocUrl || ''}`;

    // Check if we already saved this
    if (desiredKey === lastIdentityLookupKey) {
      return;
    }

    // Check if we need to update the lookup
    const currentLookup = doc.identityLookup?.[identity.did];
    const needsUpdate =
      !currentLookup ||
      currentLookup.displayName !== identity.displayName ||
      currentLookup.avatarUrl !== identity.avatarUrl ||
      currentLookup.userDocUrl !== userDocUrl;

    if (needsUpdate) {
      docHandle.change((d: BaseDocument<TData>) => {
        if (!d.identityLookup) {
          d.identityLookup = {};
        }
        // Build entry without undefined values (Automerge doesn't allow undefined)
        const entry: { displayName?: string; avatarUrl?: string; userDocUrl?: string; updatedAt: number } = {
          updatedAt: Date.now(),
        };
        if (identity.displayName) {
          entry.displayName = identity.displayName;
        }
        if (identity.avatarUrl) {
          entry.avatarUrl = identity.avatarUrl;
        }
        if (userDocUrl) {
          entry.userDocUrl = userDocUrl;
        }
        d.identityLookup[identity.did] = entry;
      });
    }

    setLastIdentityLookupKey(desiredKey);
  }); // No dependencies - we check manually

  // Trust notifications detection (from User-Doc)
  // Verifies signatures before showing notifications
  useEffect(() => {
    if (!currentUserDid || !documentId || !userDoc) {
      setPendingAttestations([]);
      return;
    }

    const seenIds = getSeenAttestations(documentId);

    // Get incoming trust attestations from User-Doc
    const incomingAttestations = Object.values(userDoc.trustReceived || {});

    // Get DIDs we already trust (bidirectional trust already exists)
    const alreadyTrustedDids = new Set(Object.keys(userDoc.trustGiven || {}));

    // Filter out:
    // - seen attestations
    // - self-attestations
    // - attestations from people we already trust (bidirectional already complete)
    const candidateAttestations = incomingAttestations.filter(
      (attestation) =>
        !seenIds.has(attestation.id) &&
        attestation.trusterDid !== currentUserDid &&
        !alreadyTrustedDids.has(attestation.trusterDid)
    );

    // Verify signatures asynchronously
    const verifyAndSetAttestations = async () => {
      const verifiedAttestations: TrustAttestation[] = [];

      for (const attestation of candidateAttestations) {
        // Allow unsigned attestations during transition period
        // TODO: Make signature verification mandatory after migration
        if (!attestation.signature) {
          console.log('🔐 Allowing unsigned attestation (legacy):', attestation.id);
          verifiedAttestations.push(attestation);
          continue;
        }

        const isValid = await verifyAttestationSignature(attestation);
        if (isValid) {
          verifiedAttestations.push(attestation);
        } else {
          console.warn('🔐 Rejecting attestation with invalid signature:', attestation.id);
          // Mark invalid attestations as seen so we don't keep checking them
          markAttestationsAsSeen(documentId, [attestation.id]);
        }
      }

      // Sort by creation time (oldest first)
      verifiedAttestations.sort((a, b) => a.createdAt - b.createdAt);

      setPendingAttestations(verifiedAttestations);
    };

    verifyAndSetAttestations();
  }, [userDoc, userDoc?.trustReceived, userDoc?.trustGiven, currentUserDid, documentId]);

  // Load profiles from trusted users' UserDocuments
  // This provides up-to-date avatars and display names for verified friends
  // Uses subscriptions to react to remote profile changes in real-time
  const [lastLoadedUrlsKey, setLastLoadedUrlsKey] = useState('');

  useEffect(() => {
    if (!repo) {
      setTrustedUserProfiles({});
      return;
    }

    // Build a map of userDocUrls from trust relationships
    const userDocUrls = new Map<string, string>();

    // From trustReceived: users who trust us - they provided their trusterUserDocUrl
    for (const [trusterDid, attestation] of Object.entries(userDoc?.trustReceived || {})) {
      if (attestation.trusterUserDocUrl) {
        userDocUrls.set(trusterDid, attestation.trusterUserDocUrl);
      }
    }

    // From trustGiven: we trusted them, but we need their UserDoc URL
    // Check if they also trusted us back (then we have their URL from trustReceived)
    // If not in trustReceived, check workspace doc's identityLookup
    for (const trusteeDid of Object.keys(userDoc?.trustGiven || {})) {
      if (!userDocUrls.has(trusteeDid) && doc?.identityLookup?.[trusteeDid]?.userDocUrl) {
        userDocUrls.set(trusteeDid, doc.identityLookup[trusteeDid].userDocUrl!);
      }
    }

    // Create a stable key to check if we need to reload
    const currentUrlsKey = Array.from(userDocUrls.entries())
      .map(([did, url]) => `${did}=${url}`)
      .sort()
      .join('|');

    // Skip if nothing changed
    if (currentUrlsKey === lastLoadedUrlsKey) {
      return;
    }

    // Cleanup removed subscriptions (trust relationships that no longer exist)
    const currentUrls = new Set(userDocUrls.values());
    for (const [url, subscription] of profileSubscriptionsRef.current.entries()) {
      if (!currentUrls.has(url)) {
        subscription.handle.off('change', subscription.handler);
        profileSubscriptionsRef.current.delete(url);
      }
    }

    if (userDocUrls.size === 0) {
      setTrustedUserProfiles({});
      setLastLoadedUrlsKey(currentUrlsKey);
      return;
    }

    // Helper to update a single profile in state
    const updateProfile = (did: string, profile: Omit<TrustedUserProfile, 'did'>) => {
      setTrustedUserProfiles((prev) => ({
        ...prev,
        [did]: { did, ...profile },
      }));
    };

    // Load all trusted users' UserDocs in parallel and subscribe to changes
    const loadProfilesWithSubscriptions = async () => {
      const loadPromises = Array.from(userDocUrls.entries()).map(async ([did, docUrl]) => {
        // Skip if already subscribed to this URL
        if (profileSubscriptionsRef.current.has(docUrl)) {
          return null;
        }

        try {
          const handle = await repo.find<UserDocument>(docUrl as AutomergeUrl);
          const trustedUserDoc = handle.doc();

          if (trustedUserDoc) {
            // Initial profile load
            const profile: TrustedUserProfile = {
              did,
              displayName: trustedUserDoc.profile?.displayName,
              avatarUrl: trustedUserDoc.profile?.avatarUrl,
              userDocUrl: docUrl,
              fetchedAt: Date.now(),
            };

            // Subscribe to changes on this document
            const changeHandler = ({ doc: changedDoc }: { doc: UserDocument }) => {
              if (changedDoc) {
                updateProfile(did, {
                  displayName: changedDoc.profile?.displayName,
                  avatarUrl: changedDoc.profile?.avatarUrl,
                  userDocUrl: docUrl,
                  fetchedAt: Date.now(),
                });
              }
            };
            handle.on('change', changeHandler);

            // Store subscription for cleanup
            profileSubscriptionsRef.current.set(docUrl, { handle, handler: changeHandler });

            return { did, profile };
          }
          return null;
        } catch (err) {
          console.warn(`Failed to load UserDoc for ${did}:`, err);
          return null;
        }
      });

      // Wait for all loads to complete
      const results = await Promise.all(loadPromises);

      // Build initial profiles state from successful loads
      const profiles: Record<string, TrustedUserProfile> = {};
      for (const result of results) {
        if (result) {
          profiles[result.did] = result.profile;
        }
      }

      // Merge with existing profiles (preserving subscribed ones)
      setTrustedUserProfiles((prev) => ({
        ...prev,
        ...profiles,
      }));
      setLastLoadedUrlsKey(currentUrlsKey);
    };

    loadProfilesWithSubscriptions();

    // Cleanup all subscriptions on unmount
    return () => {
      for (const subscription of profileSubscriptionsRef.current.values()) {
        subscription.handle.off('change', subscription.handler);
      }
      profileSubscriptionsRef.current.clear();
    };
  }); // No dependencies - we check manually with lastLoadedUrlsKey

  // Current workspace info
  const currentWorkspace: WorkspaceInfo | null = doc
    ? {
        id: documentId,
        name: effectiveWorkspaceName,
        lastAccessed: Date.now(),
        ...(workspaceAvatar && { avatar: workspaceAvatar }),
      }
    : null;

  // Handlers
  const handleSwitchWorkspace = useCallback((workspaceId: string) => {
    window.location.hash = `#doc=${workspaceId}`;
    window.location.reload();
  }, []);

  const openNewWorkspaceModal = useCallback(() => {
    setIsNewWorkspaceModalOpen(true);
  }, []);

  const closeNewWorkspaceModal = useCallback(() => {
    setIsNewWorkspaceModalOpen(false);
  }, []);

  const handleNewWorkspace = useCallback(() => {
    openNewWorkspaceModal();
  }, [openNewWorkspaceModal]);

  const handleUpdateIdentity = useCallback(
    (updates: { displayName?: string; avatarUrl?: string }) => {
      if (!identity || !docHandle) return;

      // Update local identity (localStorage)
      const updatedIdentity = { ...identity, ...updates };
      setIdentity(updatedIdentity);
      saveSharedIdentity(updatedIdentity);

      // Update UserDocument profile (syncs across tabs/devices via Automerge)
      if (userDocHandle) {
        userDocHandle.change((d) => {
          updateUserProfile(d, updates);
        });
      }

      // Update in document (app-specific or generic)
      if (onUpdateIdentityInDoc) {
        onUpdateIdentityInDoc(updates);
      } else {
        // Generic update
        docHandle.change((d: BaseDocument<TData>) => {
          if (!d.identities[identity.did]) {
            d.identities[identity.did] = {};
          }
          if (updates.displayName !== undefined) {
            d.identities[identity.did].displayName = updates.displayName;
          }
          if (updates.avatarUrl !== undefined) {
            d.identities[identity.did].avatarUrl = updates.avatarUrl;
          }
          d.lastModified = Date.now();
        });
      }

      // Also update identityLookup for workspace-internal profile resolution
      docHandle.change((d: BaseDocument<TData>) => {
        if (!d.identityLookup) {
          d.identityLookup = {};
        }
        if (!d.identityLookup[identity.did]) {
          d.identityLookup[identity.did] = { updatedAt: Date.now() };
        }
        // Only set non-undefined values (Automerge doesn't allow undefined)
        if (updates.displayName !== undefined && updates.displayName !== null) {
          d.identityLookup[identity.did].displayName = updates.displayName;
        }
        if (updates.avatarUrl !== undefined && updates.avatarUrl !== null && updates.avatarUrl !== '') {
          d.identityLookup[identity.did].avatarUrl = updates.avatarUrl;
        } else if (updates.avatarUrl === '' || updates.avatarUrl === null) {
          // Remove avatar if explicitly cleared
          delete d.identityLookup[identity.did].avatarUrl;
        }
        // Include userDocUrl for bidirectional trust
        if (userDocUrl) {
          d.identityLookup[identity.did].userDocUrl = userDocUrl;
        }
        d.identityLookup[identity.did].updatedAt = Date.now();
      });

      // Broadcast profile update to other tabs via BroadcastChannel
      broadcastProfileUpdate(updates);
    },
    [identity, docHandle, onUpdateIdentityInDoc, userDocUrl, userDocHandle]
  );

  const handleTrustUser = useCallback(
    async (trusteeDid: string, trusteeUserDocUrl?: string) => {
      console.log('🤝 handleTrustUser called', {
        trusteeDid,
        trusteeUserDocUrl,
        currentUserDid,
        hasUserDocHandle: !!userDocHandle,
        hasRepo: !!repo
      });
      if (!currentUserDid || !userDocHandle || !identity?.privateKey) {
        console.warn('Cannot trust user: userDocHandle or privateKey not available', { currentUserDid, userDocHandle, hasPrivateKey: !!identity?.privateKey });
        return;
      }

      // Build attestation without signature first
      const attestationData: Omit<TrustAttestation, 'signature'> = {
        id: `trust-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        trusterDid: currentUserDid,
        trusteeDid: trusteeDid,
        level: 'verified',
        verificationMethod: 'in-person',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add trusterUserDocUrl if we have it (for bidirectional trust)
      if (userDocUrl) {
        (attestationData as TrustAttestation).trusterUserDocUrl = userDocUrl;
      }

      // Sign the attestation
      let signature: string;
      try {
        signature = await signEntity(attestationData as Record<string, unknown>, identity.privateKey);
        console.log('🤝 Attestation signed successfully');
      } catch (err) {
        console.error('🤝 Failed to sign attestation:', err);
        return;
      }

      const attestation: TrustAttestation = {
        ...attestationData,
        signature,
      };
      console.log('🤝 Creating signed trust attestation', { id: attestation.id, hasSig: !!attestation.signature });

      // 1. Add to our own trustGiven
      userDocHandle.change((d) => {
        console.log('🤝 Inside change callback, adding trust', { did: d.did, trustGiven: Object.keys(d.trustGiven || {}).length });
        addTrustGiven(d, attestation);
        console.log('🤝 After addTrustGiven', { trustGiven: Object.keys(d.trustGiven || {}).length });
      });

      // 2. If we have the trustee's userDocUrl and repo, add to their trustReceived
      if (trusteeUserDocUrl && repo) {
        console.log('🤝 Writing to trustee userDoc:', trusteeUserDocUrl);
        // In automerge-repo v2.x, find() returns a Promise
        repo.find<UserDocument>(trusteeUserDocUrl as AutomergeUrl).then((trusteeDocHandle) => {
          console.log('🤝 Found trustee doc handle');
          const currentDoc = trusteeDocHandle.doc();
          console.log('🤝 Trustee doc ready', {
            hasTrustReceived: !!currentDoc?.trustReceived,
            trusteeDid: currentDoc?.did,
            currentTrustReceivedCount: Object.keys(currentDoc?.trustReceived || {}).length
          });
          trusteeDocHandle.change((d: UserDocument) => {
            console.log('🤝 Inside trustee change callback', { trusteeDid: d.did });
            addTrustReceived(d, attestation);
            console.log('🤝 After addTrustReceived', { trustReceived: Object.keys(d.trustReceived || {}).length });
          });
          console.log('🤝 Change applied to trustee doc');
        }).catch((err: unknown) => {
          console.warn('🤝 Failed to find/update trustee userDoc:', err);
        });
      } else {
        console.log('🤝 No trusteeUserDocUrl or repo provided, skipping trustReceived update', {
          hasTrusteeUserDocUrl: !!trusteeUserDocUrl,
          hasRepo: !!repo
        });
      }
    },
    [userDocHandle, currentUserDid, repo, identity?.privateKey, userDocUrl]
  );

  const handleRevokeTrust = useCallback(
    (trusteeDid: string) => {
      if (!userDocHandle) {
        console.warn('Cannot revoke trust: userDocHandle not available');
        return;
      }

      console.log('🚫 Revoking trust for:', trusteeDid);

      userDocHandle.change((d) => {
        removeTrustGiven(d, trusteeDid);
      });

      showToast(`Trust revoked`);
    },
    [userDocHandle]
  );

  const handleTrustBack = useCallback(
    async (trusterDid: string) => {
      if (!currentUserDid || !documentId || !userDocHandle || !identity?.privateKey) {
        console.warn('Cannot trust back: userDocHandle or privateKey not available');
        return;
      }

      // Build attestation without signature first
      const attestationData: Omit<TrustAttestation, 'signature'> = {
        id: `trust-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        trusterDid: currentUserDid,
        trusteeDid: trusterDid,
        level: 'verified',
        verificationMethod: 'in-person',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add trusterUserDocUrl if we have it
      if (userDocUrl) {
        (attestationData as TrustAttestation).trusterUserDocUrl = userDocUrl;
      }

      // Sign the attestation
      let signature: string;
      try {
        signature = await signEntity(attestationData as Record<string, unknown>, identity.privateKey);
      } catch (err) {
        console.error('Failed to sign trust-back attestation:', err);
        return;
      }

      const attestation: TrustAttestation = {
        ...attestationData,
        signature,
      };

      userDocHandle.change((d) => {
        addTrustGiven(d, attestation);
      });

      // If the original truster provided their userDocUrl, write to their trustReceived
      const existingAttestation = pendingAttestations.find(att => att.trusterDid === trusterDid);
      if (existingAttestation?.trusterUserDocUrl && repo) {
        // In automerge-repo v2.x, find() returns a Promise
        repo.find<UserDocument>(existingAttestation.trusterUserDocUrl as AutomergeUrl).then((trusterDocHandle) => {
          trusterDocHandle.change((d: UserDocument) => {
            addTrustReceived(d, attestation);
          });
        }).catch((err: unknown) => {
          console.warn('Failed to find/update truster userDoc:', err);
        });
      }

      // Mark the corresponding attestation as seen
      if (existingAttestation) {
        markAttestationsAsSeen(documentId, [existingAttestation.id]);
        setPendingAttestations(prev => prev.filter(att => att.id !== existingAttestation.id));
      }
    },
    [userDocHandle, currentUserDid, documentId, pendingAttestations, identity?.privateKey, userDocUrl, repo]
  );

  const handleDeclineTrust = useCallback(
    (attestationId: string) => {
      if (!documentId) return;

      markAttestationsAsSeen(documentId, [attestationId]);
      setPendingAttestations(prev => prev.filter(att => att.id !== attestationId));
    },
    [documentId]
  );

  const handleResetIdentity = useCallback(() => {
    if (onResetIdentity) {
      onResetIdentity();
    } else {
      localStorage.removeItem('narrative_shared_identity');
      window.location.reload();
    }
  }, [onResetIdentity]);

  const toggleUserVisibility = useCallback((did: string) => {
    setHiddenUserDids((prev) => {
      const next = new Set(prev);
      if (next.has(did)) {
        next.delete(did);
      } else {
        next.add(did);
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handleCreateWorkspace = useCallback(
    (name: string, avatarDataUrl?: string) => {
      if (onCreateWorkspace) {
        onCreateWorkspace(name, avatarDataUrl);
      }
      closeNewWorkspaceModal();
    },
    [onCreateWorkspace, closeNewWorkspaceModal]
  );

  // Props ready for NewWorkspaceModal
  const newWorkspaceModalProps = {
    isOpen: isNewWorkspaceModalOpen,
    onClose: closeNewWorkspaceModal,
    onCreate: handleCreateWorkspace,
  };

  // Props ready for TrustReciprocityModal
  const trustReciprocityModalProps = doc
    ? {
        pendingAttestations,
        doc: doc as BaseDocument<TData>,
        currentUserDid,
        onTrustUser: handleTrustUser, // Now uses QR scanning for proper verification
        onDecline: handleDeclineTrust,
        onShowToast: showToast,
      }
    : null;

  // Props ready for Toast
  const toastProps = toastMessage
    ? {
        message: toastMessage,
        type: 'success' as const,
        onClose: clearToast,
      }
    : null;

  // Build navbar props (only if doc is loaded)
  const navbarProps = doc
    ? {
        currentUserDid,
        doc: doc as BaseDocument<TData>,
        logoUrl,
        currentWorkspace,
        workspaces,
        onSwitchWorkspace: handleSwitchWorkspace,
        onNewWorkspace: handleNewWorkspace,
        onTrustUser: handleTrustUser,
        onToggleUserVisibility: toggleUserVisibility,
        hiddenUserDids,
        onShowToast: showToast,
        hideWorkspaceSwitcher,
        appTitle,
        userDoc,
        trustedUserProfiles,
      }
    : null;

  return {
    identity,
    currentUserDid,
    workspaces,
    currentWorkspace,
    hiddenUserDids,
    toastMessage,
    isNewWorkspaceModalOpen,
    pendingAttestations,
    hasPendingTrust: pendingAttestations.length > 0,
    trustedUserProfiles,
    handleSwitchWorkspace,
    handleNewWorkspace,
    handleUpdateIdentity,
    handleTrustUser,
    handleRevokeTrust,
    handleTrustBack,
    handleDeclineTrust,
    handleResetIdentity,
    toggleUserVisibility,
    showToast,
    clearToast,
    openNewWorkspaceModal,
    closeNewWorkspaceModal,
    handleCreateWorkspace,
    openProfile,
    navbarProps,
    newWorkspaceModalProps,
    trustReciprocityModalProps,
    toastProps,
  };
}
