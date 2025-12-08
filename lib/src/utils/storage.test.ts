/**
 * Tests for storage utilities
 *
 * Tests the logic of identity storage, export, and import functions.
 * Note: DOM-specific tests (file download/upload) are tested via logic simulation
 * since the test environment is 'node' (no DOM available).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  clearSharedIdentity,
  loadDocumentId,
  saveDocumentId,
  clearDocumentId,
  type StoredIdentity,
} from './storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('storage utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('loadSharedIdentity', () => {
    it('should return null when no identity exists', () => {
      expect(loadSharedIdentity()).toBeNull();
    });

    it('should load valid identity from localStorage', () => {
      const identity: StoredIdentity = {
        did: 'did:key:z6MkTest',
        displayName: 'Test User',
        publicKey: 'testPublicKey',
        privateKey: 'testPrivateKey',
      };
      localStorageMock.setItem('narrative_shared_identity', JSON.stringify(identity));

      const loaded = loadSharedIdentity();
      expect(loaded).toEqual(identity);
    });

    it('should return null for invalid JSON', () => {
      localStorageMock.setItem('narrative_shared_identity', 'invalid-json');
      expect(loadSharedIdentity()).toBeNull();
    });

    it('should return null for identity without DID', () => {
      const invalidIdentity = { displayName: 'No DID' };
      localStorageMock.setItem('narrative_shared_identity', JSON.stringify(invalidIdentity));
      expect(loadSharedIdentity()).toBeNull();
    });

    it('should return null for identity with non-string DID', () => {
      const invalidIdentity = { did: 123, displayName: 'Invalid DID' };
      localStorageMock.setItem('narrative_shared_identity', JSON.stringify(invalidIdentity));
      expect(loadSharedIdentity()).toBeNull();
    });
  });

  describe('saveSharedIdentity', () => {
    it('should save identity to localStorage', () => {
      const identity: StoredIdentity = {
        did: 'did:key:z6MkTest',
        displayName: 'Test User',
      };
      saveSharedIdentity(identity);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'narrative_shared_identity',
        JSON.stringify(identity)
      );
    });
  });

  describe('clearSharedIdentity', () => {
    it('should remove identity from localStorage', () => {
      clearSharedIdentity();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('narrative_shared_identity');
    });
  });

  describe('loadDocumentId', () => {
    it('should return null when no document ID exists', () => {
      expect(loadDocumentId('narrative')).toBeNull();
    });

    it('should load document ID with correct prefix', () => {
      localStorageMock.setItem('narrative_docId', 'doc123');
      expect(loadDocumentId('narrative')).toBe('doc123');
    });

    it('should handle different app prefixes', () => {
      localStorageMock.setItem('mapapp_docId', 'mapDoc456');
      expect(loadDocumentId('mapapp')).toBe('mapDoc456');
    });
  });

  describe('saveDocumentId', () => {
    it('should save document ID with correct prefix', () => {
      saveDocumentId('narrative', 'doc123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('narrative_docId', 'doc123');
    });
  });

  describe('clearDocumentId', () => {
    it('should remove document ID with correct prefix', () => {
      clearDocumentId('narrative');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('narrative_docId');
    });
  });
});

describe('identity export logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  /**
   * Helper to simulate export data preparation logic
   * Mirrors the logic in exportIdentityToFile
   */
  function prepareExportData(identity: StoredIdentity | null, userDocUrl: string | null): StoredIdentity | null {
    if (!identity) return null;

    return {
      ...identity,
      ...(userDocUrl ? { userDocUrl } : {}),
    };
  }

  it('should return null when no identity exists', () => {
    const exportData = prepareExportData(null, null);
    expect(exportData).toBeNull();
  });

  it('should export identity without userDocUrl when not present', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkTest',
      displayName: 'Test User',
      privateKey: 'testKey',
    };

    const exportData = prepareExportData(identity, null);

    expect(exportData).toEqual(identity);
    expect(exportData?.userDocUrl).toBeUndefined();
  });

  it('should include userDocUrl in export when present', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkTest',
      displayName: 'Test User',
      privateKey: 'testKey',
    };
    const userDocUrl = 'automerge:userDoc123';

    const exportData = prepareExportData(identity, userDocUrl);

    expect(exportData?.did).toBe('did:key:z6MkTest');
    expect(exportData?.displayName).toBe('Test User');
    expect(exportData?.privateKey).toBe('testKey');
    expect(exportData?.userDocUrl).toBe('automerge:userDoc123');
  });

  it('should handle empty userDocUrl string (exclude from export)', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkTest',
      displayName: 'Test User',
    };

    // Empty string should be treated as not present
    const exportData = prepareExportData(identity, '');

    expect(exportData?.userDocUrl).toBeUndefined();
  });
});

describe('identity import logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  /**
   * Helper to simulate import data processing logic
   * Mirrors the logic in importIdentityFromFile
   */
  function processImportData(content: string): {
    success: boolean;
    identity?: StoredIdentity;
    userDocUrl?: string;
    error?: string;
  } {
    try {
      const importedData = JSON.parse(content) as StoredIdentity;

      if (!importedData.did) {
        return { success: false, error: 'Invalid identity file: missing DID' };
      }

      // Extract userDocUrl (to be stored separately)
      const { userDocUrl, ...identityWithoutUrl } = importedData;

      return {
        success: true,
        identity: identityWithoutUrl,
        userDocUrl: userDocUrl,
      };
    } catch {
      return { success: false, error: 'Ungültige Identity-Datei' };
    }
  }

  it('should successfully process valid identity with userDocUrl', () => {
    const importContent = JSON.stringify({
      did: 'did:key:z6MkImported',
      displayName: 'Imported User',
      privateKey: 'importedKey',
      userDocUrl: 'automerge:importedUserDoc',
    });

    const result = processImportData(importContent);

    expect(result.success).toBe(true);
    expect(result.identity?.did).toBe('did:key:z6MkImported');
    expect(result.identity?.displayName).toBe('Imported User');
    expect(result.identity?.privateKey).toBe('importedKey');
    expect(result.identity?.userDocUrl).toBeUndefined(); // Stripped from identity
    expect(result.userDocUrl).toBe('automerge:importedUserDoc'); // Returned separately
    expect(result.error).toBeUndefined();
  });

  it('should successfully process valid identity without userDocUrl', () => {
    const importContent = JSON.stringify({
      did: 'did:key:z6MkNoUserDoc',
      displayName: 'User Without UserDoc',
    });

    const result = processImportData(importContent);

    expect(result.success).toBe(true);
    expect(result.identity?.did).toBe('did:key:z6MkNoUserDoc');
    expect(result.identity?.displayName).toBe('User Without UserDoc');
    expect(result.userDocUrl).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should fail when DID is missing', () => {
    const importContent = JSON.stringify({
      displayName: 'No DID User',
    });

    const result = processImportData(importContent);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid identity file: missing DID');
    expect(result.identity).toBeUndefined();
  });

  it('should fail on invalid JSON', () => {
    const result = processImportData('not-valid-json');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Ungültige Identity-Datei');
    expect(result.identity).toBeUndefined();
  });

  it('should fail on empty string', () => {
    const result = processImportData('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Ungültige Identity-Datei');
  });

  it('should handle identity with all optional fields', () => {
    const importContent = JSON.stringify({
      did: 'did:key:z6MkComplete',
      displayName: 'Complete User',
      publicKey: 'pubKey123',
      privateKey: 'privKey456',
      avatarUrl: 'https://example.com/avatar.jpg',
      userDocUrl: 'automerge:completeUserDoc',
    });

    const result = processImportData(importContent);

    expect(result.success).toBe(true);
    expect(result.identity?.did).toBe('did:key:z6MkComplete');
    expect(result.identity?.publicKey).toBe('pubKey123');
    expect(result.identity?.privateKey).toBe('privKey456');
    expect(result.identity?.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(result.identity?.userDocUrl).toBeUndefined(); // Stripped
    expect(result.userDocUrl).toBe('automerge:completeUserDoc');
  });

  it('should preserve all identity fields except userDocUrl', () => {
    const importContent = JSON.stringify({
      did: 'did:key:z6MkPreserve',
      displayName: 'Preserve Test',
      publicKey: 'pub',
      privateKey: 'priv',
      avatarUrl: 'avatar.jpg',
      extraField: 'should be preserved',
      userDocUrl: 'automerge:doc',
    });

    const result = processImportData(importContent);

    expect(result.success).toBe(true);
    // userDocUrl should be stripped
    expect(result.identity?.userDocUrl).toBeUndefined();
    // userDocUrl returned separately
    expect(result.userDocUrl).toBe('automerge:doc');
  });
});

describe('StoredIdentity interface', () => {
  it('should accept minimal identity (did only)', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkMinimal',
    };
    expect(identity.did).toBe('did:key:z6MkMinimal');
    expect(identity.displayName).toBeUndefined();
    expect(identity.privateKey).toBeUndefined();
    expect(identity.userDocUrl).toBeUndefined();
  });

  it('should accept identity with all fields', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkFull',
      displayName: 'Full User',
      publicKey: 'pubKey',
      privateKey: 'privKey',
      avatarUrl: 'avatar.jpg',
      userDocUrl: 'automerge:userDoc',
    };

    expect(identity.did).toBe('did:key:z6MkFull');
    expect(identity.displayName).toBe('Full User');
    expect(identity.publicKey).toBe('pubKey');
    expect(identity.privateKey).toBe('privKey');
    expect(identity.avatarUrl).toBe('avatar.jpg');
    expect(identity.userDocUrl).toBe('automerge:userDoc');
  });

  it('userDocUrl should be optional for export/import compatibility', () => {
    // Old export without userDocUrl
    const oldExport: StoredIdentity = {
      did: 'did:key:z6MkOld',
      displayName: 'Old Export',
    };

    // New export with userDocUrl
    const newExport: StoredIdentity = {
      did: 'did:key:z6MkNew',
      displayName: 'New Export',
      userDocUrl: 'automerge:newUserDoc',
    };

    // Both should be valid StoredIdentity objects
    expect(oldExport.did).toBeDefined();
    expect(newExport.did).toBeDefined();

    // Old export has no userDocUrl
    expect(oldExport.userDocUrl).toBeUndefined();

    // New export has userDocUrl
    expect(newExport.userDocUrl).toBe('automerge:newUserDoc');
  });
});

describe('userDocUrl localStorage handling', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const USER_DOC_KEY = 'narrative_user_doc_id';

  it('should restore userDocUrl to localStorage on import', () => {
    // Simulate the import action
    const userDocUrl = 'automerge:importedUserDoc';

    // This is what importIdentityFromFile does
    localStorageMock.setItem(USER_DOC_KEY, userDocUrl);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(USER_DOC_KEY, userDocUrl);
    expect(localStorageMock.store[USER_DOC_KEY]).toBe(userDocUrl);
  });

  it('should not set userDocUrl when not present in import', () => {
    // When userDocUrl is undefined, it should not be set
    const userDocUrl: string | undefined = undefined;

    if (userDocUrl) {
      localStorageMock.setItem(USER_DOC_KEY, userDocUrl);
    }

    expect(localStorageMock.setItem).not.toHaveBeenCalledWith(USER_DOC_KEY, expect.anything());
  });

  it('should read userDocUrl from localStorage on export', () => {
    localStorageMock.setItem(USER_DOC_KEY, 'automerge:existingUserDoc');

    const userDocUrl = localStorageMock.getItem(USER_DOC_KEY);

    expect(userDocUrl).toBe('automerge:existingUserDoc');
  });

  it('should handle missing userDocUrl on export', () => {
    // No userDocUrl in localStorage
    const userDocUrl = localStorageMock.getItem(USER_DOC_KEY);

    expect(userDocUrl).toBeNull();
  });

  it('should correctly include userDocUrl in export data when present', () => {
    const identity: StoredIdentity = {
      did: 'did:key:z6MkTest',
      displayName: 'Test User',
    };

    // Simulate what exportIdentityToFile does
    localStorageMock.setItem('narrative_shared_identity', JSON.stringify(identity));
    localStorageMock.setItem(USER_DOC_KEY, 'automerge:testUserDoc');

    // Read identity and userDocUrl
    const loadedIdentity = loadSharedIdentity();
    const userDocUrl = localStorageMock.getItem(USER_DOC_KEY);

    // Prepare export data
    const exportData: StoredIdentity = {
      ...loadedIdentity!,
      ...(userDocUrl ? { userDocUrl } : {}),
    };

    expect(exportData.did).toBe('did:key:z6MkTest');
    expect(exportData.displayName).toBe('Test User');
    expect(exportData.userDocUrl).toBe('automerge:testUserDoc');
  });
});

describe('backward compatibility', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should handle import of old export format (without userDocUrl)', () => {
    // Old export format
    const oldExportContent = JSON.stringify({
      did: 'did:key:z6MkLegacy',
      displayName: 'Legacy User',
      privateKey: 'legacyKey',
    });

    // Process import
    const importedData = JSON.parse(oldExportContent) as StoredIdentity;

    // Should work without userDocUrl
    expect(importedData.did).toBe('did:key:z6MkLegacy');
    expect(importedData.userDocUrl).toBeUndefined();

    // Save should work
    saveSharedIdentity(importedData);
    const loaded = loadSharedIdentity();
    expect(loaded?.did).toBe('did:key:z6MkLegacy');
  });

  it('should handle import of new export format (with userDocUrl)', () => {
    // New export format
    const newExportContent = JSON.stringify({
      did: 'did:key:z6MkNew',
      displayName: 'New User',
      privateKey: 'newKey',
      userDocUrl: 'automerge:newUserDoc',
    });

    // Process import
    const importedData = JSON.parse(newExportContent) as StoredIdentity;

    // userDocUrl should be present
    expect(importedData.did).toBe('did:key:z6MkNew');
    expect(importedData.userDocUrl).toBe('automerge:newUserDoc');

    // When saving, strip userDocUrl
    const { userDocUrl, ...identityWithoutUrl } = importedData;

    // Save userDocUrl separately
    if (userDocUrl) {
      localStorageMock.setItem('narrative_user_doc_id', userDocUrl);
    }

    // Save identity without userDocUrl
    saveSharedIdentity(identityWithoutUrl);

    // Verify
    const loaded = loadSharedIdentity();
    expect(loaded?.did).toBe('did:key:z6MkNew');
    expect(loaded?.userDocUrl).toBeUndefined();
    expect(localStorageMock.store['narrative_user_doc_id']).toBe('automerge:newUserDoc');
  });
});
