/**
 * AppShell - Generic application shell for Narrative apps
 *
 * Handles:
 * - Automerge repo initialization
 * - Document creation/loading (URL hash + localStorage)
 * - Identity management (DID generation + localStorage)
 * - Fake DID migration
 * - Optional: User Document initialization (personal cross-workspace data)
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Repo, DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import { RepoContext } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId } from '@automerge/automerge-repo';
import { generateDidIdentity, isFakeDid } from '../utils/did';
import type { UserIdentity } from '../schema/identity';
import type { UserDocument } from '../schema/userDocument';
import { createUserDocument } from '../schema/userDocument';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  clearSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  clearDocumentId,
} from '../utils/storage';
import {
  loadUserDocId,
  saveUserDocId,
  clearUserDocId,
} from '../hooks/useUserDocument';
import { LoadingScreen, DocumentLoadingScreen } from './LoadingScreen';
import { initDebugTools, updateDebugState } from '../utils/debug';
import { useCrossTabSync } from '../hooks/useCrossTabSync';
import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { DebugDashboard } from './DebugDashboard';

/** Timeout for a single document loading attempt (ms) */
const DOC_LOAD_TIMEOUT = 8000;

/** Max retry attempts for document loading */
const MAX_RETRY_ATTEMPTS = 10;

/** Delay between retries (ms) - exponential backoff starting point */
const RETRY_DELAY_BASE = 2000;

/** Time after which to show "create new document" option (ms) */
const SHOW_CREATE_NEW_AFTER = 20000;

export interface AppShellChildProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;

  // User Document (optional, only if enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;

  // Debug Dashboard controls
  onToggleDebugDashboard: () => void;
}

export interface AppShellProps<TDoc> {
  /**
   * Automerge repo instance
   * (can be created by useRepository hook or passed directly)
   */
  repo: Repo;

  /**
   * Factory function to create empty document with user identity
   * @param identity - User identity
   * @param workspaceName - Optional workspace name
   * @param workspaceAvatar - Optional workspace avatar (data URL)
   */
  createEmptyDocument: (identity: UserIdentity, workspaceName?: string, workspaceAvatar?: string) => TDoc;

  /**
   * localStorage key prefix for this app (e.g., 'narrative', 'mapapp')
   * Used for storing document ID: `${storagePrefix}_docId`
   */
  storagePrefix: string;

  /**
   * Enable User Document for cross-workspace personal data
   * When true, AppShell will also initialize/load the user's personal document
   * @default false
   */
  enableUserDocument?: boolean;

  /**
   * Render function that receives initialized document and identity
   */
  children: (props: AppShellChildProps) => ReactNode;
}

/**
 * Generic app shell that handles document and identity initialization
 *
 * @example
 * ```tsx
 * <AppShell
 *   repo={repo}
 *   createEmptyDocument={createEmptyOpinionGraphDoc}
 *   storagePrefix="narrative"
 * >
 *   {(props) => <MainView {...props} />}
 * </AppShell>
 * ```
 */
export function AppShell<TDoc>({
  repo,
  createEmptyDocument,
  storagePrefix,
  enableUserDocument = false,
  children,
}: AppShellProps<TDoc>) {
  // Core state
  const [documentId, setDocumentId] = useState<DocumentId | null>(null);
  const [currentUserDid, setCurrentUserDid] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | undefined>(undefined);
  const [publicKey, setPublicKey] = useState<string | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);

  // Loading state
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadStartTimeRef = useRef<number | null>(null);

  // User Document state (optional)
  const [userDocId, setUserDocId] = useState<string | undefined>(undefined);
  const [userDocHandle, setUserDocHandle] = useState<DocHandle<UserDocument> | undefined>(undefined);

  // Debug Dashboard state
  const [showDebugDashboard, setShowDebugDashboard] = useState(false);

  // Stored identity for document creation
  const storedIdentityRef = useRef<UserIdentity | null>(null);

  // Initialize debug tools on mount and set repo
  useEffect(() => {
    initDebugTools();
    updateDebugState({ repo });
  }, [repo]);

  // Cross-tab sync: reload when identity changes in another tab
  useCrossTabSync({
    autoReloadOnIdentityChange: true,
  });

  // Update debug state when userDocHandle changes
  useEffect(() => {
    if (!userDocHandle) return;

    const userDocUrl = userDocHandle.url;

    // Initial update
    const doc = userDocHandle.doc();
    if (doc) {
      updateDebugState({ userDoc: doc, userDocUrl });
    }

    // Subscribe to changes
    const onChange = () => {
      const updatedDoc = userDocHandle.doc();
      updateDebugState({ userDoc: updatedDoc, userDocUrl });
    };

    userDocHandle.on('change', onChange);
    return () => {
      userDocHandle.off('change', onChange);
    };
  }, [userDocHandle]);

  // Track elapsed time during document loading
  useEffect(() => {
    if (!isLoadingDocument) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      if (loadStartTimeRef.current) {
        setElapsedTime(Date.now() - loadStartTimeRef.current);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isLoadingDocument]);

  // Listen to URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const newDocId = params.get('doc');
      if (newDocId && newDocId !== documentId) {
        setDocumentId(newDocId as DocumentId);
        saveDocumentId(storagePrefix, newDocId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentId, storagePrefix]);

  /**
   * Initialize or load the User Document
   * This is a personal document that syncs across workspaces
   */
  const initializeUserDocument = useCallback(async (identity: { did: string; displayName?: string }) => {
    const savedUserDocId = loadUserDocId();

    let handle: DocHandle<UserDocument>;

    if (savedUserDocId) {
      // Try to load existing user document
      try {
        console.log(`[AppShell] Loading user document: ${savedUserDocId.substring(0, 30)}...`);

        // Add timeout for user document loading
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('User document load timeout')), DOC_LOAD_TIMEOUT);
        });

        // In automerge-repo v2.x, find() returns a Promise that resolves when ready
        handle = await Promise.race([
          repo.find<UserDocument>(savedUserDocId as AutomergeUrl),
          timeoutPromise,
        ]);

        // Verify the document belongs to this user
        const doc = handle.doc();
        if (!doc) {
          console.warn('[AppShell] User document loaded but doc() returned null');
          throw new Error('User document empty');
        }

        if (doc.did !== identity.did) {
          console.warn('[AppShell] User document DID mismatch, creating new document');
          // Create new document instead
          handle = repo.create<UserDocument>();
          handle.change((d) => {
            const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
            Object.assign(d, newDoc);
          });
          saveUserDocId(handle.url);
        } else {
          console.log('[AppShell] User document loaded successfully');
        }
      } catch (e) {
        console.warn('[AppShell] Failed to load user document, creating new one:', e);
        // Clear old user doc ID and create new document
        clearUserDocId();
        handle = repo.create<UserDocument>();
        handle.change((d) => {
          const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
          Object.assign(d, newDoc);
        });
        saveUserDocId(handle.url);
        console.log('[AppShell] New user document created:', handle.url.substring(0, 30));
      }
    } else {
      // Create new user document
      console.log('[AppShell] No saved user document, creating new one');
      handle = repo.create<UserDocument>();
      handle.change((d) => {
        const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
        Object.assign(d, newDoc);
      });
      saveUserDocId(handle.url);
      console.log('[AppShell] New user document created:', handle.url.substring(0, 30));
    }

    setUserDocId(handle.url);
    setUserDocHandle(handle);
  }, [repo]);

  /**
   * Try to load a document with automatic retries and exponential backoff
   */
  const loadDocumentWithRetry = useCallback(async (
    docId: string,
    attempt: number,
    identity: UserIdentity
  ): Promise<boolean> => {
    const normalizedDocId = docId.startsWith('automerge:') ? docId : `automerge:${docId}`;

    // Validate AutomergeUrl format
    if (!isValidAutomergeUrl(normalizedDocId)) {
      console.error('[AppShell] Invalid document ID format:', docId);
      clearDocumentId(storagePrefix);
      // Create new document instead
      const handle = repo.create(createEmptyDocument(identity));
      setDocumentId(handle.documentId);
      saveDocumentId(storagePrefix, handle.documentId);
      window.location.hash = `doc=${handle.documentId}`;
      return true;
    }

    try {
      console.log(`[AppShell] Loading document (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}): ${normalizedDocId.substring(0, 30)}...`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Document load timeout')), DOC_LOAD_TIMEOUT);
      });

      const handle = await Promise.race([
        repo.find(normalizedDocId as AutomergeUrl),
        timeoutPromise,
      ]);

      // Verify document was actually loaded
      const doc = handle.doc();
      if (!doc) {
        throw new Error('Document not found or empty');
      }

      console.log(`[AppShell] Document loaded successfully`);
      setDocumentId(handle.documentId);
      saveDocumentId(storagePrefix, handle.documentId);

      // Update URL if not already there
      const urlParams = new URLSearchParams(window.location.hash.substring(1));
      if (!urlParams.get('doc')) {
        window.location.hash = `doc=${docId}`;
      }

      return true;
    } catch (error) {
      console.warn(`[AppShell] Attempt ${attempt + 1} failed:`, error);
      return false;
    }
  }, [repo, storagePrefix, createEmptyDocument]);

  /**
   * Main initialization function
   */
  const initializeDocument = useCallback(async () => {
    // Check URL for shared document ID
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const urlDocId = urlParams.get('doc');
    const savedDocId = loadDocumentId(storagePrefix);
    const savedIdentity = loadSharedIdentity();

    // Migration: Check for fake DIDs and reset
    if (savedIdentity && isFakeDid(savedIdentity.did)) {
      console.warn('Detected fake DID. Upgrading to real DIDs...');
      clearSharedIdentity();
      clearDocumentId(storagePrefix);
      alert('Upgraded to secure DIDs. Your identity has been reset.');
      window.location.hash = '';
      window.location.reload();
      return;
    }

    // Generate or load identity
    let identity = savedIdentity;
    if (!identity) {
      const didIdentity = await generateDidIdentity(
        `User-${Math.random().toString(36).substring(7)}`
      );
      identity = {
        did: didIdentity.did,
        displayName: didIdentity.displayName,
        publicKey: didIdentity.publicKey,
        privateKey: didIdentity.privateKey,
      };
      saveSharedIdentity(identity);
    }

    setCurrentUserDid(identity.did);
    setPrivateKey(identity.privateKey);
    setPublicKey(identity.publicKey);
    setDisplayName(identity.displayName);
    storedIdentityRef.current = identity;

    // Initialize User Document if enabled
    if (enableUserDocument) {
      await initializeUserDocument(identity);
    }

    const docIdToUse = urlDocId || savedDocId;

    if (docIdToUse) {
      // Start document loading with retries
      setIsInitializing(false);
      setIsLoadingDocument(true);
      setLoadingDocId(docIdToUse);
      loadStartTimeRef.current = Date.now();

      // Try loading with automatic retries
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        setRetryCount(attempt);

        const success = await loadDocumentWithRetry(docIdToUse, attempt, identity);
        if (success) {
          setIsLoadingDocument(false);
          setLoadingDocId(null);
          return;
        }

        // Wait before next retry (exponential backoff)
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.log(`[AppShell] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // All retries failed - keep showing loading screen with create option
      console.error('[AppShell] All retry attempts failed');
      // Keep retryCount at last attempt (MAX_RETRY_ATTEMPTS - 1) so display shows correct number
      setRetryCount(MAX_RETRY_ATTEMPTS - 1);
    } else {
      // No document to load - create new one
      const handle = repo.create(createEmptyDocument(identity));
      setDocumentId(handle.documentId);
      saveDocumentId(storagePrefix, handle.documentId);
      window.location.hash = `doc=${handle.documentId}`;
      setIsInitializing(false);
    }
  }, [repo, storagePrefix, createEmptyDocument, enableUserDocument, initializeUserDocument, loadDocumentWithRetry]);

  // Initialize on mount
  useEffect(() => {
    initializeDocument();
  }, [initializeDocument]);

  const handleResetIdentity = useCallback(() => {
    clearSharedIdentity();
    if (enableUserDocument) {
      clearUserDocId();
    }

    // Remove profile parameter from URL before reload to avoid landing on deleted user's profile
    const hash = window.location.hash;
    if (hash.includes('profile=')) {
      const newHash = hash
        .replace(/&?profile=[^&]+/, '')
        .replace(/^#&/, '#')
        .replace(/&#/, '#');
      if (newHash === '#' || newHash === '') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
      }
    }

    window.location.reload();
  }, [enableUserDocument]);

  const handleNewDocument = useCallback(async (workspaceName?: string, workspaceAvatar?: string) => {
    const identity = storedIdentityRef.current || loadSharedIdentity();

    if (!identity) {
      const didIdentity = await generateDidIdentity(
        `User-${Math.random().toString(36).substring(7)}`
      );
      const newIdentity = {
        did: didIdentity.did,
        displayName: didIdentity.displayName,
        publicKey: didIdentity.publicKey,
        privateKey: didIdentity.privateKey,
      };
      saveSharedIdentity(newIdentity);
      storedIdentityRef.current = newIdentity;
    }

    const effectiveIdentity = storedIdentityRef.current!;
    const handle = repo.create(createEmptyDocument(effectiveIdentity, workspaceName, workspaceAvatar));
    const docId = handle.documentId;
    saveDocumentId(storagePrefix, docId);

    // Update state
    setDocumentId(docId);
    setIsLoadingDocument(false);
    setLoadingDocId(null);

    // Push new hash
    const url = new URL(window.location.href);
    url.hash = `doc=${docId}`;
    window.history.pushState(null, '', url.toString());
  }, [repo, createEmptyDocument, storagePrefix]);

  const handleCreateNewFromLoading = useCallback(() => {
    clearDocumentId(storagePrefix);
    window.location.hash = '';
    handleNewDocument();
  }, [storagePrefix, handleNewDocument]);

  // Show basic loading while initializing identity
  if (isInitializing) {
    return <LoadingScreen message="Initialisiere..." />;
  }

  // Show document loading screen with animation
  if (isLoadingDocument) {
    return (
      <DocumentLoadingScreen
        documentId={loadingDocId || undefined}
        attempt={retryCount + 1}
        maxAttempts={MAX_RETRY_ATTEMPTS}
        elapsedTime={elapsedTime}
        onCreateNew={handleCreateNewFromLoading}
        showCreateNewAfter={SHOW_CREATE_NEW_AFTER}
      />
    );
  }

  // Safety check
  if (!documentId || !currentUserDid) {
    return <LoadingScreen message="Initialisiere..." />;
  }

  return (
    <RepoContext.Provider value={repo}>
      {children({
        documentId,
        currentUserDid,
        privateKey,
        publicKey,
        displayName,
        onResetIdentity: handleResetIdentity,
        onNewDocument: handleNewDocument,
        onToggleDebugDashboard: () => setShowDebugDashboard(prev => !prev),
        // User Document (only if enabled)
        ...(enableUserDocument && {
          userDocId,
          userDocHandle,
        }),
      })}
      {/* Debug Dashboard - controlled via navbar menu */}
      <DebugDashboard
        isOpen={showDebugDashboard}
        onClose={() => setShowDebugDashboard(false)}
      />
    </RepoContext.Provider>
  );
}