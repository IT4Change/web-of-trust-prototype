/**
 * Automerge Data Provider
 *
 * Kombiniert alle Automerge-Services zu einem vollständigen DataProvider.
 */

import type { DocHandle, Repo } from '@automerge/automerge-repo';
import type { UserDocument as LegacyUserDocument } from '../../../schema';
import type {
  DataProvider,
  DataProviderCapabilities,
  SyncStatus,
  ItemStore,
  RelationStore,
  IdentityProvider,
  TrustService,
  UserDocumentService,
  WorkspaceService,
} from '../../types';
import { AutomergeItemStore, type AutomergeItemsDoc } from './AutomergeItemStore';
import { AutomergeRelationStore, type AutomergeRelationsDoc } from './AutomergeRelationStore';
import { AutomergeIdentityProvider } from './AutomergeIdentityProvider';
import { AutomergeTrustService } from './AutomergeTrustService';
import { AutomergeUserDocService } from './AutomergeUserDocService';
import { AutomergeWorkspaceService, type AutomergeWorkspaceDoc } from './AutomergeWorkspaceService';

/**
 * Combined document type for workspace documents that include items and relations
 */
export interface AutomergeWorkspaceDataDoc extends AutomergeWorkspaceDoc, AutomergeItemsDoc, AutomergeRelationsDoc {}

/**
 * Options for creating an AutomergeDataProvider
 */
export interface AutomergeDataProviderOptions {
  /** Automerge Repo instance */
  repo: Repo;

  /** Storage prefix for localStorage keys */
  storagePrefix: string;

  /** Existing workspace document handle (optional) */
  workspaceDocHandle?: DocHandle<AutomergeWorkspaceDataDoc>;

  /** Existing user document handle (optional) */
  userDocHandle?: DocHandle<LegacyUserDocument>;

  /** Enable UserDocument support */
  enableUserDocument?: boolean;
}

/**
 * Automerge DataProvider
 *
 * Provides a complete DataProvider implementation using Automerge for:
 * - Items and Relations (in workspace document)
 * - Identity (DID:key with Ed25519)
 * - Trust (in UserDocument)
 * - UserDocument (personal cross-workspace document)
 * - Workspace (BaseDocument with context and identities)
 */
export class AutomergeDataProvider implements DataProvider {
  readonly items: ItemStore;
  readonly relations: RelationStore;
  readonly identity: IdentityProvider;
  readonly trust: TrustService;
  readonly userDoc: UserDocumentService;
  readonly workspace: WorkspaceService;

  readonly capabilities: DataProviderCapabilities = {
    offline: true,
    realtime: true,
    signatureVerification: true,
  };

  private _syncStatus: SyncStatus = 'synced';
  private syncStatusListeners: Set<(status: SyncStatus) => void> = new Set();

  private repo: Repo;
  private identityProvider: AutomergeIdentityProvider;
  private workspaceService: AutomergeWorkspaceService;
  private userDocService: AutomergeUserDocService | null = null;
  private trustService: AutomergeTrustService;
  private itemStore: AutomergeItemStore | null = null;
  private relationStore: AutomergeRelationStore | null = null;

  constructor(options: AutomergeDataProviderOptions) {
    this.repo = options.repo;

    // Initialize Identity Provider
    this.identityProvider = new AutomergeIdentityProvider();
    this.identity = this.identityProvider;

    // Get current identity
    const currentIdentity = this.identityProvider.getCurrentIdentity();
    const currentUserId = currentIdentity?.id || 'anonymous';
    const displayName = currentIdentity?.displayName || 'Anonymous';

    // Initialize Workspace Service
    this.workspaceService = new AutomergeWorkspaceService(
      options.repo,
      options.storagePrefix
    );
    this.workspace = this.workspaceService;

    // Initialize UserDocument Service (if enabled)
    if (options.enableUserDocument && currentIdentity) {
      this.userDocService = new AutomergeUserDocService(
        options.repo,
        currentUserId,
        displayName
      );
    }

    // Initialize Trust Service
    this.trustService = new AutomergeTrustService(currentUserId, {
      privateKey: this.identityProvider.getPrivateKey(),
      repo: options.repo,
    });
    this.trust = this.trustService;

    // Create placeholder stores (will be initialized when workspace is loaded)
    // For now, create mock implementations that throw on use
    this.items = this.createPlaceholderItemStore();
    this.relations = this.createPlaceholderRelationStore();
    this.userDoc = this.userDocService || this.createPlaceholderUserDocService();

    // If workspace doc handle is provided, initialize stores immediately
    if (options.workspaceDocHandle) {
      this.setWorkspaceDocHandle(options.workspaceDocHandle);
    }

    // If user doc handle is provided, connect it
    if (options.userDocHandle && this.userDocService) {
      // UserDocService handles its own initialization
    }
  }

  get syncStatus(): SyncStatus {
    return this._syncStatus;
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.add(callback);
    return () => this.syncStatusListeners.delete(callback);
  }

  /**
   * Set the workspace document handle and initialize item/relation stores
   */
  setWorkspaceDocHandle(handle: DocHandle<AutomergeWorkspaceDataDoc>): void {
    // Initialize item store
    this.itemStore = new AutomergeItemStore(handle);
    (this as { items: ItemStore }).items = this.itemStore;

    // Initialize relation store
    this.relationStore = new AutomergeRelationStore(handle);
    (this as { relations: RelationStore }).relations = this.relationStore;

    // Update workspace service
    this.workspaceService.setDocHandle(handle);
  }

  /**
   * Initialize the provider (load documents, etc.)
   */
  async initialize(): Promise<void> {
    // Initialize workspace
    await this.workspaceService.initialize();

    // Initialize user document
    if (this.userDocService) {
      await this.userDocService.initialize();

      // Connect trust service to user document
      const userDocHandle = this.userDocService.getDocHandle();
      if (userDocHandle) {
        this.trustService.setUserDocHandle(userDocHandle);
      }
    }

    // If workspace is loaded, create item/relation stores
    const workspaceHandle = this.workspaceService.getDocHandle();
    if (workspaceHandle) {
      this.setWorkspaceDocHandle(workspaceHandle as DocHandle<AutomergeWorkspaceDataDoc>);
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string, avatarUrl?: string): Promise<string> {
    const identity = this.identityProvider.getCurrentIdentity();
    if (!identity) {
      throw new Error('Must be authenticated to create workspace');
    }

    const docUrl = await this.workspaceService.createWorkspace(
      name,
      identity.id,
      identity.displayName,
      avatarUrl
    );

    // Get the handle and initialize stores
    const handle = this.workspaceService.getDocHandle();
    if (handle) {
      this.setWorkspaceDocHandle(handle as DocHandle<AutomergeWorkspaceDataDoc>);
    }

    return docUrl;
  }

  /**
   * Join an existing workspace
   */
  async joinWorkspace(docUrl: string): Promise<void> {
    await this.workspaceService.initialize(docUrl);

    const handle = this.workspaceService.getDocHandle();
    if (handle) {
      this.setWorkspaceDocHandle(handle as DocHandle<AutomergeWorkspaceDataDoc>);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.itemStore?.destroy();
    this.relationStore?.destroy();
    this.trustService.destroy();
    this.userDocService?.destroy();
    this.workspaceService.destroy();
    this.syncStatusListeners.clear();
  }

  // === Private helper methods ===

  private createPlaceholderItemStore(): ItemStore {
    return {
      list: () => [],
      get: () => null,
      subscribe: () => () => {},
      create: async () => {
        throw new Error('Workspace not initialized');
      },
      update: async () => {
        throw new Error('Workspace not initialized');
      },
      delete: async () => {
        throw new Error('Workspace not initialized');
      },
    };
  }

  private createPlaceholderRelationStore(): RelationStore {
    return {
      list: () => [],
      getBySubject: () => [],
      getByObject: () => [],
      subscribe: () => () => {},
      create: async () => {
        throw new Error('Workspace not initialized');
      },
      delete: async () => {
        throw new Error('Workspace not initialized');
      },
    };
  }

  private createPlaceholderUserDocService(): UserDocumentService {
    return {
      get: () => null,
      isLoaded: () => false,
      updateProfile: async () => {
        throw new Error('UserDocument not enabled');
      },
      addWorkspace: async () => {
        throw new Error('UserDocument not enabled');
      },
      removeWorkspace: async () => {
        throw new Error('UserDocument not enabled');
      },
      subscribe: () => () => {},
    };
  }

  private setSyncStatus(status: SyncStatus): void {
    this._syncStatus = status;
    this.syncStatusListeners.forEach((cb) => cb(status));
  }
}

/**
 * Factory function to create an AutomergeDataProvider
 */
export function createAutomergeDataProvider(
  options: AutomergeDataProviderOptions
): AutomergeDataProvider {
  return new AutomergeDataProvider(options);
}
