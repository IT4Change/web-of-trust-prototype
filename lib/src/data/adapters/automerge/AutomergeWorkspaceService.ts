/**
 * Automerge Workspace Service
 *
 * WorkspaceService-Implementierung für Automerge BaseDocuments.
 */

import type { DocHandle, Repo, AutomergeUrl } from '@automerge/automerge-repo';
import type { IdentityProfile } from '../../../schema';
import {
  loadDocumentId,
  saveDocumentId,
  clearDocumentId,
} from '../../../utils/storage';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceService,
} from '../../types';

/**
 * Minimum workspace document structure
 * Note: We define a standalone interface rather than extending BaseDocument
 * because workspace documents may not have the `data` field.
 */
export interface AutomergeWorkspaceDoc {
  version: string;
  lastModified: number;
  identities: Record<string, IdentityProfile>;
  context?: {
    name?: string;
    avatarUrl?: string;
  };
  enabledModules?: Record<string, boolean>;
}

/**
 * WorkspaceService für Automerge BaseDocuments
 */
export class AutomergeWorkspaceService implements WorkspaceService {
  private docHandle: DocHandle<AutomergeWorkspaceDoc> | null = null;
  private repo: Repo;
  private storagePrefix: string;
  private listeners: Set<(workspace: Workspace | null) => void> = new Set();
  private changeHandler: (() => void) | null = null;
  private initialized = false;

  constructor(repo: Repo, storagePrefix: string) {
    this.repo = repo;
    this.storagePrefix = storagePrefix;
  }

  /**
   * Initialize workspace from URL or storage
   */
  async initialize(docUrl?: string): Promise<void> {
    if (this.initialized && this.docHandle) return;

    const urlToLoad = docUrl || this.getStoredDocId();

    if (urlToLoad) {
      try {
        this.docHandle = await this.repo.find<AutomergeWorkspaceDoc>(urlToLoad as AutomergeUrl);
        this.saveDocId(this.docHandle.url);
      } catch (e) {
        console.warn('Failed to load workspace document:', e);
        this.docHandle = null;
      }
    }

    if (this.docHandle) {
      this.setupSubscription();
    }
    this.initialized = true;
  }

  /**
   * Create a new workspace document
   */
  async createWorkspace(
    name: string,
    creatorId: string,
    creatorDisplayName: string,
    avatarUrl?: string
  ): Promise<string> {
    this.docHandle = this.repo.create<AutomergeWorkspaceDoc>();

    this.docHandle.change((d) => {
      d.version = '1.0.0';
      d.lastModified = Date.now();
      d.context = {
        name,
        avatarUrl,
      };
      d.identities = {
        [creatorId]: {
          displayName: creatorDisplayName,
        },
      };
      d.enabledModules = {};
    });

    this.saveDocId(this.docHandle.url);
    this.setupSubscription();
    this.initialized = true;

    return this.docHandle.url;
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

  get(): Workspace | null {
    const doc = this.docHandle?.docSync();
    if (!doc) return null;

    return this.mapToWorkspace(doc);
  }

  isLoaded(): boolean {
    return this.initialized && this.docHandle !== null;
  }

  async updateMetadata(
    changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>
  ): Promise<void> {
    if (!this.docHandle) {
      throw new Error('Workspace not initialized');
    }

    this.docHandle.change((d) => {
      if (!d.context) {
        d.context = {};
      }
      if (changes.name !== undefined) {
        d.context.name = changes.name;
      }
      if (changes.avatarUrl !== undefined) {
        d.context.avatarUrl = changes.avatarUrl;
      }
      d.lastModified = Date.now();
    });
  }

  async setEnabledModules(moduleIds: string[]): Promise<void> {
    if (!this.docHandle) {
      throw new Error('Workspace not initialized');
    }

    this.docHandle.change((d) => {
      d.enabledModules = {};
      moduleIds.forEach((id) => {
        d.enabledModules![id] = true;
      });
      d.lastModified = Date.now();
    });
  }

  getMember(identityId: string): WorkspaceMember | null {
    const doc = this.docHandle?.docSync();
    const identity = doc?.identities?.[identityId];
    if (!identity) return null;

    return {
      displayName: identity.displayName || `User-${identityId.slice(-6)}`,
      role: this.inferRole(identityId, doc),
    };
  }

  async updateMember(
    identityId: string,
    changes: Partial<WorkspaceMember>
  ): Promise<void> {
    if (!this.docHandle) {
      throw new Error('Workspace not initialized');
    }

    this.docHandle.change((d) => {
      if (!d.identities[identityId]) {
        d.identities[identityId] = {};
      }

      const identity = d.identities[identityId];
      if (changes.displayName !== undefined) {
        identity.displayName = changes.displayName;
      }
      // Note: role is inferred, not stored directly in current schema
      // avatarUrl is stored on identity profile, not workspace member

      d.lastModified = Date.now();
    });
  }

  subscribe(callback: (workspace: Workspace | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const workspace = this.get();
    this.listeners.forEach((cb) => cb(workspace));
  }

  /**
   * Map Automerge document to Workspace interface
   */
  private mapToWorkspace(doc: AutomergeWorkspaceDoc): Workspace {
    const members: Record<string, WorkspaceMember> = {};

    Object.entries(doc.identities || {}).forEach(([id, profile]) => {
      members[id] = {
        displayName: profile.displayName || `User-${id.slice(-6)}`,
        role: this.inferRole(id, doc),
      };
    });

    return {
      id: this.docHandle?.url || 'unknown',
      name: doc.context?.name || 'Unnamed Workspace',
      avatarUrl: doc.context?.avatarUrl,
      members,
      enabledModules: Object.keys(doc.enabledModules || {}).filter(
        (k) => doc.enabledModules![k]
      ),
    };
  }

  /**
   * Infer member role from document structure
   * (In current schema, first member is admin)
   */
  private inferRole(
    identityId: string,
    doc: AutomergeWorkspaceDoc | undefined
  ): 'admin' | 'member' {
    if (!doc?.identities) return 'member';

    // First identity in the record is typically the creator/admin
    const identityIds = Object.keys(doc.identities);
    return identityIds[0] === identityId ? 'admin' : 'member';
  }

  // === Storage helpers ===

  private getStoredDocId(): string | null {
    return loadDocumentId(this.storagePrefix);
  }

  private saveDocId(url: string): void {
    saveDocumentId(this.storagePrefix, url);
  }

  clearStoredDocId(): void {
    clearDocumentId(this.storagePrefix);
  }

  // === Additional methods ===

  /**
   * Get the raw DocHandle for advanced operations
   */
  getDocHandle(): DocHandle<AutomergeWorkspaceDoc> | null {
    return this.docHandle;
  }

  /**
   * Get the document URL for sharing
   */
  getDocUrl(): string | undefined {
    return this.docHandle?.url;
  }

  /**
   * Set document handle directly (for external loading)
   */
  setDocHandle(handle: DocHandle<AutomergeWorkspaceDoc>): void {
    if (this.changeHandler && this.docHandle) {
      this.docHandle.off('change', this.changeHandler);
    }

    this.docHandle = handle;
    this.saveDocId(handle.url);
    this.setupSubscription();
    this.initialized = true;
    this.notifyListeners();
  }
}
