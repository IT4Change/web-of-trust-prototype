/**
 * Backend-Abstraction Types
 *
 * Diese Interfaces definieren die gemeinsame Daten- und Identitätsschnittstelle
 * für alle Backend-Adapter (Automerge, REST, Yjs, etc.)
 */

import type { Feature, Polygon } from 'geojson';

// =============================================================================
// Item Model
// =============================================================================

/**
 * Generisches Item - Basis für alle Datenobjekte
 *
 * Items sind die zentrale Datenstruktur, die von allen Modulen geteilt wird.
 * Module erweitern Items über das `extensions` Feld.
 */
export interface Item {
  // Core
  id: string;
  type: string; // "assumption" | "offer" | "event" | ...
  createdBy: string; // Identity-ID (Owner)
  createdAt: number;
  updatedAt: number;

  // Gemeinsame optionale Felder (für Cross-Modul-Features)
  title?: string;
  description?: string;
  geo?: Feature; // GeoJSON Feature (Point, Polygon, LineString, etc.)
  dateTime?: ItemDateTime;
  tags?: string[];

  // Sharing & Permissions (Item-Level)
  sharing: ItemSharing;

  // Modul-spezifische Erweiterungen
  extensions: Record<string, unknown>;
}

export interface ItemDateTime {
  start: number; // Unix timestamp
  end?: number; // Unix timestamp
  allDay?: boolean;
}

export interface ItemSharing {
  visibility: 'private' | 'shared' | 'public';
  sharedWith: ShareTarget[];
}

export type ShareTarget =
  | { type: 'workspace'; workspaceId: string; permission: Permission }
  | { type: 'identity'; identityId: string; permission: Permission };

export type Permission = 'read' | 'write' | 'admin';

// =============================================================================
// Relations (Item-zu-Item Beziehungen)
// =============================================================================

/**
 * Relation - Subject-Predicate-Object Tripel
 *
 * Ermöglicht Beziehungen zwischen Items und/oder Identities.
 */
export interface Relation {
  id: string;
  subject: string; // Item-ID oder Identity-ID
  predicate: string; // Beziehungstyp (z.B. "votes_on", "replies_to", "parent_of")
  object: string; // Item-ID oder Identity-ID
  createdBy: string;
  createdAt: number;

  // Optional: Zusätzliche Daten zur Relation
  metadata?: Record<string, unknown>;
}

// Vordefinierte Prädikate (erweiterbar durch Module)
export type CommonPredicate =
  | 'votes_on' // User voted auf Item
  | 'replies_to' // Item antwortet auf Item
  | 'parent_of' // Hierarchische Beziehung
  | 'child_of' // Inverse von parent_of
  | 'related_to' // Lose Verknüpfung
  | 'assigned_to' // Task zugewiesen an Identity
  | 'tagged_with'; // Item hat Tag (wenn Tags als Items modelliert)

// =============================================================================
// ItemStore
// =============================================================================

export interface ItemFilter {
  type?: string | string[];
  createdBy?: string;
  tags?: string[];

  // Geo-Filter: true = "hat Location", oder spezifische Query
  geo?:
    | true
    | {
        near: { lat: number; lng: number };
        radiusKm: number;
      }
    | {
        within: Polygon;
      };

  // DateTime-Filter: true = "hat Datum", oder spezifische Query
  dateTime?:
    | true
    | {
        after?: number;
        before?: number;
        overlaps?: { start: number; end: number };
      };
}

export interface ItemStore {
  // Queries
  list(filter?: ItemFilter): Item[];
  get(id: string): Item | null;
  subscribe(callback: (items: Item[]) => void): () => void;

  // Mutations
  create(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item>;
  update(id: string, changes: Partial<Item>): Promise<void>;
  delete(id: string): Promise<void>;
}

// =============================================================================
// RelationStore
// =============================================================================

export interface RelationFilter {
  subject?: string;
  predicate?: string | string[];
  object?: string;
  createdBy?: string;
}

export interface RelationStore {
  // Queries
  list(filter?: RelationFilter): Relation[];
  getBySubject(subjectId: string, predicate?: string): Relation[];
  getByObject(objectId: string, predicate?: string): Relation[];
  subscribe(callback: (relations: Relation[]) => void): () => void;

  // Mutations
  create(
    relation: Omit<Relation, 'id' | 'createdAt'>
  ): Promise<Relation>;
  delete(id: string): Promise<void>;
}

// =============================================================================
// Identity
// =============================================================================

export interface Identity {
  id: string; // Eindeutige ID (DID oder OAuth-ID)
  displayName: string;
  avatarUrl?: string;

  // Optional: Krypto-Fähigkeiten
  canSign?: boolean;
  publicKey?: string;
}

// Verschiedene Sign-In Methoden
export type SignInMethod =
  | { type: 'mnemonic'; mnemonic: string } // 12/24 Wörter
  | { type: 'privateKey'; privateKey: string } // Raw Key (base64)
  | { type: 'keyFile'; file: File } // JSON-Export
  | { type: 'oauth'; provider: string }; // Für OAuth-Adapter

export interface IdentityProviderCapabilities {
  canExportMnemonic: boolean;
  canExportKeyFile: boolean;
  signInMethods: SignInMethod['type'][];
}

export interface IdentityProvider {
  // Status
  getCurrentIdentity(): Identity | null;
  isAuthenticated(): boolean;

  // Authentifizierung
  signUp(params?: { displayName?: string }): Promise<Identity>;
  signIn(method: SignInMethod): Promise<Identity>;
  signOut(): Promise<void>;

  // Profil
  updateProfile(changes: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void>;

  // Export (für Backup) - optional je nach Adapter
  exportMnemonic?(): Promise<string>;
  exportKeyFile?(): Promise<Blob>;

  // Capabilities
  readonly capabilities: IdentityProviderCapabilities;

  // Events
  subscribe(callback: (identity: Identity | null) => void): () => void;
}

// =============================================================================
// Trust
// =============================================================================

export type TrustLevel = 'full' | 'limited' | 'none';

export interface TrustAttestation {
  id: string;
  trustorId: string; // Wer vertraut
  trusteeId: string; // Wem wird vertraut
  level: TrustLevel;
  createdAt: number;
  signature?: string; // Optional, wenn Identity signieren kann
}

export interface TrustService {
  // Queries
  getTrustGiven(): TrustAttestation[];
  getTrustReceived(): TrustAttestation[];
  getTrustLevel(identityId: string): TrustLevel | null;

  // Mutations
  setTrust(trusteeId: string, level: TrustLevel): Promise<void>;
  revokeTrust(trusteeId: string): Promise<void>;

  // Events
  subscribe(callback: (trust: TrustAttestation[]) => void): () => void;
}

// =============================================================================
// UserDocument
// =============================================================================

export interface WorkspaceRef {
  id: string;
  name?: string;
  avatarUrl?: string;
  addedAt: number;
}

export interface UserDocumentProfile {
  displayName: string;
  avatarUrl?: string;
}

export interface UserDocument {
  id: string;
  ownerId: string;
  profile: UserDocumentProfile;
  workspaces: WorkspaceRef[];
}

export interface UserDocumentService {
  get(): UserDocument | null;
  isLoaded(): boolean;

  updateProfile(changes: Partial<UserDocumentProfile>): Promise<void>;
  addWorkspace(ref: WorkspaceRef): Promise<void>;
  removeWorkspace(workspaceId: string): Promise<void>;

  subscribe(callback: (doc: UserDocument | null) => void): () => void;
}

// =============================================================================
// Workspace
// =============================================================================

export type WorkspaceMemberRole = 'admin' | 'member';

export interface WorkspaceMember {
  displayName: string;
  role: WorkspaceMemberRole;
}

export interface Workspace {
  id: string;
  name: string;
  avatarUrl?: string;
  members: Record<string, WorkspaceMember>;
  enabledModules: string[];
}

export interface WorkspaceService {
  get(): Workspace | null;
  isLoaded(): boolean;

  updateMetadata(
    changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>
  ): Promise<void>;
  setEnabledModules(moduleIds: string[]): Promise<void>;

  // Member-Management
  getMember(identityId: string): WorkspaceMember | null;
  updateMember(
    identityId: string,
    changes: Partial<WorkspaceMember>
  ): Promise<void>;

  subscribe(callback: (workspace: Workspace | null) => void): () => void;
}

// =============================================================================
// DataProvider (kombiniert alles)
// =============================================================================

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface DataProviderCapabilities {
  offline: boolean;
  realtime: boolean;
  signatureVerification: boolean;
}

export interface DataProvider {
  // Services
  readonly items: ItemStore;
  readonly relations: RelationStore;
  readonly identity: IdentityProvider;
  readonly trust: TrustService;
  readonly userDoc: UserDocumentService;
  readonly workspace: WorkspaceService;

  // Meta
  readonly capabilities: DataProviderCapabilities;
  readonly syncStatus: SyncStatus;
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void;
}

// =============================================================================
// Adapter Factory
// =============================================================================

export type AdapterType = 'automerge' | 'rest' | 'yjs' | 'mock';

export interface AdapterConfig {
  type: AdapterType;

  // Automerge-spezifisch
  automerge?: {
    syncServers?: string[];
    enableBroadcastChannel?: boolean;
  };

  // REST-spezifisch
  rest?: {
    baseUrl: string;
    headers?: Record<string, string>;
  };

  // Yjs-spezifisch
  yjs?: {
    serverUrl: string;
  };
}

/**
 * Factory-Funktion zum Erstellen eines DataProviders
 */
export type CreateDataProvider = (config: AdapterConfig) => Promise<DataProvider>;
