/**
 * Debug Dashboard Component
 *
 * Displays all documents with their objects, history, and changes.
 * Reacts live to document changes via DocHandle subscriptions.
 *
 * Usage:
 * ```tsx
 * import { DebugDashboard } from 'narrative-ui';
 *
 * <DebugDashboard isOpen={showDashboard} onClose={() => setShowDashboard(false)} />
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Repo, AutomergeUrl, DocHandle } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { formatRelativeTime } from '../utils/time';
import { useDocumentChanges, type ChangeEntry } from '../hooks/useDocumentChanges';
import { TrustGraph } from './TrustGraph';

interface DocumentInfo {
  url: string;
  type: 'userDoc' | 'workspaceDoc' | 'externalUserDoc';
  label: string;
  doc: unknown;
  handle?: DocHandle<unknown>;
}

interface DebugDashboardProps {
  /** Custom class name for the container */
  className?: string;
  /** Whether the dashboard is open (controlled mode) */
  isOpen: boolean;
  /** Callback when dashboard should close */
  onClose: () => void;
}


/** Recursive JSON tree component */
function JsonTree({ data, name, defaultExpanded = false }: { data: unknown; name?: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (data === null || data === undefined) {
    return (
      <span className="text-gray-400">
        {name && <span className="text-purple-400">{name}: </span>}
        null
      </span>
    );
  }

  if (typeof data === 'string') {
    const truncated = data.length > 100 ? data.substring(0, 100) + '...' : data;
    return (
      <span>
        {name && <span className="text-purple-400">{name}: </span>}
        <span className="text-green-400">"{truncated}"</span>
      </span>
    );
  }

  if (typeof data === 'number') {
    return (
      <span>
        {name && <span className="text-purple-400">{name}: </span>}
        <span className="text-blue-400">{data}</span>
      </span>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <span>
        {name && <span className="text-purple-400">{name}: </span>}
        <span className="text-yellow-400">{data.toString()}</span>
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <span>
          {name && <span className="text-purple-400">{name}: </span>}
          <span className="text-gray-400">[]</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer hover:bg-base-100 rounded px-1"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-500 mr-1">{expanded ? '▼' : '▶'}</span>
          {name && <span className="text-purple-400">{name}: </span>}
          <span className="text-gray-400">[{data.length}]</span>
        </span>
        {expanded && (
          <div className="ml-4 border-l border-base-300 pl-2">
            {data.map((item, idx) => (
              <div key={idx} className="py-0.5">
                <JsonTree data={item} name={String(idx)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return (
        <span>
          {name && <span className="text-purple-400">{name}: </span>}
          <span className="text-gray-400">{'{}'}</span>
        </span>
      );
    }

    return (
      <div>
        <span
          className="cursor-pointer hover:bg-base-100 rounded px-1"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-500 mr-1">{expanded ? '▼' : '▶'}</span>
          {name && <span className="text-purple-400">{name}: </span>}
          <span className="text-gray-400">{'{' + keys.length + '}'}</span>
        </span>
        {expanded && (
          <div className="ml-4 border-l border-base-300 pl-2">
            {keys.map(key => (
              <div key={key} className="py-0.5">
                <JsonTree data={(data as Record<string, unknown>)[key]} name={key} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <span>
      {name && <span className="text-purple-400">{name}: </span>}
      {String(data)}
    </span>
  );
}

export function DebugDashboard({
  className = '',
  isOpen,
  onClose,
}: DebugDashboardProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Track active subscriptions for cleanup
  const subscriptionsRef = useRef<Array<{ handle: DocHandle<unknown>; cleanup: () => void }>>([]);

  /**
   * Update a single document's info (lightweight - no history reconstruction)
   */
  const updateDocumentInfo = useCallback((url: string, doc: unknown, handle: DocHandle<unknown>) => {
    setDocuments(prev => prev.map(d => {
      if (d.url === url) {
        return { ...d, doc, handle };
      }
      return d;
    }));

    setUpdateCount(c => c + 1);
    setLastUpdate(new Date());
  }, []);

  /**
   * Subscribe to live updates for a document
   */
  const subscribeToDoc = useCallback((handle: DocHandle<unknown>, url: string) => {
    const onChange = () => {
      const doc = handle.doc();
      if (doc) {
        updateDocumentInfo(url, doc, handle);
      }
    };

    handle.on('change', onChange);
    subscriptionsRef.current.push({
      handle,
      cleanup: () => handle.off('change', onChange),
    });
  }, [updateDocumentInfo]);

  /**
   * Load all documents and set up live subscriptions
   * NOTE: No history reconstruction - just loads current doc state
   */
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);

    // Clean up previous subscriptions
    subscriptionsRef.current.forEach(({ cleanup }) => cleanup());
    subscriptionsRef.current = [];

    try {
      const docs: DocumentInfo[] = [];

      // Get repo from window (set by debug tools)
      const repo = (window as unknown as { __narrativeRepo?: Repo }).__narrativeRepo;
      if (!repo) {
        console.warn('DebugDashboard: No repo available');
        setIsLoading(false);
        return;
      }

      // Load user document
      const userDocUrl = window.__userDocUrl;
      if (userDocUrl) {
        try {
          const handle = await repo.find<UserDocument>(userDocUrl as AutomergeUrl);
          const doc = handle.doc();
          if (doc) {
            docs.push({
              url: userDocUrl,
              type: 'userDoc',
              label: `User: ${doc.profile?.displayName || doc.did?.substring(0, 20) + '...'}`,
              doc,
              handle: handle as DocHandle<unknown>,
            });
            subscribeToDoc(handle as DocHandle<unknown>, userDocUrl);
          }
        } catch (err) {
          console.warn('Failed to load user doc:', err);
        }
      }

      // Load workspace document
      const workspaceDocUrl = window.__docUrl;
      if (workspaceDocUrl) {
        try {
          const handle = await repo.find<BaseDocument<unknown>>(workspaceDocUrl as AutomergeUrl);
          const doc = handle.doc();
          if (doc) {
            docs.push({
              url: workspaceDocUrl,
              type: 'workspaceDoc',
              label: `Workspace: ${doc.context?.name || 'Unnamed'}`,
              doc,
              handle: handle as DocHandle<unknown>,
            });
            subscribeToDoc(handle as DocHandle<unknown>, workspaceDocUrl);
          }
        } catch (err) {
          console.warn('Failed to load workspace doc:', err);
        }
      }

      // Load external user documents (from trust relationships)
      const userDoc = window.__userDoc;
      const loadedExternalUrls = new Set<string>(); // Avoid duplicates

      // From trustReceived: people who trust us (have their trusterUserDocUrl)
      if (userDoc?.trustReceived) {
        for (const [trusterDid, attestation] of Object.entries(userDoc.trustReceived)) {
          if (attestation.trusterUserDocUrl && !loadedExternalUrls.has(attestation.trusterUserDocUrl)) {
            loadedExternalUrls.add(attestation.trusterUserDocUrl);
            try {
              const handle = await repo.find<UserDocument>(attestation.trusterUserDocUrl as AutomergeUrl);
              const doc = handle.doc();
              if (doc) {
                docs.push({
                  url: attestation.trusterUserDocUrl,
                  type: 'externalUserDoc',
                  label: `Received: ${doc.profile?.displayName || trusterDid.substring(0, 20) + '...'}`,
                  doc,
                  handle: handle as DocHandle<unknown>,
                });
                subscribeToDoc(handle as DocHandle<unknown>, attestation.trusterUserDocUrl);
              }
            } catch (err) {
              console.warn('Failed to load external doc from trustReceived:', err);
            }
          }
        }
      }

      // From trustGiven: people we trust (have their trusteeUserDocUrl from QR scan)
      if (userDoc?.trustGiven) {
        for (const [trusteeDid, attestation] of Object.entries(userDoc.trustGiven)) {
          if (attestation.trusteeUserDocUrl && !loadedExternalUrls.has(attestation.trusteeUserDocUrl)) {
            loadedExternalUrls.add(attestation.trusteeUserDocUrl);
            try {
              const handle = await repo.find<UserDocument>(attestation.trusteeUserDocUrl as AutomergeUrl);
              const doc = handle.doc();
              if (doc) {
                docs.push({
                  url: attestation.trusteeUserDocUrl,
                  type: 'externalUserDoc',
                  label: `Scanned: ${doc.profile?.displayName || trusteeDid.substring(0, 20) + '...'}`,
                  doc,
                  handle: handle as DocHandle<unknown>,
                });
                subscribeToDoc(handle as DocHandle<unknown>, attestation.trusteeUserDocUrl);
              }
            } catch (err) {
              console.warn('Failed to load external doc from trustGiven:', err);
            }
          }
        }
      }

      setDocuments(docs);
      if (docs.length > 0 && !selectedDoc) {
        setSelectedDoc(docs[0].url);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load documents:', err);
    }

    setIsLoading(false);
  }, [selectedDoc, subscribeToDoc]);

  // Initial load and cleanup
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }

    return () => {
      // Clean up subscriptions when closing or unmounting
      subscriptionsRef.current.forEach(({ cleanup }) => cleanup());
      subscriptionsRef.current = [];
    };
  }, [isOpen, loadDocuments]);

  const selectedDocument = documents.find(d => d.url === selectedDoc);

  // Tab state for data view
  const [dataViewTab, setDataViewTab] = useState<'tree' | 'raw'>('tree');

  // Dashboard main view tabs
  const [mainViewTab, setMainViewTab] = useState<'documents' | 'trustGraph'>('documents');

  // Extract user document and external documents for trust graph
  const { userDoc, externalDocs } = useMemo(() => {
    const userDocInfo = documents.find(d => d.type === 'userDoc');
    const userDoc = userDocInfo?.doc as UserDocument | undefined;

    const externalDocs = new Map<string, UserDocument>();
    for (const docInfo of documents) {
      if (docInfo.type === 'externalUserDoc') {
        const extDoc = docInfo.doc as UserDocument;
        if (extDoc?.did) {
          externalDocs.set(extDoc.did, extDoc);
        }
      }
    }

    return { userDoc, externalDocs };
  }, [documents]);

  // Use the hook for LIVE change tracking (session only, no history reconstruction)
  const { changes: changeEntries, clearAll: clearChangeEntries } = useDocumentChanges(
    selectedDocument?.handle,
    { limit: 50 }
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black/80 z-[1200] overflow-auto ${className}`}>
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-base-200 p-4 rounded-lg sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Debug Dashboard
            </h1>
            {/* Live Update Indicator */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>Live</span>
                <span className="text-xs">
                  ({updateCount} updates • last: {formatRelativeTime(lastUpdate.getTime())})
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadDocuments}
              disabled={isLoading}
              className="btn btn-sm btn-outline"
            >
              {isLoading ? 'Loading...' : 'Reload'}
            </button>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main View Tabs */}
        <div className="tabs tabs-boxed mb-4 bg-base-200 p-2 rounded-lg">
          <button
            className={`tab tab-lg ${mainViewTab === 'documents' ? 'tab-active' : ''}`}
            onClick={() => setMainViewTab('documents')}
          >
            Dokumente
          </button>
          <button
            className={`tab tab-lg ${mainViewTab === 'trustGraph' ? 'tab-active' : ''}`}
            onClick={() => setMainViewTab('trustGraph')}
          >
            Trust-Graph
          </button>
        </div>

        {/* Trust Graph View */}
        {mainViewTab === 'trustGraph' && (
          <div className="bg-base-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Web of Trust Netzwerk</h2>
            <TrustGraph
              userDoc={userDoc}
              externalDocs={externalDocs}
              height={500}
              onNodeClick={(did) => {
                // Find and select the document for this DID
                const doc = documents.find(d => {
                  const docData = d.doc as UserDocument;
                  return docData?.did === did;
                });
                if (doc) {
                  setSelectedDoc(doc.url);
                  setMainViewTab('documents');
                }
              }}
            />
          </div>
        )}

        {/* Documents View */}
        {mainViewTab === 'documents' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Document List */}
          <div className="col-span-3 bg-base-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Documents ({documents.length})</h2>
            <div className="space-y-2">
              {documents.map(doc => (
                <button
                  key={doc.url}
                  onClick={() => setSelectedDoc(doc.url)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDoc === doc.url
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-300 hover:bg-base-100'
                  }`}
                >
                  <div className="font-medium truncate">{doc.label}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {doc.type}
                  </div>
                </button>
              ))}
              {documents.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 py-8">
                  No documents loaded
                </div>
              )}
            </div>
          </div>

          {/* Document Details */}
          <div className="col-span-9 space-y-4">
            {selectedDocument ? (
              <>
                {/* Document Info */}
                <div className="bg-base-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold mb-2">{selectedDocument.label}</h2>
                  <div className="text-sm">
                    <div className="text-gray-500">URL</div>
                    <div className="font-mono text-xs truncate" title={selectedDocument.url}>
                      {selectedDocument.url}
                    </div>
                  </div>
                </div>

                {/* Document Data - Tabbed View */}
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Document Data</h3>
                    <div className="tabs tabs-boxed">
                      <button
                        className={`tab ${dataViewTab === 'tree' ? 'tab-active' : ''}`}
                        onClick={() => setDataViewTab('tree')}
                      >
                        Tree View
                      </button>
                      <button
                        className={`tab ${dataViewTab === 'raw' ? 'tab-active' : ''}`}
                        onClick={() => setDataViewTab('raw')}
                      >
                        Raw JSON
                      </button>
                    </div>
                  </div>
                  {dataViewTab === 'tree' ? (
                    <div className="bg-base-300 rounded-lg p-4 font-mono text-sm overflow-auto max-h-[500px]">
                      <JsonTree data={selectedDocument.doc} defaultExpanded={true} />
                    </div>
                  ) : (
                    <pre className="bg-base-300 p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono">
                      {JSON.stringify(selectedDocument.doc, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Live Change Log (Session only) */}
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Live-Änderungen ({changeEntries.length})
                    </h3>
                    {changeEntries.length > 0 && (
                      <button
                        onClick={clearChangeEntries}
                        className="btn btn-xs btn-ghost"
                      >
                        Leeren
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Zeigt nur Änderungen seit Öffnen des Dashboards
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {changeEntries.length > 0 ? (
                      changeEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-base-300 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {/* Priority indicator */}
                              {entry.priority === 'high' && (
                                <span className="badge badge-error badge-xs">!</span>
                              )}
                              {entry.priority === 'medium' && (
                                <span className="badge badge-warning badge-xs">•</span>
                              )}
                              <span className="font-medium">{entry.summary}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(entry.timestamp)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1 font-mono">
                            {entry.path}
                          </div>
                          {/* Affected Object - collapsible JSON */}
                          {entry.affectedObject && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                                JSON anzeigen
                              </summary>
                              <pre className="mt-1 p-2 bg-base-200 rounded text-xs overflow-auto max-h-40 font-mono">
                                {JSON.stringify(entry.affectedObject, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4">
                        Noch keine Änderungen in dieser Session
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-base-200 rounded-lg p-8 text-center text-gray-500">
                Select a document to view details
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default DebugDashboard;
