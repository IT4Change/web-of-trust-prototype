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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { DocHandle, AutomergeUrl, Repo } from '@automerge/automerge-repo';
import { useProfileUrl } from './useProfileUrl';
import { useKnownProfiles, type KnownProfile } from './useKnownProfiles';
export type { KnownProfile } from './useKnownProfiles';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  type StoredIdentity,
} from '../utils/storage';
import { type WorkspaceInfo } from '../components/WorkspaceSwitcher';
import { addWorkspace as addWorkspaceToDoc } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import type { UserDocument } from '../schema/userDocument';
import { addTrustGiven, addTrustReceived, removeTrustGiven, updateUserProfile } from '../schema/userDocument';
import { signEntity, verifyEntitySignature, signProfile, verifyProfileSignature } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';
import { updateDebugState } from '../utils/debug';
import { broadcastProfileUpdate } from './useCrossTabSync';

// Profile signature verification status type (defined early for use in helper functions)
export type ProfileSignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

// Storage key for seen trust attestations
const TRUST_STORAGE_KEY = 'narrativeTrustNotifications';

interface SeenAttestations {
  // Key is user DID (trust attestations are user-global, not workspace-specific)
  [userDid: string]: string[];
}

function getSeenAttestations(userDid: string): Set<string> {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    if (!stored) return new Set();
    const data: SeenAttestations = JSON.parse(stored);
    return new Set(data[userDid] || []);
  } catch {
    return new Set();
  }
}

function markAttestationsAsSeen(userDid: string, attestationIds: string[]): void {
  try {
    const stored = localStorage.getItem(TRUST_STORAGE_KEY);
    const data: SeenAttestations = stored ? JSON.parse(stored) : {};
    if (!data[userDid]) {
      data[userDid] = [];
    }
    const currentSet = new Set(data[userDid]);
    attestationIds.forEach(id => currentSet.add(id));
    data[userDid] = Array.from(currentSet);
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

/**
 * Verify a user profile signature
 * Returns the signature status
 */
async function verifyUserProfileSignature(
  profile: { displayName: string; avatarUrl?: string; updatedAt?: number; signature?: string },
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
    const result = await verifyProfileSignature(profile, publicKeyBase64);

    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
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

  /**
   * Callback for workspace switching without page reload (from AppShell)
   * When provided, workspace switching will use this callback instead of page reload
   */
  onSwitchWorkspace?: (workspaceId: string) => void;
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
  /** Profile signature verification status */
  profileSignatureStatus?: ProfileSignatureStatus;
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
  showConfetti: boolean;
  clearConfetti: () => void;

  // Trust notifications
  pendingAttestations: TrustAttestation[];
  hasPendingTrust: boolean;

  /**
   * Profiles loaded from trusted users' UserDocuments
   * Key is the DID, value is the profile data
   * Use this for displaying avatars/names of verified friends
   * @deprecated Use knownProfiles instead for more complete profile coverage
   */
  trustedUserProfiles: Record<string, TrustedUserProfile>;

  /**
   * All known profiles from all sources (trust network, workspace, QR scans, etc.)
   * This is the recommended way to access profile data.
   */
  knownProfiles: Map<string, KnownProfile>;

  /**
   * Get a profile by DID from the known profiles
   * Returns undefined if profile is not known
   */
  getProfile: (did: string) => KnownProfile | undefined;

  /**
   * Register an external UserDoc URL for reactive profile updates
   * Use this when loading a profile outside of trust relationships (e.g., QR scanner preview)
   */
  registerExternalDoc: (userDocUrl: string) => void;

  // Handlers
  handleSwitchWorkspace: (workspaceId: string) => void;
  handleNewWorkspace: () => void;
  handleUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  handleTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
  handleRevokeTrust: (did: string) => void;
  handleTrustBack: (trusterDid: string) => void;
  handleDeclineTrust: (attestationId: string) => void;
  handleResetIdentity: () => void;
  handleMutualTrustEstablished: (friendDid: string, friendName: string) => void;
  toggleUserVisibility: (did: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  openNewWorkspaceModal: () => void;
  closeNewWorkspaceModal: () => void;
  handleCreateWorkspace: (name: string, avatarDataUrl?: string) => void;

  // Profile viewing
  openProfile: (did: string) => void;

  // Props ready for components - just spread these!
  // navbarProps is always available (shell works without workspace doc)
  navbarProps: {
    currentUserDid: string;
    doc: BaseDocument<TData> | null;  // May be null in start/loading states
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
    userDocUrl?: string;
    trustedUserProfiles?: Record<string, TrustedUserProfile>;
    onOpenProfile: (did: string) => void;
    onMutualTrustEstablished: (friendDid: string, friendName: string) => void;
  };

  newWorkspaceModalProps: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, avatarDataUrl?: string) => void;
  };

  trustReciprocityModalProps: {
    pendingAttestations: TrustAttestation[];
    doc: BaseDocument<TData> | null;
    currentUserDid: string;
    onTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
    onDecline: (attestationId: string) => void;
    onShowToast: (message: string) => void;
    userDoc?: UserDocument | null;
    userDocUrl?: string;
    onOpenProfile: (did: string) => void;
    onMutualTrustEstablished: (friendDid: string, friendName: string) => void;
    trustedUserProfiles?: Record<string, TrustedUserProfile>;
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
    onResetIdentity,
    onCreateWorkspace,
    onUpdateIdentityInDoc,
    userDocHandle,
    userDoc,
    userDocUrl,
    repo,
    onSwitchWorkspace,
  } = options;

  // Identity state
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => loadSharedIdentity());

  // Workspaces derived from UserDocument only (no localStorage migration needed)
  const workspaces = useMemo((): WorkspaceInfo[] => {
    if (!userDoc?.workspaces) return [];
    return Object.values(userDoc.workspaces).map(ws => ({
      id: ws.docId,
      name: ws.name,
      avatar: ws.avatar,
      lastAccessed: ws.lastAccessedAt ?? ws.addedAt,
    }));
  }, [userDoc?.workspaces]);

  // UI state
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Trust notifications state
  const [pendingAttestations, setPendingAttestations] = useState<TrustAttestation[]>([]);

  // Current user DID - prefer provided, fallback to identity (defined early for useKnownProfiles)
  const currentUserDid = providedUserDid ?? identity?.did ?? '';

  // URL-based profile support
  const { openProfile } = useProfileUrl();

  // Central profile management using useKnownProfiles hook
  const {
    profiles: knownProfiles,
    getProfile,
    isLoading: isLoadingProfiles,
    registerExternalDoc,
  } = useKnownProfiles({
    repo,
    userDoc,
    currentUserDid,
    workspaceDoc: doc,
  });

  // Derive trustedUserProfiles from knownProfiles for backwards compatibility
  // Only includes profiles from trust relationships (not workspace-only profiles)
  const trustedUserProfiles = useMemo(() => {
    const result: Record<string, TrustedUserProfile> = {};
    for (const [did, profile] of knownProfiles) {
      // Include profiles from trust relationships (not just workspace identities)
      if (profile.source !== 'workspace') {
        result[did] = {
          did: profile.did,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          userDocUrl: profile.userDocUrl,
          fetchedAt: profile.lastUpdated,
          profileSignatureStatus: profile.signatureStatus,
        };
      }
    }
    return result;
  }, [knownProfiles]);

  // Get workspace name and avatar from document context (prefer doc.context over props)
  const docContext = (doc as BaseDocument<TData> | null)?.context;
  const effectiveWorkspaceName = docContext?.name || workspaceName;
  const workspaceAvatar = docContext?.avatar;

  // Track current workspace in UserDocument
  // Use a ref to track whether we've already updated for this workspace session
  const lastSavedWorkspaceRef = useRef<string>('');

  useEffect(() => {
    if (!doc || !documentId || !userDocHandle) return;

    // Create a stable key to check if we need to update
    const currentKey = `${documentId}|${effectiveWorkspaceName}|${workspaceAvatar || ''}`;
    if (currentKey === lastSavedWorkspaceRef.current) {
      return;
    }

    // Write workspace to UserDocument
    userDocHandle.change((d) => {
      if (!d.workspaces[documentId]) {
        // New workspace - add it
        addWorkspaceToDoc(d, documentId, effectiveWorkspaceName, workspaceAvatar);
      } else {
        // Existing workspace - update metadata only if changed
        const ws = d.workspaces[documentId];
        let changed = false;
        if (ws.name !== effectiveWorkspaceName) {
          ws.name = effectiveWorkspaceName;
          changed = true;
        }
        if (ws.avatar !== workspaceAvatar) {
          if (workspaceAvatar) {
            ws.avatar = workspaceAvatar;
          } else {
            delete ws.avatar;
          }
          changed = true;
        }
        // Only update timestamps if something actually changed
        if (changed) {
          ws.lastAccessedAt = Date.now();
          d.lastModified = Date.now();
        }
      }
    });

    lastSavedWorkspaceRef.current = currentKey;
  }, [doc, documentId, userDocHandle, effectiveWorkspaceName, workspaceAvatar]);


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
  // Use a ref to track last saved values and avoid duplicate writes
  const lastIdentityLookupKeyRef = useRef<string>('');

  useEffect(() => {
    if (!docHandle || !identity || !doc) return;

    // Create a stable key for what we want to save
    const desiredKey = `${identity.did}|${identity.displayName || ''}|${identity.avatarUrl || ''}|${userDocUrl || ''}`;

    // Check if we already saved this
    if (desiredKey === lastIdentityLookupKeyRef.current) {
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

    lastIdentityLookupKeyRef.current = desiredKey;
  }, [docHandle, identity, doc, userDocUrl]);

  // Validate and clean up trustReceived entries with invalid signatures
  // This runs whenever trustReceived changes (including initial load and remote updates)
  // Tracks which DIDs we've already validated to avoid re-checking unchanged entries
  const validatedTrustReceivedRef = useRef<Set<string>>(new Set());

  // Create stable key for trustReceived validation (only changes when attestations change)
  const trustReceivedValidationKey = useMemo(() => {
    if (!userDoc?.trustReceived) return '';
    return Object.entries(userDoc.trustReceived)
      .map(([did, att]) => `${did}:${att.id}`)
      .sort()
      .join('|');
  }, [userDoc?.trustReceived]);

  useEffect(() => {
    if (!userDocHandle || !userDoc) return;

    const validateAndCleanup = async () => {
      const trustReceived = userDoc.trustReceived || {};
      const invalidDids: string[] = [];
      const currentDids = new Set(Object.keys(trustReceived));

      // Clean up tracking for DIDs that are no longer in trustReceived
      for (const did of validatedTrustReceivedRef.current) {
        if (!currentDids.has(did)) {
          validatedTrustReceivedRef.current.delete(did);
        }
      }

      for (const [trusterDid, attestation] of Object.entries(trustReceived)) {
        // Skip if we've already validated this entry (and it hasn't changed)
        // We use the attestation ID as a proxy for "unchanged"
        const validationKey = `${trusterDid}:${attestation.id}`;
        if (validatedTrustReceivedRef.current.has(validationKey)) {
          continue;
        }

        // Allow unsigned attestations during transition period
        if (!attestation.signature) {
          validatedTrustReceivedRef.current.add(validationKey);
          continue;
        }

        const isValid = await verifyAttestationSignature(attestation);
        if (isValid) {
          validatedTrustReceivedRef.current.add(validationKey);
        } else {
          invalidDids.push(trusterDid);
        }
      }

      // Remove invalid entries from the document
      if (invalidDids.length > 0) {
        userDocHandle.change((d) => {
          for (const did of invalidDids) {
            delete d.trustReceived[did];
          }
          d.lastModified = Date.now();
        });
      }
    };

    validateAndCleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDocHandle, trustReceivedValidationKey]);

  // Create stable key for trust notifications (only changes when attestation IDs change)
  const trustNotificationsKey = useMemo(() => {
    const receivedIds = userDoc?.trustReceived
      ? Object.entries(userDoc.trustReceived).map(([did, att]) => `r:${did}:${att.id}`).sort().join('|')
      : '';
    const givenDids = userDoc?.trustGiven
      ? Object.keys(userDoc.trustGiven).sort().join(',')
      : '';
    return `${receivedIds}||${givenDids}`;
  }, [userDoc?.trustReceived, userDoc?.trustGiven]);

  // Trust notifications detection (from User-Doc)
  // Verifies signatures before showing notifications
  useEffect(() => {
    if (!currentUserDid || !userDoc) {
      setPendingAttestations([]);
      return;
    }

    const seenIds = getSeenAttestations(currentUserDid);

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
          verifiedAttestations.push(attestation);
          continue;
        }

        const isValid = await verifyAttestationSignature(attestation);
        if (isValid) {
          verifiedAttestations.push(attestation);
        } else {
          // Mark invalid attestations as seen so we don't keep checking them
          markAttestationsAsSeen(currentUserDid, [attestation.id]);
        }
      }

      // Sort by creation time (oldest first)
      verifiedAttestations.sort((a, b) => a.createdAt - b.createdAt);

      setPendingAttestations(verifiedAttestations);
    };

    verifyAndSetAttestations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustNotificationsKey, currentUserDid]);

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
    if (onSwitchWorkspace) {
      // Use AppShell callback (no page reload)
      onSwitchWorkspace(workspaceId);
    } else {
      // Fallback to page reload (legacy behavior)
      window.location.hash = `#doc=${workspaceId}`;
      window.location.reload();
    }
  }, [onSwitchWorkspace]);

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
    async (updates: { displayName?: string; avatarUrl?: string }) => {
      if (!identity) return;

      // Update local identity (localStorage) - always works, even without workspace
      const updatedIdentity = { ...identity, ...updates };
      setIdentity(updatedIdentity);
      saveSharedIdentity(updatedIdentity);

      // Update UserDocument profile with signature (syncs across tabs/devices via Automerge)
      if (userDocHandle && identity.privateKey) {
        // Get current profile to merge with updates
        const currentDoc = userDocHandle.doc();
        const currentProfile = currentDoc?.profile;

        const newDisplayName = updates.displayName ?? currentProfile?.displayName ?? identity.displayName;
        const newAvatarUrl = updates.avatarUrl ?? currentProfile?.avatarUrl ?? identity.avatarUrl;
        const updatedAt = Date.now();

        // Sign the profile
        try {
          const profilePayload = {
            displayName: newDisplayName,
            avatarUrl: newAvatarUrl,
            updatedAt,
          };
          const signature = await signProfile(profilePayload, identity.privateKey);

          userDocHandle.change((d) => {
            d.profile.displayName = newDisplayName;
            if (newAvatarUrl !== undefined) {
              d.profile.avatarUrl = newAvatarUrl;
            } else {
              delete d.profile.avatarUrl;
            }
            d.profile.updatedAt = updatedAt;
            d.profile.signature = signature;
            d.lastModified = updatedAt;
          });
        } catch (err) {
          console.error('Failed to sign profile:', err);
          // Fallback: update without signature
          userDocHandle.change((d) => {
            updateUserProfile(d, updates);
          });
        }
      } else if (userDocHandle) {
        // No private key available, update without signature
        userDocHandle.change((d) => {
          updateUserProfile(d, updates);
        });
      }

      // Update in workspace document (only if available - not required for profile update)
      if (docHandle) {
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
      }

      // Broadcast profile update to other tabs via BroadcastChannel
      broadcastProfileUpdate(updates);
    },
    [identity, docHandle, onUpdateIdentityInDoc, userDocUrl, userDocHandle]
  );

  // Toast functions - defined early so they can be used by handlers below
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handleTrustUser = useCallback(
    async (trusteeDid: string, trusteeUserDocUrl?: string) => {
      if (!currentUserDid || !userDocHandle || !identity?.privateKey) {
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

      // Add trusteeUserDocUrl if provided (from QR scan - essential for cross-workspace trust)
      if (trusteeUserDocUrl) {
        (attestationData as TrustAttestation).trusteeUserDocUrl = trusteeUserDocUrl;
      }

      // Sign the attestation
      let signature: string;
      try {
        signature = await signEntity(attestationData as Record<string, unknown>, identity.privateKey);
      } catch {
        return;
      }

      const attestation: TrustAttestation = {
        ...attestationData,
        signature,
      };

      // 1. Add to our own trustGiven
      userDocHandle.change((d) => {
        addTrustGiven(d, attestation);
      });

      // 2. If we have the trustee's userDocUrl and repo, add to their trustReceived
      if (trusteeUserDocUrl && repo) {
        // Retry logic for writing to remote UserDoc with sync verification
        const writeToTrusteeDoc = async (retries = 3, delayMs = 1000) => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              const trusteeDocHandle = await repo.find<UserDocument>(trusteeUserDocUrl as AutomergeUrl);

              // Wait for document to be ready (check if doc exists)
              const currentDoc = trusteeDocHandle.doc();
              if (!currentDoc) {
                if (attempt < retries) {
                  await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                  continue;
                }
                throw new Error('Trustee document not available after retries');
              }

              trusteeDocHandle.change((d: UserDocument) => {
                addTrustReceived(d, attestation);
              });

              // Wait for sync confirmation by checking if the change persists
              // We listen for the next change event which indicates sync activity
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                  trusteeDocHandle.off('change', onSyncConfirm);
                  // Even if we timeout, the change was applied locally - it will sync eventually
                  resolve();
                }, 5000);

                const onSyncConfirm = () => {
                  clearTimeout(timeout);
                  trusteeDocHandle.off('change', onSyncConfirm);
                  resolve();
                };

                // Also resolve immediately if we can verify the attestation is there
                const verifyAttestation = () => {
                  const doc = trusteeDocHandle.doc();
                  if (doc?.trustReceived?.[currentUserDid]) {
                    clearTimeout(timeout);
                    trusteeDocHandle.off('change', onSyncConfirm);
                    resolve();
                  }
                };

                trusteeDocHandle.on('change', onSyncConfirm);
                // Check immediately in case it's already there
                setTimeout(verifyAttestation, 100);
              });

              showToast?.('Vertrauen wurde erfolgreich übermittelt');
              return; // Success, exit retry loop
            } catch {
              if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
              } else {
                showToast?.('Vertrauen konnte nicht übermittelt werden');
              }
            }
          }
        };

        // Fire and forget with retries
        writeToTrusteeDoc();
      }
    },
    [userDocHandle, currentUserDid, repo, identity?.privateKey, userDocUrl, showToast]
  );

  const handleRevokeTrust = useCallback(
    (trusteeDid: string) => {
      if (!userDocHandle || !currentUserDid) {
        console.warn('Cannot revoke trust: userDocHandle not available');
        return;
      }

      // Get the trustee's userDocUrl before removing (we need it for bidirectional cleanup)
      const trusteeUserDocUrl = userDoc?.trustReceived?.[trusteeDid]?.trusterUserDocUrl
        || doc?.identityLookup?.[trusteeDid]?.userDocUrl;

      // 1. Remove from our own trustGiven
      userDocHandle.change((d) => {
        removeTrustGiven(d, trusteeDid);
      });

      // 2. Remove from trustee's trustReceived (bidirectional cleanup)
      if (trusteeUserDocUrl && repo) {
        repo.find<UserDocument>(trusteeUserDocUrl as AutomergeUrl).then((trusteeDocHandle) => {
          trusteeDocHandle.change((d: UserDocument) => {
            // Remove our attestation from their trustReceived
            if (d.trustReceived?.[currentUserDid]) {
              delete d.trustReceived[currentUserDid];
              d.lastModified = Date.now();
            }
          });
        }).catch(() => {
          // Cleanup failed silently
        });
      }

      setToastMessage(`Vertrauen entzogen`);
    },
    [userDocHandle, currentUserDid, userDoc, doc, repo]
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
        markAttestationsAsSeen(currentUserDid, [existingAttestation.id]);
        setPendingAttestations(prev => prev.filter(att => att.id !== existingAttestation.id));
      }
    },
    [userDocHandle, currentUserDid, pendingAttestations, identity?.privateKey, userDocUrl, repo]
  );

  const handleDeclineTrust = useCallback(
    (attestationId: string) => {
      if (!currentUserDid) return;

      markAttestationsAsSeen(currentUserDid, [attestationId]);
      setPendingAttestations(prev => prev.filter(att => att.id !== attestationId));
    },
    [currentUserDid]
  );

  const handleResetIdentity = useCallback(() => {
    if (onResetIdentity) {
      onResetIdentity();
    } else {
      localStorage.removeItem('narrative_shared_identity');
      // Also clear workspace list since it's tied to the identity
      localStorage.removeItem('narrativeWorkspaces');
      // Clear user document reference - new identity should get new user document
      localStorage.removeItem('narrative_user_doc_id');
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

  const handleCreateWorkspace = useCallback(
    (name: string, avatarDataUrl?: string) => {
      if (onCreateWorkspace) {
        onCreateWorkspace(name, avatarDataUrl);
      }
      closeNewWorkspaceModal();
    },
    [onCreateWorkspace, closeNewWorkspaceModal]
  );

  // Handler for mutual trust established (both users trust each other)
  const handleMutualTrustEstablished = useCallback(
    (friendDid: string, friendName: string) => {
      void friendDid; // Used for event tracking
      showToast(`${friendName} und du seid jetzt Freunde!`);
      setShowConfetti(true);
    },
    [showToast]
  );

  // Clear confetti after animation
  const clearConfetti = useCallback(() => {
    setShowConfetti(false);
  }, []);

  // Track mutual friends to detect new ones (for confetti outside QR modal)
  const previousMutualFriendsRef = useRef<Set<string>>(new Set());
  const mutualFriendsInitializedRef = useRef(false);

  // Create stable key for mutual friends detection
  const mutualFriendsKey = useMemo(() => {
    const givenDids = userDoc?.trustGiven ? Object.keys(userDoc.trustGiven).sort().join(',') : '';
    const receivedDids = userDoc?.trustReceived ? Object.keys(userDoc.trustReceived).sort().join(',') : '';
    return `${givenDids}||${receivedDids}`;
  }, [userDoc?.trustGiven, userDoc?.trustReceived]);

  // Auto-detect new mutual trust relationships (works even when QR modal is closed)
  useEffect(() => {
    if (!userDoc?.trustGiven || !userDoc?.trustReceived) return;

    // Find all mutual friends (both directions exist)
    const currentMutualFriends = new Set<string>();
    for (const did of Object.keys(userDoc.trustGiven)) {
      if (userDoc.trustReceived[did]) {
        currentMutualFriends.add(did);
      }
    }

    // On first run, just initialize the ref without triggering confetti
    if (!mutualFriendsInitializedRef.current) {
      previousMutualFriendsRef.current = currentMutualFriends;
      mutualFriendsInitializedRef.current = true;
      return;
    }

    // Detect newly established mutual trust
    for (const did of currentMutualFriends) {
      if (!previousMutualFriendsRef.current.has(did)) {
        // New mutual friend detected!
        const friendName = trustedUserProfiles[did]?.displayName || did.substring(0, 12) + '...';
        handleMutualTrustEstablished(did, friendName);
      }
    }

    // Update the ref for next comparison
    previousMutualFriendsRef.current = currentMutualFriends;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutualFriendsKey, trustedUserProfiles, handleMutualTrustEstablished]);

  // Props ready for NewWorkspaceModal
  const newWorkspaceModalProps = {
    isOpen: isNewWorkspaceModalOpen,
    onClose: closeNewWorkspaceModal,
    onCreate: handleCreateWorkspace,
  };

  // Props ready for TrustReciprocityModal
  // Show trust notifications even without a workspace (on start screen)
  const trustReciprocityModalProps = pendingAttestations.length > 0
    ? {
        pendingAttestations,
        doc: doc as BaseDocument<TData> | null, // Optional - may be null on start screen
        currentUserDid,
        onTrustUser: handleTrustUser, // Now uses QR scanning for proper verification
        onDecline: handleDeclineTrust,
        onShowToast: showToast,
        userDoc,
        userDocUrl,
        onOpenProfile: openProfile,
        onMutualTrustEstablished: handleMutualTrustEstablished,
        trustedUserProfiles,
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

  // Build document URL for sharing
  const documentUrl = documentId ? `${window.location.origin}${window.location.pathname}#doc=${documentId}` : undefined;

  // Handler to update workspace metadata (name, avatar)
  const handleUpdateWorkspace = useCallback((updates: { name?: string; avatar?: string }) => {
    if (!docHandle) return;

    docHandle.change((d) => {
      if (!d.context) {
        d.context = { name: '' };
      }
      if (updates.name !== undefined) {
        d.context.name = updates.name;
      }
      if (updates.avatar !== undefined) {
        d.context.avatar = updates.avatar;
      }
      d.lastModified = Date.now();
    });
  }, [docHandle]);

  // Build navbar props (works with or without doc - shell should function without workspace)
  // The navbar needs UserDocument for profile/WoT, not necessarily the workspace document
  const navbarProps = {
    currentUserDid,
    doc: doc as BaseDocument<TData> | null,
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
    userDocUrl,
    trustedUserProfiles,
    knownProfiles,
    getProfile,
    registerExternalDoc,
    onOpenProfile: openProfile,
    onMutualTrustEstablished: handleMutualTrustEstablished,
    documentUrl,
    onUpdateWorkspace: handleUpdateWorkspace,
  };

  return {
    identity,
    currentUserDid,
    workspaces,
    currentWorkspace,
    hiddenUserDids,
    toastMessage,
    isNewWorkspaceModalOpen,
    showConfetti,
    clearConfetti,
    pendingAttestations,
    hasPendingTrust: pendingAttestations.length > 0,
    trustedUserProfiles,
    knownProfiles,
    getProfile,
    registerExternalDoc,
    handleSwitchWorkspace,
    handleNewWorkspace,
    handleUpdateIdentity,
    handleTrustUser,
    handleRevokeTrust,
    handleTrustBack,
    handleDeclineTrust,
    handleResetIdentity,
    handleMutualTrustEstablished,
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
