/**
 * Debug utilities for Narrative apps
 *
 * These tools are available in all environments (dev and production)
 * to help with testing and debugging.
 *
 * Access via browser console:
 * - window.__narrative - Debug namespace with all commands
 * - window.__userDoc - Current user document (auto-updated)
 * - window.__doc - Current workspace document (auto-updated)
 *
 * Load any document by ID:
 * - __narrative.loadDoc('automerge:xyz...')
 * - __narrative.loadUserDoc('did:key:z6Mk...')
 */

import type { UserDocument } from '../schema/userDocument';
import type { BaseDocument } from '../schema/document';
import { loadSharedIdentity, type StoredIdentity } from './storage';
import type { Repo, AutomergeUrl } from '@automerge/automerge-repo';

// Internal repo reference for loading arbitrary documents
let _repo: Repo | null = null;

// Type declarations for window object
declare global {
  interface Window {
    __narrative: NarrativeDebug;
    __userDoc: UserDocument | null;
    __doc: BaseDocument<unknown> | null;
    __identity: StoredIdentity | null;
  }
}

export interface NarrativeDebug {
  // Identity
  identity: () => StoredIdentity | null;
  exportIdentity: () => void;

  // User Document
  userDoc: () => UserDocument | null;
  printUserDoc: () => void;
  trustGiven: () => void;
  trustReceived: () => void;
  workspaces: () => void;

  // Workspace Document
  doc: () => BaseDocument<unknown> | null;
  printDoc: () => void;

  // Load arbitrary documents
  loadDoc: (docId: string) => Promise<unknown>;
  loadUserDoc: (did: string) => Promise<UserDocument | null>;

  // Export
  exportUserDoc: () => void;
  exportDoc: () => void;

  // Info
  help: () => void;
  version: string;
}

/**
 * Pretty print user document to console
 */
function printUserDocStructure(userDoc: UserDocument | null): void {
  if (!userDoc) {
    console.log('❌ No user document loaded. Set window.__userDoc first.');
    return;
  }

  console.group('👤 User Document');

  console.group('📋 Profile');
  console.log('DID:', userDoc.did);
  console.log('Display Name:', userDoc.profile.displayName);
  if (userDoc.profile.avatarUrl) {
    console.log('Avatar:', userDoc.profile.avatarUrl.substring(0, 50) + '...');
  }
  console.groupEnd();

  console.group(`🤝 Trust Given (${Object.keys(userDoc.trustGiven || {}).length})`);
  if (Object.keys(userDoc.trustGiven || {}).length > 0) {
    console.table(
      Object.values(userDoc.trustGiven).map((t) => ({
        trusteeDid: t.trusteeDid.substring(0, 30) + '...',
        level: t.level,
        method: t.verificationMethod,
        createdAt: new Date(t.createdAt).toLocaleString(),
      }))
    );
  } else {
    console.log('No outgoing trust attestations');
  }
  console.groupEnd();

  console.group(`📥 Trust Received (${Object.keys(userDoc.trustReceived || {}).length})`);
  if (Object.keys(userDoc.trustReceived || {}).length > 0) {
    console.table(
      Object.values(userDoc.trustReceived).map((t) => ({
        trusterDid: t.trusterDid.substring(0, 30) + '...',
        level: t.level,
        method: t.verificationMethod,
        createdAt: new Date(t.createdAt).toLocaleString(),
      }))
    );
  } else {
    console.log('No incoming trust attestations');
  }
  console.groupEnd();

  console.group(`🏢 Workspaces (${Object.keys(userDoc.workspaces || {}).length})`);
  if (Object.keys(userDoc.workspaces || {}).length > 0) {
    console.table(
      Object.values(userDoc.workspaces).map((w) => ({
        name: w.name,
        docId: w.docId.substring(0, 40) + '...',
        lastAccessed: w.lastAccessedAt
          ? new Date(w.lastAccessedAt).toLocaleString()
          : 'N/A',
      }))
    );
  } else {
    console.log('No workspaces');
  }
  console.groupEnd();

  console.group('📊 Stats');
  console.log('Version:', userDoc.version);
  console.log('Last Modified:', new Date(userDoc.lastModified).toLocaleString());
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
function exportToJson(data: unknown, filename: string): void {
  if (!data) {
    console.error('❌ No data to export');
    return;
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`✅ Exported to ${filename}`);
}

/**
 * Load any document by ID
 */
async function loadDocById(docId: string): Promise<unknown> {
  if (!_repo) {
    console.error('❌ Repo not initialized. Debug tools need to be initialized with a repo.');
    return null;
  }

  // Normalize document ID
  const normalizedId = docId.startsWith('automerge:') ? docId : `automerge:${docId}`;

  console.log(`🔄 Loading document: ${normalizedId.substring(0, 50)}...`);

  try {
    const handle = _repo.find(normalizedId as AutomergeUrl);
    await handle.whenReady();
    const doc = handle.docSync();

    if (doc) {
      console.log('✅ Document loaded:', doc);
      return doc;
    } else {
      console.error('❌ Document not found or empty');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to load document:', error);
    return null;
  }
}

/**
 * Load a user's UserDocument by their DID
 * Looks up the userDocUrl in trust attestations (trustReceived contains trusterUserDocUrl)
 */
async function loadUserDocByDid(did: string): Promise<UserDocument | null> {
  if (!_repo) {
    console.error('❌ Repo not initialized.');
    return null;
  }

  // Check if we have a userDocUrl for this DID in our trust relationships
  const currentUserDoc = window.__userDoc;
  if (currentUserDoc) {
    // Check trustReceived - attestations have trusterUserDocUrl pointing to the person who trusted us
    const trustReceived = Object.values(currentUserDoc.trustReceived || {});
    for (const attestation of trustReceived) {
      if (attestation.trusterDid === did && attestation.trusterUserDocUrl) {
        console.log(`📍 Found userDocUrl in trustReceived for ${did.substring(0, 30)}...`);
        return (await loadDocById(attestation.trusterUserDocUrl)) as UserDocument | null;
      }
    }

    // Check trustGiven - the attestations we wrote also have trusterUserDocUrl (our own URL)
    // But we need the trustee's URL, which we may have stored when they trusted us back
    // For now, we can only resolve users who have trusted us (their URL is in trustReceived)
  }

  console.error(`❌ No userDocUrl found for DID: ${did.substring(0, 40)}...`);
  console.log('💡 Tip: You can only load UserDocs of users who have trusted you (their URL is in trustReceived).');
  return null;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
🛠️  Narrative Debug Tools v2.0
===============================

📌 Quick Access:
  __userDoc              - Current user document (auto-updated)
  __doc                  - Current workspace document (auto-updated)
  __identity             - Current identity

📌 Identity:
  __narrative.identity()       - Get current identity
  __narrative.exportIdentity() - Export identity to file

📌 User Document:
  __narrative.userDoc()        - Get user document
  __narrative.printUserDoc()   - Pretty print user document
  __narrative.trustGiven()     - Show outgoing trust
  __narrative.trustReceived()  - Show incoming trust
  __narrative.workspaces()     - Show workspaces
  __narrative.exportUserDoc()  - Export user doc to JSON

📌 Workspace Document:
  __narrative.doc()            - Get workspace document
  __narrative.printDoc()       - Pretty print workspace doc
  __narrative.exportDoc()      - Export workspace doc to JSON

📌 Load Any Document:
  __narrative.loadDoc('automerge:xyz...')     - Load any document by ID
  __narrative.loadUserDoc('did:key:z6Mk...')  - Load a user's UserDocument

📌 Tips:
  - Documents are reactive - __userDoc and __doc update automatically
  - Use JSON.stringify(__userDoc, null, 2) for raw JSON
  - loadUserDoc() only works for users you have trust relationships with
  - All commands work in production builds
  `);
}

/**
 * Initialize debug tools
 * Call this once when the app loads
 */
export function initDebugTools(): void {
  if (typeof window === 'undefined') return;

  // Initialize debug namespace
  window.__narrative = {
    version: '1.0.0',

    // Identity
    identity: () => {
      const id = loadSharedIdentity();
      console.log('🪪 Identity:', id);
      return id;
    },
    exportIdentity: () => {
      const identity = loadSharedIdentity();
      if (identity) {
        exportToJson(identity, `narrative-identity-${Date.now()}.json`);
      } else {
        console.error('❌ No identity to export');
      }
    },

    // User Document
    userDoc: () => {
      console.log('👤 User Document:', window.__userDoc);
      return window.__userDoc;
    },
    printUserDoc: () => printUserDocStructure(window.__userDoc),
    trustGiven: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.trustGiven || {}));
      } else {
        console.log('❌ No user document');
      }
    },
    trustReceived: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.trustReceived || {}));
      } else {
        console.log('❌ No user document');
      }
    },
    workspaces: () => {
      const doc = window.__userDoc;
      if (doc) {
        console.table(Object.values(doc.workspaces || {}));
      } else {
        console.log('❌ No user document');
      }
    },
    exportUserDoc: () => {
      if (window.__userDoc) {
        exportToJson(window.__userDoc, `narrative-userdoc-${Date.now()}.json`);
      } else {
        console.error('❌ No user document to export');
      }
    },

    // Workspace Document
    doc: () => {
      console.log('📄 Workspace Document:', window.__doc);
      return window.__doc;
    },
    printDoc: () => {
      const doc = window.__doc;
      if (doc) {
        console.group('📄 Workspace Document');
        console.log('Version:', doc.version);
        console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
        console.log('Identities:', Object.keys(doc.identities || {}).length);
        console.log('Data:', doc.data);
        console.groupEnd();
      } else {
        console.log('❌ No workspace document');
      }
    },
    exportDoc: () => {
      if (window.__doc) {
        exportToJson(window.__doc, `narrative-doc-${Date.now()}.json`);
      } else {
        console.error('❌ No workspace document to export');
      }
    },

    // Load arbitrary documents
    loadDoc: loadDocById,
    loadUserDoc: loadUserDocByDid,

    // Help
    help: printHelp,
  };

  // Initialize document holders
  window.__userDoc = null;
  window.__doc = null;
  window.__identity = loadSharedIdentity();

  // Log welcome message
  console.log('🛠️  Narrative Debug Tools loaded! Type __narrative.help() for commands.');
}

/**
 * Update debug state with current documents and repo
 * Call this when documents change or on app initialization
 */
export function updateDebugState(options: {
  userDoc?: UserDocument | null;
  doc?: BaseDocument<unknown> | null;
  repo?: Repo;
}): void {
  if (typeof window === 'undefined') return;

  if (options.userDoc !== undefined) {
    window.__userDoc = options.userDoc;
  }
  if (options.doc !== undefined) {
    window.__doc = options.doc;
  }
  if (options.repo !== undefined) {
    _repo = options.repo;
  }
  window.__identity = loadSharedIdentity();
}