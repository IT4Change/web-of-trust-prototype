/**
 * UnifiedApp - Main application with module switching
 *
 * Handles:
 * - Document creation/loading from URL hash
 * - Identity management (DID generation, localStorage)
 * - Module switching UI
 * - Shared infrastructure (Trust, Collaborators)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRepo, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId, DocHandle } from '@automerge/automerge-repo';
import {
  generateDidIdentity,
  loadSharedIdentity,
  saveSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  ProfileModal,
  CollaboratorsModal,
  UserAvatar,
  addTrustAttestation,
  useTrustNotifications,
  TrustReciprocityModal,
  Toast,
  QRScannerModal,
} from 'narrative-ui';
import type { UserIdentity } from 'narrative-ui';
import { UnifiedDocument, createEmptyUnifiedDoc, AVAILABLE_MODULES, ModuleId } from './types';
import { ModuleSwitcher } from './components/ModuleSwitcher';
import { NarrativeModuleWrapper } from './components/NarrativeModuleWrapper';
import { MarketModuleWrapper } from './components/MarketModuleWrapper';
import { MapModuleWrapper } from './components/MapModuleWrapper';
import {
  WorkspaceSwitcher,
  loadWorkspaceList,
  saveWorkspaceList,
  upsertWorkspace,
  type WorkspaceInfo,
} from './components/WorkspaceSwitcher';
import { NewWorkspaceModal } from './components/NewWorkspaceModal';

/**
 * Main Unified Application Component
 */
export function UnifiedApp() {
  const repo = useRepo();

  // Identity state
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(true);

  // Document state
  const [documentId, setDocumentId] = useState<DocumentId | null>(null);
  const [docHandle, setDocHandle] = useState<DocHandle<UnifiedDocument> | null>(null);

  // UI state
  const [activeModule, setActiveModule] = useState<ModuleId>('narrative');
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showVerifyScanner, setShowVerifyScanner] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>(() => loadWorkspaceList());

  // Document from Automerge
  const [doc] = useDocument<UnifiedDocument>(documentId ?? undefined);

  // Trust notifications
  const { pendingAttestations, markAsSeen } = useTrustNotifications(
    doc,
    identity?.did ?? '',
    documentId?.toString() ?? ''
  );

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Initialize identity on mount
  useEffect(() => {
    async function initIdentity() {
      setIsLoadingIdentity(true);

      // Try to load existing identity
      const savedIdentity = loadSharedIdentity();
      if (savedIdentity) {
        setIdentity(savedIdentity);
        setIsLoadingIdentity(false);
        return;
      }

      // Generate new identity
      const newIdentity = await generateDidIdentity();
      saveSharedIdentity(newIdentity);
      setIdentity(newIdentity);
      setIsLoadingIdentity(false);
    }

    initIdentity();
  }, []);

  // Initialize document from URL hash or localStorage
  useEffect(() => {
    if (!identity || !repo) return;

    // Check URL hash first
    const hash = window.location.hash;
    const match = hash.match(/#doc=(.+)/);

    if (match) {
      const docId = match[1] as DocumentId;
      setDocumentId(docId);
      saveDocumentId('unifiedDocId', docId);
      const handle = repo.find<UnifiedDocument>(docId);
      setDocHandle(handle);
      return;
    }

    // Check localStorage
    const savedDocIdStr = loadDocumentId('unifiedDocId');
    if (savedDocIdStr) {
      const savedDocId = savedDocIdStr as DocumentId;
      setDocumentId(savedDocId);
      window.location.hash = `doc=${savedDocId}`;
      const handle = repo.find<UnifiedDocument>(savedDocId);
      setDocHandle(handle);
      return;
    }

    // Create new document
    const newDoc = createEmptyUnifiedDoc(identity);
    const handle = repo.create<UnifiedDocument>(newDoc);
    const newDocId = handle.documentId;
    setDocumentId(newDocId);
    setDocHandle(handle);
    saveDocumentId('unifiedDocId', newDocId);
    window.location.hash = `doc=${newDocId}`;
  }, [identity, repo]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#doc=(.+)/);
      if (match && match[1] !== documentId) {
        const newDocId = match[1] as DocumentId;
        setDocumentId(newDocId);
        saveDocumentId('unifiedDocId', newDocId);
        if (repo) {
          const handle = repo.find<UnifiedDocument>(newDocId);
          setDocHandle(handle);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentId, repo]);

  // Track current workspace in list
  useEffect(() => {
    if (!documentId || !doc) return;

    const workspaceInfo: WorkspaceInfo = {
      id: documentId.toString(),
      name: doc.context?.name || 'Workspace',
      avatar: doc.context?.avatar,
      lastAccessed: Date.now(),
    };

    setWorkspaces((prev) => {
      const updated = upsertWorkspace(prev, workspaceInfo);
      saveWorkspaceList(updated);
      return updated;
    });
  }, [documentId, doc?.context?.name, doc?.context?.avatar]);

  // Get current workspace info
  const currentWorkspace: WorkspaceInfo | null =
    documentId && doc
      ? {
          id: documentId.toString(),
          name: doc.context?.name || 'Workspace',
          avatar: doc.context?.avatar,
          lastAccessed: Date.now(),
        }
      : null;

  // Handlers
  const handleSwitchWorkspace = useCallback(
    (workspaceId: string) => {
      if (!repo) return;

      const docId = workspaceId as DocumentId;
      setDocumentId(docId);
      saveDocumentId('unifiedDocId', docId);
      window.location.hash = `doc=${docId}`;
      const handle = repo.find<UnifiedDocument>(docId);
      setDocHandle(handle);
    },
    [repo]
  );

  const handleCreateWorkspace = useCallback(
    (name: string, avatarDataUrl?: string) => {
      if (!identity || !repo) return;

      const newDoc = createEmptyUnifiedDoc(identity);
      // Set workspace name and avatar
      newDoc.context = {
        name,
        avatar: avatarDataUrl,
      };

      const handle = repo.create<UnifiedDocument>(newDoc);
      const newDocId = handle.documentId;
      setDocumentId(newDocId);
      setDocHandle(handle);
      saveDocumentId('unifiedDocId', newDocId);
      window.location.hash = `doc=${newDocId}`;

      // Add to workspace list
      const newWorkspace: WorkspaceInfo = {
        id: newDocId.toString(),
        name,
        avatar: avatarDataUrl,
        lastAccessed: Date.now(),
      };
      setWorkspaces((prev) => {
        const updated = upsertWorkspace(prev, newWorkspace);
        saveWorkspaceList(updated);
        return updated;
      });
    },
    [identity, repo]
  );

  const handleNewDocument = useCallback(() => {
    // Open the modal instead of creating directly
    setShowNewWorkspaceModal(true);
  }, []);

  const handleResetIdentity = useCallback(() => {
    localStorage.removeItem('narrativeIdentity');
    window.location.reload();
  }, []);

  const handleTrustUser = useCallback(
    (trusteeDid: string) => {
      if (!docHandle || !identity) return;

      docHandle.change((d) => {
        addTrustAttestation(d, identity.did, trusteeDid, 'verified', 'in-person');
        d.lastModified = Date.now();
      });

      // Mark reciprocal attestation as seen
      const reciprocal = pendingAttestations.find(
        (att) => att.trusterDid === trusteeDid && att.trusteeDid === identity.did
      );
      if (reciprocal) {
        markAsSeen(reciprocal.id);
      }
    },
    [docHandle, identity, pendingAttestations, markAsSeen]
  );

  const handleTrustBack = useCallback(
    (trusterDid: string) => {
      if (!docHandle || !identity) return;

      docHandle.change((d) => {
        addTrustAttestation(d, identity.did, trusterDid, 'verified', 'in-person');
        d.lastModified = Date.now();
      });

      const attestation = pendingAttestations.find((att) => att.trusterDid === trusterDid);
      if (attestation) {
        markAsSeen(attestation.id);
      }
    },
    [docHandle, identity, pendingAttestations, markAsSeen]
  );

  const handleDeclineTrust = useCallback(
    (attestationId: string) => {
      markAsSeen(attestationId);
    },
    [markAsSeen]
  );

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

  const handleUpdateIdentity = useCallback(
    (updates: Partial<UserIdentity>) => {
      if (!identity || !docHandle) return;

      // Update local identity
      const updatedIdentity = { ...identity, ...updates };
      setIdentity(updatedIdentity);
      saveSharedIdentity(updatedIdentity);

      // Update document
      docHandle.change((d) => {
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
    },
    [identity, docHandle]
  );

  // Loading states
  if (isLoadingIdentity) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content">Initializing identity...</p>
        </div>
      </div>
    );
  }

  if (!doc || !identity || !docHandle) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-base-200 flex flex-col overflow-hidden">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg z-[600] flex-shrink-0">
        {/* Workspace Switcher - Left */}
        <div className="navbar-start">
          <WorkspaceSwitcher
            currentWorkspace={currentWorkspace}
            workspaces={workspaces}
            logoUrl={logoUrl}
            onSwitchWorkspace={handleSwitchWorkspace}
            onNewWorkspace={handleNewDocument}
          />
        </div>

        {/* Module Switcher - Center */}
        <div className="navbar-center">
          <ModuleSwitcher
            modules={AVAILABLE_MODULES}
            enabledModules={doc.enabledModules || { narrative: true }}
            activeModule={activeModule}
            onModuleChange={setActiveModule}
          />
        </div>

        {/* User Menu - Right */}
        <div className="navbar-end gap-2">
          <div className="flex items-center gap-2">
            <button
              className="w-11 h-11 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setShowIdentityModal(true)}
              title="Profil"
            >
              <UserAvatar
                did={identity.did}
                avatarUrl={doc.identities?.[identity.did]?.avatarUrl}
                size={44}
              />
            </button>
            <span className="hidden lg:block font-medium">
              {doc.identities?.[identity.did]?.displayName || 'Anonymous'}
            </span>
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-6 w-52 p-2 shadow"
            >
              <li>
                <a onClick={() => setShowIdentityModal(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </a>
              </li>
              <li>
                <a onClick={() => setShowFriendsModal(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Collaborators
                </a>
              </li>
              <li>
                <a onClick={() => setShowVerifyScanner(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Verify
                </a>
              </li>
              <div className="divider my-1"></div>
              <li>
                <a onClick={handleNewDocument}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                  New Workspace
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Module Content */}
      {activeModule === 'map' ? (
        // Map module: fullscreen flex layout
        <div className="flex-1 relative overflow-hidden">
          <MapModuleWrapper
            doc={doc}
            docHandle={docHandle}
            identity={identity}
            hiddenUserDids={hiddenUserDids}
          />
        </div>
      ) : (
        // Other modules: scrollable container with padding
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="container mx-auto p-10 pt-8 pb-24 max-w-6xl w-full">
            {activeModule === 'narrative' && doc.data.narrative && (
              <NarrativeModuleWrapper
                doc={doc}
                docHandle={docHandle}
                identity={identity}
                hiddenUserDids={hiddenUserDids}
              />
            )}

            {activeModule === 'market' && (
              <MarketModuleWrapper
                doc={doc}
                docHandle={docHandle}
                identity={identity}
                hiddenUserDids={hiddenUserDids}
              />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ProfileModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        currentUserDid={identity.did}
        doc={doc}
        onUpdateIdentity={handleUpdateIdentity}
        onExportIdentity={() => {}}
        onImportIdentity={() => {}}
        onResetId={handleResetIdentity}
        initialDisplayName={identity.displayName}
      />

      <CollaboratorsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        doc={doc}
        currentUserDid={identity.did}
        hiddenUserDids={hiddenUserDids}
        onToggleUserVisibility={toggleUserVisibility}
        onTrustUser={handleTrustUser}
      />

      <QRScannerModal
        isOpen={showVerifyScanner}
        onClose={() => setShowVerifyScanner(false)}
        currentUserDid={identity.did}
        doc={doc}
        onTrustUser={handleTrustUser}
      />

      <TrustReciprocityModal
        pendingAttestations={pendingAttestations}
        doc={doc}
        currentUserDid={identity.did}
        onTrustBack={handleTrustBack}
        onDecline={handleDeclineTrust}
        onShowToast={setToastMessage}
      />

      <NewWorkspaceModal
        isOpen={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
        onCreate={handleCreateWorkspace}
      />

      {toastMessage && (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
