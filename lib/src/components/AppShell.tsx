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
  importIdentityFromFile,
} from '../utils/storage';
import {
  loadUserDocId,
  saveUserDocId,
  clearUserDocId,
} from '../hooks/useUserDocument';
import { LoadingScreen } from './LoadingScreen';
import { initDebugTools, updateDebugState } from '../utils/debug';
import { useCrossTabSync } from '../hooks/useCrossTabSync';
import { isValidAutomergeUrl } from '@automerge/automerge-repo';
import { DebugDashboard } from './DebugDashboard';
import { OwnUserDocLoader } from './OwnUserDocLoader';
import { WorkspaceDocLoader } from './WorkspaceDocLoader';

/** Time in seconds after which to show "create new document" option */
const SHOW_CREATE_NEW_AFTER_SECONDS = 60;

export interface WorkspaceLoadingState {
  /** Whether the workspace document is currently loading */
  isLoading: boolean;
  /** Document URL being loaded (if any) */
  documentUrl?: string;
  /** Seconds elapsed since loading started */
  secondsElapsed: number;
  /** Callback to create a new document instead */
  onCreateNew: () => void;
  /** Seconds after which to show "create new" option */
  showCreateNewAfterSeconds: number;
}

/**
 * Content state for the app:
 * - 'start': No workspace loaded, show start/onboarding content
 * - 'loading': Workspace is being loaded
 * - 'ready': Workspace is loaded and ready
 */
export type ContentState = 'start' | 'loading' | 'ready';

export interface AppShellChildProps {
  /** Document ID (may be null while loading or in start state) */
  documentId: DocumentId | null;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;

  // User Document (optional, only if enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;

  // Workspace loading state (for showing loading UI in content area)
  workspaceLoading?: WorkspaceLoadingState;

  // Debug Dashboard controls
  onToggleDebugDashboard: () => void;

  // Content state: determines what content area should show
  contentState: ContentState;

  // Callback when user wants to join a workspace
  onJoinWorkspace: (docUrl: string) => void;

  // Callback to cancel loading and return to start state
  onCancelLoading: () => void;

  // Callback to go to start screen (from workspace switcher when in ready state)
  onGoToStart: () => void;

  // Callback to switch workspace without page reload
  onSwitchWorkspace: (workspaceId: string) => void;

  // Callback to import identity (handles state update without page reload)
  onImportIdentity: () => void;
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
  // Workspace URL to load (triggers WorkspaceDocLoader when set)
  const [workspaceUrlToLoad, setWorkspaceUrlToLoad] = useState<string | null>(null);
  // Seconds counter for loading UI
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  // Onboarding state (when no workspace exists)
  const [isOnboarding, setIsOnboarding] = useState(false);

  // User Document state (optional)
  const [userDocId, setUserDocId] = useState<string | undefined>(undefined);
  const [userDocHandle, setUserDocHandle] = useState<DocHandle<UserDocument> | undefined>(undefined);
  // URL to load (triggers OwnUserDocLoader when set)
  const [savedUserDocUrl, setSavedUserDocUrl] = useState<string | null>(null);

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

  // Seconds counter for workspace loading UI
  useEffect(() => {
    if (!workspaceUrlToLoad) {
      setLoadingSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [workspaceUrlToLoad]);

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
   * Create a new UserDocument for the given identity
   */
  const createNewUserDocument = useCallback((identity: { did: string; displayName?: string }) => {
    console.log('[AppShell] Creating new user document');
    const handle = repo.create<UserDocument>();
    handle.change((d) => {
      const newDoc = createUserDocument(identity.did, identity.displayName || 'User');
      Object.assign(d, newDoc);
    });
    saveUserDocId(handle.url);
    setUserDocHandle(handle);
    setUserDocId(handle.url);
    setSavedUserDocUrl(null); // Clear loading URL
    console.log('[AppShell] New user document created:', handle.url.substring(0, 30));
  }, [repo]);

  /**
   * Callback when OwnUserDocLoader successfully loads the UserDocument
   */
  const handleUserDocLoaded = useCallback((handle: DocHandle<UserDocument>, doc: UserDocument) => {
    console.log('[AppShell] User document loaded via OwnUserDocLoader');
    setUserDocHandle(handle);
    setUserDocId(handle.url);
    setSavedUserDocUrl(null); // Clear loading URL
  }, []);

  /**
   * Callback when UserDocument is unavailable (not found)
   */
  const handleUserDocUnavailable = useCallback(() => {
    console.warn('[AppShell] User document unavailable, creating new one');
    clearUserDocId();
    const identity = storedIdentityRef.current;
    if (identity) {
      createNewUserDocument(identity);
    }
  }, [createNewUserDocument]);

  /**
   * Callback when UserDocument DID doesn't match expected
   */
  const handleUserDocDidMismatch = useCallback((actualDid: string) => {
    console.warn('[AppShell] User document DID mismatch:', actualDid);
    clearUserDocId();
    setSavedUserDocUrl(null);
    const identity = storedIdentityRef.current;
    if (identity) {
      createNewUserDocument(identity);
    }
  }, [createNewUserDocument]);

  /**
   * Callback when WorkspaceDocLoader successfully loads the workspace
   */
  const handleWorkspaceLoaded = useCallback((loadedDocumentId: DocumentId) => {
    console.log('[AppShell] Workspace loaded via WorkspaceDocLoader');
    setDocumentId(loadedDocumentId);
    saveDocumentId(storagePrefix, loadedDocumentId);
    setWorkspaceUrlToLoad(null); // Clear loading URL
    setIsOnboarding(false);

    // Update URL if not already there
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    if (!urlParams.get('doc')) {
      window.location.hash = `doc=${loadedDocumentId}`;
    }
  }, [storagePrefix]);

  /**
   * Callback when workspace document is unavailable
   */
  const handleWorkspaceUnavailable = useCallback(() => {
    console.warn('[AppShell] Workspace document unavailable');
    // Keep loading state - user can choose to create new or keep waiting
    // The UI will show the "create new" button after SHOW_CREATE_NEW_AFTER_SECONDS
  }, []);

  /**
   * Start loading a workspace document
   */
  const startWorkspaceLoading = useCallback((docUrl: string) => {
    const normalizedUrl = docUrl.startsWith('automerge:') ? docUrl : `automerge:${docUrl}`;

    // Validate AutomergeUrl format
    if (!isValidAutomergeUrl(normalizedUrl)) {
      console.error('[AppShell] Invalid document URL format:', docUrl);
      clearDocumentId(storagePrefix);
      setIsOnboarding(true);
      return;
    }

    console.log('[AppShell] Starting workspace loading:', normalizedUrl.substring(0, 30));
    setWorkspaceUrlToLoad(normalizedUrl);
    setIsOnboarding(false);
  }, [storagePrefix]);

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
      const existingUserDocUrl = loadUserDocId();
      if (existingUserDocUrl) {
        // Trigger OwnUserDocLoader by setting the URL
        console.log('[AppShell] Found saved user document, loading via OwnUserDocLoader:', existingUserDocUrl.substring(0, 30));
        setSavedUserDocUrl(existingUserDocUrl);
      } else {
        // No saved document - create new one immediately
        createNewUserDocument(identity);
      }
    }

    const docIdToUse = urlDocId || savedDocId;

    // Done initializing - now either load workspace or show start screen
    setIsInitializing(false);

    if (docIdToUse) {
      // Start loading workspace via WorkspaceDocLoader
      startWorkspaceLoading(docIdToUse);
    } else {
      // No document to load - show start screen
      console.log('[AppShell] No workspace found, showing start screen');
      setIsOnboarding(true);
    }
  }, [repo, storagePrefix, createEmptyDocument, enableUserDocument, createNewUserDocument, startWorkspaceLoading]);

  // Initialize on mount
  useEffect(() => {
    initializeDocument();
  }, [initializeDocument]);

  const handleResetIdentity = useCallback(() => {
    clearSharedIdentity();
    if (enableUserDocument) {
      clearUserDocId();
    }
    // Clear workspace list since it's tied to the identity
    localStorage.removeItem('narrativeWorkspaces');
    // Clear current document for this app
    clearDocumentId(storagePrefix);

    // Clear URL hash completely to go back to start screen
    history.replaceState(null, '', window.location.pathname + window.location.search);

    window.location.reload();
  }, [enableUserDocument, storagePrefix]);

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
    setWorkspaceUrlToLoad(null); // Clear any loading state
    setIsOnboarding(false); // Exit onboarding/start state

    // Push new hash
    const url = new URL(window.location.href);
    url.hash = `doc=${docId}`;
    window.history.pushState(null, '', url.toString());
  }, [repo, createEmptyDocument, storagePrefix]);

  const handleCreateNewFromLoading = useCallback(() => {
    clearDocumentId(storagePrefix);
    setWorkspaceUrlToLoad(null);
    window.location.hash = '';
    handleNewDocument();
  }, [storagePrefix, handleNewDocument]);

  // Handler to cancel loading and return to start state
  const handleCancelLoading = useCallback(() => {
    console.log('[AppShell] Canceling document loading, returning to start');
    setWorkspaceUrlToLoad(null);
    clearDocumentId(storagePrefix);
    window.location.hash = '';
    setIsOnboarding(true);
  }, [storagePrefix]);

  // Handler to go to start screen (from ready state via workspace switcher)
  const handleGoToStart = useCallback(() => {
    console.log('[AppShell] Going to start screen');
    setDocumentId(null);
    clearDocumentId(storagePrefix);
    window.location.hash = '';
    setIsOnboarding(true);
  }, [storagePrefix]);

  // Handle workspace switch (from WorkspaceSwitcher dropdown) - no page reload
  const handleSwitchWorkspace = useCallback((workspaceId: string) => {
    console.log('[AppShell] Switching to workspace:', workspaceId);
    // Clear current document to trigger loading state
    setDocumentId(null);
    startWorkspaceLoading(workspaceId);
  }, [startWorkspaceLoading]);

  // Handler when user wants to join a workspace - no page reload
  const handleJoinWorkspace = useCallback((docUrl: string) => {
    console.log('[AppShell] Joining workspace:', docUrl);
    // Clear current document to trigger loading state
    setDocumentId(null);
    startWorkspaceLoading(docUrl);
  }, [startWorkspaceLoading]);

  // Handler for identity import - updates state without page reload
  const handleImportIdentity = useCallback(() => {
    importIdentityFromFile(
      (importedIdentity) => {
        console.log('[AppShell] Identity imported:', importedIdentity.did);
        // Update identity state
        setCurrentUserDid(importedIdentity.did);
        setPrivateKey(importedIdentity.privateKey);
        setPublicKey(importedIdentity.publicKey);
        setDisplayName(importedIdentity.displayName);
        storedIdentityRef.current = importedIdentity;

        // Go to start screen to show imported profile
        setDocumentId(null);
        clearDocumentId(storagePrefix);
        setIsOnboarding(true);

        // Set URL to show profile - preserve clean state
        window.location.hash = `profile=${encodeURIComponent(importedIdentity.did)}`;

        // Re-initialize UserDocument with imported identity (loads from restored userDocUrl)
        if (enableUserDocument) {
          // Clear existing handle to trigger re-loading
          setUserDocHandle(undefined);
          setUserDocId(undefined);
          const existingUserDocUrl = loadUserDocId();
          if (existingUserDocUrl) {
            // Trigger OwnUserDocLoader
            setSavedUserDocUrl(existingUserDocUrl);
          } else {
            createNewUserDocument(importedIdentity);
          }
        }
      },
      (error) => {
        console.error('[AppShell] Import failed:', error);
      }
    );
  }, [storagePrefix, enableUserDocument, createNewUserDocument]);

  // Show basic loading while initializing identity and user document
  // Once identity is ready, we render the shell even if workspace is still loading
  if (isInitializing || !currentUserDid) {
    return <LoadingScreen message="Initialisiere..." />;
  }

  // Determine content state based on current loading/onboarding status
  const isLoadingWorkspace = workspaceUrlToLoad !== null && documentId === null;
  const contentState: ContentState =
    isOnboarding ? 'start' :
    isLoadingWorkspace ? 'loading' :
    'ready';

  // Build workspace loading state for children
  const workspaceLoading: WorkspaceLoadingState | undefined = isLoadingWorkspace
    ? {
        isLoading: true,
        documentUrl: workspaceUrlToLoad || undefined,
        secondsElapsed: loadingSeconds,
        onCreateNew: handleCreateNewFromLoading,
        showCreateNewAfterSeconds: SHOW_CREATE_NEW_AFTER_SECONDS,
      }
    : undefined;

  return (
    <RepoContext.Provider value={repo}>
      {/* OwnUserDocLoader - loads user document reactively when URL is set */}
      {enableUserDocument && savedUserDocUrl && !userDocHandle && (
        <OwnUserDocLoader
          url={savedUserDocUrl}
          expectedDid={currentUserDid}
          onLoaded={handleUserDocLoaded}
          onUnavailable={handleUserDocUnavailable}
          onDidMismatch={handleUserDocDidMismatch}
        />
      )}
      {/* WorkspaceDocLoader - loads workspace document reactively when URL is set */}
      {workspaceUrlToLoad && !documentId && (
        <WorkspaceDocLoader
          url={workspaceUrlToLoad}
          onLoaded={handleWorkspaceLoaded}
          onUnavailable={handleWorkspaceUnavailable}
        />
      )}
      {children({
        documentId,
        currentUserDid,
        privateKey,
        publicKey,
        displayName,
        onResetIdentity: handleResetIdentity,
        onNewDocument: handleNewDocument,
        onToggleDebugDashboard: () => setShowDebugDashboard(prev => !prev),
        // Content state: determines what content area should show
        contentState,
        // Callbacks for content state transitions
        onJoinWorkspace: handleJoinWorkspace,
        onCancelLoading: handleCancelLoading,
        onGoToStart: handleGoToStart,
        onSwitchWorkspace: handleSwitchWorkspace,
        onImportIdentity: handleImportIdentity,
        // Workspace loading state (when document is still loading)
        workspaceLoading,
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