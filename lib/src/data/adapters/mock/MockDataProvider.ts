/**
 * Mock Data Provider
 *
 * In-Memory Implementierung für Tests und Entwicklung.
 * Keine Persistenz, keine Synchronisation.
 */

import { generateId } from '../../../schema/document';
import type {
  DataProvider,
  DataProviderCapabilities,
  SyncStatus,
  Item,
  ItemFilter,
  ItemStore,
  Relation,
  RelationFilter,
  RelationStore,
  Identity,
  SignInMethod,
  IdentityProvider,
  IdentityProviderCapabilities,
  TrustAttestation,
  TrustLevel,
  TrustService,
  UserDocument,
  UserDocumentService,
  UserDocumentProfile,
  WorkspaceRef,
  Workspace,
  WorkspaceMember,
  WorkspaceService,
} from '../../types';

// =============================================================================
// Mock Item Store
// =============================================================================

export class MockItemStore implements ItemStore {
  private items: Map<string, Item> = new Map();
  private listeners: Set<(items: Item[]) => void> = new Set();

  list(filter?: ItemFilter): Item[] {
    let result = Array.from(this.items.values());

    if (filter) {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        result = result.filter((item) => types.includes(item.type));
      }
      if (filter.createdBy) {
        result = result.filter((item) => item.createdBy === filter.createdBy);
      }
      if (filter.tags && filter.tags.length > 0) {
        result = result.filter(
          (item) =>
            item.tags && filter.tags!.some((tag) => item.tags!.includes(tag))
        );
      }
      if (filter.geo === true) {
        result = result.filter((item) => item.geo !== undefined);
      }
      if (filter.dateTime === true) {
        result = result.filter((item) => item.dateTime !== undefined);
      }
      // TODO: Geo radius/polygon filtering
      // TODO: DateTime range filtering
    }

    return result;
  }

  get(id: string): Item | null {
    return this.items.get(id) ?? null;
  }

  subscribe(callback: (items: Item[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async create(
    item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Item> {
    const now = Date.now();
    const newItem: Item = {
      ...item,
      id: generateId('item'),
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(newItem.id, newItem);
    this.notifyListeners();
    return newItem;
  }

  async update(id: string, changes: Partial<Item>): Promise<void> {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Item not found: ${id}`);
    }
    const updated: Item = {
      ...item,
      ...changes,
      id: item.id, // Prevent ID change
      createdAt: item.createdAt, // Prevent createdAt change
      updatedAt: Date.now(),
    };
    this.items.set(id, updated);
    this.notifyListeners();
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const items = this.list();
    this.listeners.forEach((cb) => cb(items));
  }
}

// =============================================================================
// Mock Relation Store
// =============================================================================

export class MockRelationStore implements RelationStore {
  private relations: Map<string, Relation> = new Map();
  private listeners: Set<(relations: Relation[]) => void> = new Set();

  list(filter?: RelationFilter): Relation[] {
    let result = Array.from(this.relations.values());

    if (filter) {
      if (filter.subject) {
        result = result.filter((r) => r.subject === filter.subject);
      }
      if (filter.predicate) {
        const predicates = Array.isArray(filter.predicate)
          ? filter.predicate
          : [filter.predicate];
        result = result.filter((r) => predicates.includes(r.predicate));
      }
      if (filter.object) {
        result = result.filter((r) => r.object === filter.object);
      }
      if (filter.createdBy) {
        result = result.filter((r) => r.createdBy === filter.createdBy);
      }
    }

    return result;
  }

  getBySubject(subjectId: string, predicate?: string): Relation[] {
    return this.list({ subject: subjectId, predicate });
  }

  getByObject(objectId: string, predicate?: string): Relation[] {
    return this.list({ object: objectId, predicate });
  }

  subscribe(callback: (relations: Relation[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async create(relation: Omit<Relation, 'id' | 'createdAt'>): Promise<Relation> {
    const newRelation: Relation = {
      ...relation,
      id: generateId('rel'),
      createdAt: Date.now(),
    };
    this.relations.set(newRelation.id, newRelation);
    this.notifyListeners();
    return newRelation;
  }

  async delete(id: string): Promise<void> {
    this.relations.delete(id);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const relations = this.list();
    this.listeners.forEach((cb) => cb(relations));
  }
}

// =============================================================================
// Mock Identity Provider
// =============================================================================

export class MockIdentityProvider implements IdentityProvider {
  private identity: Identity | null = null;
  private listeners: Set<(identity: Identity | null) => void> = new Set();

  readonly capabilities: IdentityProviderCapabilities = {
    canExportMnemonic: false,
    canExportKeyFile: true,
    signInMethods: ['keyFile'],
  };

  getCurrentIdentity(): Identity | null {
    return this.identity;
  }

  isAuthenticated(): boolean {
    return this.identity !== null;
  }

  async signUp(params?: { displayName?: string }): Promise<Identity> {
    const id = `mock:${generateId('user')}`;
    this.identity = {
      id,
      displayName: params?.displayName ?? `User-${id.slice(-6)}`,
      canSign: false,
    };
    this.notifyListeners();
    return this.identity;
  }

  async signIn(method: SignInMethod): Promise<Identity> {
    // Mock: Just create a new identity
    return this.signUp();
  }

  async signOut(): Promise<void> {
    this.identity = null;
    this.notifyListeners();
  }

  async updateProfile(changes: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    if (!this.identity) {
      throw new Error('Not authenticated');
    }
    this.identity = {
      ...this.identity,
      ...changes,
    };
    this.notifyListeners();
  }

  async exportKeyFile(): Promise<Blob> {
    if (!this.identity) {
      throw new Error('Not authenticated');
    }
    return new Blob([JSON.stringify(this.identity)], {
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
}

// =============================================================================
// Mock Trust Service
// =============================================================================

export class MockTrustService implements TrustService {
  private trustGiven: Map<string, TrustAttestation> = new Map();
  private trustReceived: Map<string, TrustAttestation> = new Map();
  private listeners: Set<(trust: TrustAttestation[]) => void> = new Set();
  private currentUserId: string;

  constructor(currentUserId: string) {
    this.currentUserId = currentUserId;
  }

  getTrustGiven(): TrustAttestation[] {
    return Array.from(this.trustGiven.values());
  }

  getTrustReceived(): TrustAttestation[] {
    return Array.from(this.trustReceived.values());
  }

  getTrustLevel(identityId: string): TrustLevel | null {
    const attestation = this.trustGiven.get(identityId);
    return attestation?.level ?? null;
  }

  async setTrust(trusteeId: string, level: TrustLevel): Promise<void> {
    const attestation: TrustAttestation = {
      id: generateId('trust'),
      trustorId: this.currentUserId,
      trusteeId,
      level,
      createdAt: Date.now(),
    };
    this.trustGiven.set(trusteeId, attestation);
    this.notifyListeners();
  }

  async revokeTrust(trusteeId: string): Promise<void> {
    this.trustGiven.delete(trusteeId);
    this.notifyListeners();
  }

  subscribe(callback: (trust: TrustAttestation[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const all = [...this.getTrustGiven(), ...this.getTrustReceived()];
    this.listeners.forEach((cb) => cb(all));
  }

  // For testing: add received trust
  _addReceivedTrust(attestation: TrustAttestation): void {
    this.trustReceived.set(attestation.trustorId, attestation);
    this.notifyListeners();
  }
}

// =============================================================================
// Mock User Document Service
// =============================================================================

export class MockUserDocumentService implements UserDocumentService {
  private userDoc: UserDocument | null = null;
  private listeners: Set<(doc: UserDocument | null) => void> = new Set();

  constructor(ownerId: string, displayName: string) {
    this.userDoc = {
      id: generateId('userdoc'),
      ownerId,
      profile: { displayName },
      workspaces: [],
    };
  }

  get(): UserDocument | null {
    return this.userDoc;
  }

  isLoaded(): boolean {
    return this.userDoc !== null;
  }

  async updateProfile(changes: Partial<UserDocumentProfile>): Promise<void> {
    if (!this.userDoc) return;
    this.userDoc = {
      ...this.userDoc,
      profile: { ...this.userDoc.profile, ...changes },
    };
    this.notifyListeners();
  }

  async addWorkspace(ref: WorkspaceRef): Promise<void> {
    if (!this.userDoc) return;
    this.userDoc = {
      ...this.userDoc,
      workspaces: [...this.userDoc.workspaces, ref],
    };
    this.notifyListeners();
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    if (!this.userDoc) return;
    this.userDoc = {
      ...this.userDoc,
      workspaces: this.userDoc.workspaces.filter((w) => w.id !== workspaceId),
    };
    this.notifyListeners();
  }

  subscribe(callback: (doc: UserDocument | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.userDoc));
  }
}

// =============================================================================
// Mock Workspace Service
// =============================================================================

export class MockWorkspaceService implements WorkspaceService {
  private workspace: Workspace | null = null;
  private listeners: Set<(workspace: Workspace | null) => void> = new Set();

  constructor(name: string, creatorId: string) {
    this.workspace = {
      id: generateId('workspace'),
      name,
      members: {
        [creatorId]: { displayName: 'Creator', role: 'admin' },
      },
      enabledModules: [],
    };
  }

  get(): Workspace | null {
    return this.workspace;
  }

  isLoaded(): boolean {
    return this.workspace !== null;
  }

  async updateMetadata(
    changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>
  ): Promise<void> {
    if (!this.workspace) return;
    this.workspace = { ...this.workspace, ...changes };
    this.notifyListeners();
  }

  async setEnabledModules(moduleIds: string[]): Promise<void> {
    if (!this.workspace) return;
    this.workspace = { ...this.workspace, enabledModules: moduleIds };
    this.notifyListeners();
  }

  getMember(identityId: string): WorkspaceMember | null {
    return this.workspace?.members[identityId] ?? null;
  }

  async updateMember(
    identityId: string,
    changes: Partial<WorkspaceMember>
  ): Promise<void> {
    if (!this.workspace) return;
    const existing = this.workspace.members[identityId];
    if (!existing) return;
    this.workspace = {
      ...this.workspace,
      members: {
        ...this.workspace.members,
        [identityId]: { ...existing, ...changes },
      },
    };
    this.notifyListeners();
  }

  subscribe(callback: (workspace: Workspace | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.workspace));
  }
}

// =============================================================================
// Mock Data Provider
// =============================================================================

export interface MockDataProviderOptions {
  initialIdentity?: {
    id: string;
    displayName: string;
  };
  workspaceName?: string;
}

export class MockDataProvider implements DataProvider {
  readonly items: ItemStore;
  readonly relations: RelationStore;
  readonly identity: IdentityProvider;
  readonly trust: TrustService;
  readonly userDoc: UserDocumentService;
  readonly workspace: WorkspaceService;

  readonly capabilities: DataProviderCapabilities = {
    offline: true,
    realtime: false,
    signatureVerification: false,
  };

  readonly syncStatus: SyncStatus = 'synced';

  private syncStatusListeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(options: MockDataProviderOptions = {}) {
    const userId = options.initialIdentity?.id ?? `mock:${generateId('user')}`;
    const displayName =
      options.initialIdentity?.displayName ?? `User-${userId.slice(-6)}`;

    this.items = new MockItemStore();
    this.relations = new MockRelationStore();
    this.identity = new MockIdentityProvider();
    this.trust = new MockTrustService(userId);
    this.userDoc = new MockUserDocumentService(userId, displayName);
    this.workspace = new MockWorkspaceService(
      options.workspaceName ?? 'Test Workspace',
      userId
    );

    // Auto sign-up with initial identity
    if (options.initialIdentity) {
      (this.identity as MockIdentityProvider).signUp({
        displayName: options.initialIdentity.displayName,
      });
    }
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.add(callback);
    return () => this.syncStatusListeners.delete(callback);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createMockDataProvider(
  options?: MockDataProviderOptions
): DataProvider {
  return new MockDataProvider(options);
}
