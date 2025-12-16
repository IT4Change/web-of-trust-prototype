/**
 * Automerge User Document Service
 *
 * UserDocumentService-Implementierung für Automerge.
 * Verwaltet das persönliche, Cross-Workspace UserDocument.
 */

import type { DocHandle, Repo, AutomergeUrl } from '@automerge/automerge-repo';
import {
  createUserDocument as createUserDocumentSchema,
  addWorkspace as addWorkspaceSchema,
  removeWorkspace as removeWorkspaceSchema,
  touchWorkspace as touchWorkspaceSchema,
  updateUserProfile as updateUserProfileSchema,
  type UserDocument as LegacyUserDocument,
} from '../../../schema';
import {
  loadUserDocId,
  saveUserDocId,
  clearUserDocId,
} from '../../../hooks/useUserDocument';
import type {
  UserDocument,
  UserDocumentProfile,
  WorkspaceRef,
  UserDocumentService,
} from '../../types';

/**
 * UserDocumentService für Automerge
 */
export class AutomergeUserDocService implements UserDocumentService {
  private docHandle: DocHandle<LegacyUserDocument> | null = null;
  private repo: Repo;
  private ownerId: string;
  private displayName: string;
  private listeners: Set<(doc: UserDocument | null) => void> = new Set();
  private changeHandler: (() => void) | null = null;
  private initialized = false;

  constructor(
    repo: Repo,
    ownerId: string,
    displayName: string
  ) {
    this.repo = repo;
    this.ownerId = ownerId;
    this.displayName = displayName;
  }

  /**
   * Initialize the UserDocument (load or create)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const savedDocId = loadUserDocId();

    if (savedDocId) {
      try {
        this.docHandle = await this.repo.find<LegacyUserDocument>(savedDocId as AutomergeUrl);
        const doc = this.docHandle.docSync();

        // Verify DID matches
        if (doc?.did !== this.ownerId) {
          console.warn('UserDocument DID mismatch, creating new document');
          await this.createNewDocument();
        }
      } catch (e) {
        console.warn('Failed to load UserDocument, creating new:', e);
        await this.createNewDocument();
      }
    } else {
      await this.createNewDocument();
    }

    this.setupSubscription();
    this.initialized = true;
  }

  private async createNewDocument(): Promise<void> {
    this.docHandle = this.repo.create<LegacyUserDocument>();

    this.docHandle.change((d) => {
      const newDoc = createUserDocumentSchema(this.ownerId, this.displayName);
      Object.assign(d, newDoc);
    });

    saveUserDocId(this.docHandle.url);
  }

  private setupSubscription(): void {
    if (!this.docHandle) return;

    this.changeHandler = () => this.notifyListeners();
    this.docHandle.on('change', this.changeHandler);
  }

  destroy(): void {
    if (this.changeHandler && this.docHandle) {
      this.docHandle.off('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.listeners.clear();
  }

  get(): UserDocument | null {
    const doc = this.docHandle?.docSync();
    if (!doc) return null;

    return this.mapToUserDocument(doc);
  }

  isLoaded(): boolean {
    return this.initialized && this.docHandle !== null;
  }

  async updateProfile(changes: Partial<UserDocumentProfile>): Promise<void> {
    if (!this.docHandle) {
      throw new Error('UserDocument not initialized');
    }

    this.docHandle.change((d) => {
      updateUserProfileSchema(d, changes);
    });
  }

  async addWorkspace(ref: WorkspaceRef): Promise<void> {
    if (!this.docHandle) {
      throw new Error('UserDocument not initialized');
    }

    this.docHandle.change((d) => {
      addWorkspaceSchema(d, ref.id, ref.name, ref.avatarUrl);
    });
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    if (!this.docHandle) {
      throw new Error('UserDocument not initialized');
    }

    this.docHandle.change((d) => {
      removeWorkspaceSchema(d, workspaceId);
    });
  }

  /**
   * Touch workspace to update lastAccessedAt
   */
  async touchWorkspace(workspaceId: string): Promise<void> {
    if (!this.docHandle) {
      throw new Error('UserDocument not initialized');
    }

    this.docHandle.change((d) => {
      touchWorkspaceSchema(d, workspaceId);
    });
  }

  subscribe(callback: (doc: UserDocument | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const doc = this.get();
    this.listeners.forEach((cb) => cb(doc));
  }

  /**
   * Map legacy UserDocument to new format
   */
  private mapToUserDocument(legacy: LegacyUserDocument): UserDocument {
    return {
      id: legacy.did || this.ownerId,
      ownerId: legacy.did || this.ownerId,
      profile: {
        displayName: legacy.profile?.displayName || this.displayName,
        avatarUrl: legacy.profile?.avatarUrl,
      },
      workspaces: Object.entries(legacy.workspaces || {}).map(([id, ws]) => {
        const wsData = ws as unknown as Record<string, unknown>;
        return {
          id,
          name: (wsData.name as string) || 'Unknown',
          avatarUrl: wsData.avatar as string | undefined,
          addedAt: (wsData.addedAt as number) || Date.now(),
        };
      }),
    };
  }

  // === Additional methods for Automerge-specific functionality ===

  /**
   * Get the raw DocHandle for advanced operations
   */
  getDocHandle(): DocHandle<LegacyUserDocument> | null {
    return this.docHandle;
  }

  /**
   * Get the document URL for sharing
   */
  getDocUrl(): string | undefined {
    return this.docHandle?.url;
  }

  /**
   * Clear stored document ID (for reset)
   */
  clearStoredDocId(): void {
    clearUserDocId();
  }
}
