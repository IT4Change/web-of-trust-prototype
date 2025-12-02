import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { useEffect, useState } from 'react';
import { createEmptyDoc, generateId, type UserIdentity } from 'narrative-ui';
import { MainView } from './components/MainView';
import { LoadingScreen } from './components/LoadingScreen';
import { DocumentId } from '@automerge/automerge-repo';

/**
 * Main Narrative application
 * Handles Automerge document initialization and identity
 */
export function NarrativeApp() {
  const repo = useRepo();
  const [documentId, setDocumentId] = useState<DocumentId | null>(null);
  const [currentUserDid, setCurrentUserDid] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeDocument();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const newDocId = params.get('doc');
      if (newDocId && newDocId !== documentId) {
        setDocumentId(newDocId as DocumentId);
        localStorage.setItem('narrativeDocId', newDocId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentId]);

  const initializeDocument = async () => {
    // Check URL for shared document ID (e.g., #doc=automerge:...)
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const urlDocId = urlParams.get('doc');

    // Try to load existing document from URL, then localStorage
    const savedDocId = localStorage.getItem('narrativeDocId');
    const savedIdentity = localStorage.getItem('narrativeIdentity');

    // Each browser needs its own identity
    let identity: UserIdentity;
    if (savedIdentity) {
      identity = JSON.parse(savedIdentity);
    } else {
      identity = {
        did: `did:key:${generateId()}`,
        displayName: `User-${Math.random().toString(36).substring(7)}`,
      };
      localStorage.setItem('narrativeIdentity', JSON.stringify(identity));
    }
    setCurrentUserDid(identity.did);

    const docIdToUse = urlDocId || savedDocId;

    if (docIdToUse) {
      // Load existing document (from URL or localStorage)
      setDocumentId(docIdToUse as DocumentId);
      localStorage.setItem('narrativeDocId', docIdToUse);

      // Update URL if not already there
      if (!urlDocId) {
        window.location.hash = `doc=${docIdToUse}`;
      }

      setIsInitializing(false);
    } else {
      // Create new document with current user's identity
      const handle = repo.create(createEmptyDoc(identity));
      const docId = handle.documentId;

      // Save document ID and add to URL
      localStorage.setItem('narrativeDocId', docId);
      window.location.hash = `doc=${docId}`;

      setDocumentId(docId);
      setIsInitializing(false);
    }
  };

  const handleResetId = () => {
    localStorage.removeItem('narrativeIdentity');
    window.location.reload();
  };

  const handleNewBoard = () => {
    const storedIdentity = localStorage.getItem('narrativeIdentity');
    const identity: UserIdentity = storedIdentity
      ? JSON.parse(storedIdentity)
      : {
          did: currentUserDid || `did:key:${generateId()}`,
          displayName: `User-${Math.random().toString(36).substring(7)}`,
        };

    const handle = repo.create(createEmptyDoc(identity));
    const docId = handle.documentId;
    localStorage.setItem('narrativeDocId', docId);

    // Push new hash so back button returns to previous board
    const url = new URL(window.location.href);
    url.hash = `doc=${docId}`;
    window.history.pushState(null, '', url.toString());
    setDocumentId(docId);
  };

  // Show loading while initializing
  if (isInitializing || !documentId || !currentUserDid) {
    return <LoadingScreen />;
  }

  return (
    <MainView
      documentId={documentId}
      currentUserDid={currentUserDid}
      onResetId={handleResetId}
      onNewBoard={handleNewBoard}
    />
  );
}
