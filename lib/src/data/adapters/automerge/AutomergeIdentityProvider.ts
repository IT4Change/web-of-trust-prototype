/**
 * Automerge Identity Provider
 *
 * IdentityProvider-Implementierung mit DID:key (Ed25519).
 * Nutzt localStorage für Persistenz.
 */

import {
  generateDidIdentity,
  extractPublicKeyFromDid,
  isFakeDid,
  base64Encode,
} from '../../../utils/did';
import {
  loadSharedIdentity,
  saveSharedIdentity,
  clearSharedIdentity,
  exportIdentityToFile,
  importIdentityFromFile,
  type StoredIdentity,
} from '../../../utils/storage';
import type {
  Identity,
  SignInMethod,
  IdentityProvider,
  IdentityProviderCapabilities,
} from '../../types';

/**
 * IdentityProvider für DID:key mit Ed25519
 */
export class AutomergeIdentityProvider implements IdentityProvider {
  private identity: Identity | null = null;
  private storedIdentity: StoredIdentity | null = null;
  private listeners: Set<(identity: Identity | null) => void> = new Set();

  readonly capabilities: IdentityProviderCapabilities = {
    canExportMnemonic: false,
    canExportKeyFile: true,
    signInMethods: ['keyFile', 'privateKey'],
  };

  constructor() {
    // Try to load existing identity from localStorage
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const stored = loadSharedIdentity();
    if (stored && !isFakeDid(stored.did)) {
      this.storedIdentity = stored;
      this.identity = this.toIdentity(stored);
    }
  }

  private toIdentity(stored: StoredIdentity): Identity {
    return {
      id: stored.did,
      displayName: stored.displayName || `User-${stored.did.slice(-6)}`,
      avatarUrl: stored.avatarUrl,
      canSign: !!stored.privateKey,
      publicKey: stored.publicKey,
    };
  }

  getCurrentIdentity(): Identity | null {
    return this.identity;
  }

  isAuthenticated(): boolean {
    return this.identity !== null;
  }

  async signUp(params?: { displayName?: string }): Promise<Identity> {
    const displayName = params?.displayName || `User-${Math.random().toString(36).slice(2, 8)}`;

    const didIdentity = await generateDidIdentity(displayName);

    const stored: StoredIdentity = {
      did: didIdentity.did,
      displayName,
      publicKey: didIdentity.publicKey,
      privateKey: didIdentity.privateKey,
    };

    saveSharedIdentity(stored);
    this.storedIdentity = stored;
    this.identity = this.toIdentity(stored);

    this.notifyListeners();
    return this.identity;
  }

  async signIn(method: SignInMethod): Promise<Identity> {
    switch (method.type) {
      case 'keyFile':
        return this.signInWithKeyFile(method.file);
      case 'privateKey':
        return this.signInWithPrivateKey(method.privateKey);
      default:
        throw new Error(`Unsupported sign-in method: ${(method as SignInMethod).type}`);
    }
  }

  private async signInWithKeyFile(file: File): Promise<Identity> {
    return new Promise((resolve, reject) => {
      importIdentityFromFile(
        (imported) => {
          this.storedIdentity = imported;
          this.identity = this.toIdentity(imported);
          this.notifyListeners();
          resolve(this.identity);
        },
        (error) => {
          reject(new Error(error));
        }
      );

      // Trigger file input - this needs to be handled by the caller
      // who should provide the file through importIdentityFromFile
    });
  }

  private async signInWithPrivateKey(privateKeyBase64: string): Promise<Identity> {
    // Import Ed25519 private key and derive DID
    const privateKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

    // For Ed25519, we need to derive the public key from the private key
    // This requires importing the key first
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      { name: 'Ed25519' },
      true,
      ['sign']
    );

    // Export to get the public key
    const exported = await crypto.subtle.exportKey('spki', cryptoKey);
    const publicKeyBytes = new Uint8Array(exported).slice(-32); // Last 32 bytes are the public key

    const publicKeyBase64 = base64Encode(publicKeyBytes);

    // Derive DID from public key
    const { deriveDidFromPublicKey } = await import('../../../utils/did');
    const did = deriveDidFromPublicKey(publicKeyBytes);

    const stored: StoredIdentity = {
      did,
      displayName: `User-${did.slice(-6)}`,
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };

    saveSharedIdentity(stored);
    this.storedIdentity = stored;
    this.identity = this.toIdentity(stored);

    this.notifyListeners();
    return this.identity;
  }

  async signOut(): Promise<void> {
    clearSharedIdentity();
    this.identity = null;
    this.storedIdentity = null;
    this.notifyListeners();
  }

  async updateProfile(changes: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    if (!this.identity || !this.storedIdentity) {
      throw new Error('Not authenticated');
    }

    if (changes.displayName !== undefined) {
      this.storedIdentity.displayName = changes.displayName;
      this.identity.displayName = changes.displayName;
    }
    if (changes.avatarUrl !== undefined) {
      this.storedIdentity.avatarUrl = changes.avatarUrl;
      this.identity.avatarUrl = changes.avatarUrl;
    }

    saveSharedIdentity(this.storedIdentity);
    this.notifyListeners();
  }

  async exportKeyFile(): Promise<Blob> {
    if (!this.storedIdentity) {
      throw new Error('Not authenticated');
    }

    const exportData = {
      did: this.storedIdentity.did,
      displayName: this.storedIdentity.displayName,
      publicKey: this.storedIdentity.publicKey,
      privateKey: this.storedIdentity.privateKey,
      userDocUrl: this.storedIdentity.userDocUrl,
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
  }

  subscribe(callback: (identity: Identity | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.identity));
  }

  // === Additional methods for Automerge-specific functionality ===

  /**
   * Get the private key for signing (if available)
   */
  getPrivateKey(): string | undefined {
    return this.storedIdentity?.privateKey;
  }

  /**
   * Get the public key for verification
   */
  getPublicKey(): string | undefined {
    return this.storedIdentity?.publicKey;
  }

  /**
   * Get the UserDocument URL (if set)
   */
  getUserDocUrl(): string | undefined {
    return this.storedIdentity?.userDocUrl;
  }

  /**
   * Set the UserDocument URL
   */
  setUserDocUrl(url: string): void {
    if (this.storedIdentity) {
      this.storedIdentity.userDocUrl = url;
      saveSharedIdentity(this.storedIdentity);
    }
  }

  /**
   * Trigger file import dialog
   */
  importFromFile(): Promise<Identity> {
    return new Promise((resolve, reject) => {
      importIdentityFromFile(
        (imported) => {
          this.storedIdentity = imported;
          this.identity = this.toIdentity(imported);
          this.notifyListeners();
          resolve(this.identity);
        },
        (error) => {
          reject(new Error(error));
        }
      );
    });
  }

  /**
   * Export identity to file download
   */
  exportToFile(filename?: string): void {
    exportIdentityToFile(filename);
  }
}
