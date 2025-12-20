# Backend-Abstraktion für Narrative

## Ziel

Frontend von Backend/Sync-Protokoll/Identity-Protokoll entkoppeln für Experimente mit verschiedenen Protokollen (Automerge, REST, Yjs, später p2panda, GraphQL).

## Design-Prinzipien

1. **Frontend-First**: Interfaces orientieren sich an Frontend-Logik, nicht an Backend-Technologie
2. **Bottom-Up**: Erst extrahieren, dann experimentieren, dann abstrahieren
3. **Schrittweise**: Kleine, testbare Schritte statt Big Bang
4. **Generische Items**: Einheitliches Item-Modell, das Module teilen

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  useItems() useIdentity() useTrust() useWorkspace() │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼─────────────────────────────┐ │
│  │                    DataProvider                        │ │
│  │  • items: ItemStore                                    │ │
│  │  • identity: IdentityProvider                          │ │
│  │  • trust: TrustService                                 │ │
│  │  • workspace: WorkspaceService                         │ │
│  │  • userDoc: UserDocumentService                        │ │
│  │  • capabilities: { offline, realtime, ... }            │ │
│  └─────────────────────────┬─────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
    ┌───────────┐      ┌───────────┐      ┌───────────┐
    │ Automerge │      │   REST    │      │    Yjs    │
    │  Adapter  │      │  Adapter  │      │  Adapter  │
    └───────────┘      └───────────┘      └───────────┘
```

---

## Generisches Item-Modell

```typescript
interface Item {
  // Core
  id: string;
  type: string;                      // "assumption" | "offer" | "event" | ...
  createdBy: string;                 // Identity-ID (Owner)
  createdAt: number;
  updatedAt: number;

  // Gemeinsame optionale Felder (für Cross-Modul-Features)
  title?: string;
  description?: string;
  geo?: { lat: number; lng: number; label?: string };
  dateTime?: { start: number; end?: number; allDay?: boolean };
  tags?: string[];

  // Sharing & Permissions (Item-Level)
  sharing: {
    visibility: 'private' | 'shared' | 'public';
    sharedWith: ShareTarget[];       // Mit wem geteilt
  };

  // Modul-spezifische Erweiterungen
  extensions: {
    [moduleId: string]: unknown;
    // z.B. "narrative": { votes: Vote[], editLog: EditEntry[] }
    // z.B. "market": { price: number, currency: string }
  };
}

// Sharing-Ziele
type ShareTarget =
  | { type: 'workspace'; workspaceId: string; permission: Permission }
  | { type: 'identity'; identityId: string; permission: Permission }

type Permission = 'read' | 'write' | 'admin';
```

**Module erweitern Items:**
- Map-Modul: Zeigt alle Items mit `geo`
- Kalender-Modul: Zeigt alle Items mit `dateTime`
- Narrative-Modul: Fügt `extensions.narrative.votes` hinzu
- Market-Modul: Fügt `extensions.market.price` hinzu

---

## Relations (Item-zu-Item Beziehungen)

```typescript
interface Relation {
  id: string;
  subject: string;                   // Item-ID (oder Identity-ID)
  predicate: string;                 // Beziehungstyp
  object: string;                    // Item-ID (oder Identity-ID)
  createdBy: string;
  createdAt: number;

  // Optional: Zusätzliche Daten zur Relation
  metadata?: Record<string, unknown>;
}

// Beispiele für Prädikate:
// - "votes_on"      : User voted auf Assumption
// - "replies_to"    : Kommentar antwortet auf Item
// - "parent_of"     : Hierarchische Beziehung
// - "related_to"    : Lose Verknüpfung
// - "authored_by"   : Item wurde erstellt von
// - "assigned_to"   : Task zugewiesen an

interface RelationStore {
  // Queries
  list(filter?: RelationFilter): Relation[];
  getBySubject(subjectId: string, predicate?: string): Relation[];
  getByObject(objectId: string, predicate?: string): Relation[];

  // Mutations
  create(relation: Omit<Relation, 'id' | 'createdAt'>): Promise<Relation>;
  delete(id: string): Promise<void>;

  // Events
  subscribe(callback: (relations: Relation[]) => void): () => void;
}

interface RelationFilter {
  subject?: string;
  predicate?: string | string[];
  object?: string;
  createdBy?: string;
}
```

**Beispiel: Vote als Relation statt Extension**
```typescript
// Vote ist eine Relation zwischen User und Assumption
{
  subject: "did:key:z6Mk...",        // Wer voted
  predicate: "votes_on",
  object: "item-123",                // Assumption
  metadata: { value: "green" }       // Vote-Wert
}
```

**Vorteile von Relations:**
- Queries in beide Richtungen ("Wer hat auf X gevotet?" / "Worauf hat Y gevotet?")
- Einheitliches Modell für alle Beziehungen
- Einfacher zu synchronisieren als nested Arrays

---

## Core Interfaces

### ItemStore

```typescript
interface ItemStore {
  // Queries
  list(filter?: ItemFilter): Item[];
  get(id: string): Item | null;
  subscribe(callback: (items: Item[]) => void): () => void;

  // Mutations
  create(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item>;
  update(id: string, changes: Partial<Item>): Promise<void>;
  delete(id: string): Promise<void>;
}

interface ItemFilter {
  type?: string | string[];
  createdBy?: string;
  tags?: string[];

  // Geo-Filter: true = "hat Location", oder spezifische Query
  geo?: true | {
    nearLat: number;
    nearLng: number;
    radiusKm: number;
  };

  // DateTime-Filter: true = "hat Datum", oder spezifische Query
  dateTime?: true | {
    after?: number;   // Timestamp
    before?: number;
    overlaps?: { start: number; end: number };
  };

  // Erweiterbar für Module
}
```

### IdentityProvider

```typescript
interface Identity {
  id: string;                        // Eindeutige ID (DID oder OAuth-ID)
  displayName: string;
  avatarUrl?: string;

  // Optional: Krypto-Fähigkeiten
  canSign?: boolean;
  publicKey?: string;
}

// Verschiedene Sign-In Methoden
type SignInMethod =
  | { type: 'mnemonic'; mnemonic: string }           // 12/24 Wörter
  | { type: 'privateKey'; privateKey: string }       // Raw Key (base64)
  | { type: 'keyFile'; file: File }                  // JSON-Export
  | { type: 'oauth'; provider: string }              // Für OAuth-Adapter

interface IdentityProvider {
  // Status
  getCurrentIdentity(): Identity | null;
  isAuthenticated(): boolean;

  // Authentifizierung
  signUp(params?: { displayName?: string }): Promise<Identity>;  // Neues Keypair/Account
  signIn(method: SignInMethod): Promise<Identity>;               // Bestehendes wiederherstellen
  signOut(): Promise<void>;

  // Profil
  updateProfile(changes: { displayName?: string; avatarUrl?: string }): Promise<void>;

  // Export (für Backup) - optional je nach Adapter
  exportMnemonic?(): Promise<string>;
  exportKeyFile?(): Promise<Blob>;

  // Capabilities - was kann dieser Adapter?
  readonly capabilities: {
    canExportMnemonic: boolean;
    canExportKeyFile: boolean;
    signInMethods: SignInMethod['type'][];  // ['mnemonic', 'privateKey', 'keyFile'] oder ['oauth']
  };

  // Events
  subscribe(callback: (identity: Identity | null) => void): () => void;
}
```

### TrustService

```typescript
interface TrustAttestation {
  id: string;
  trustorId: string;                 // Wer vertraut
  trusteeId: string;                 // Wem wird vertraut
  level: 'full' | 'limited' | 'none';
  createdAt: number;
  signature?: string;                // Optional, wenn Identity signieren kann
}

interface TrustService {
  // Queries
  getTrustGiven(): TrustAttestation[];
  getTrustReceived(): TrustAttestation[];
  getTrustLevel(identityId: string): 'full' | 'limited' | 'none' | null;

  // Mutations
  setTrust(trusteeId: string, level: TrustAttestation['level']): Promise<void>;
  revokeTrust(trusteeId: string): Promise<void>;

  // Events
  subscribe(callback: (trust: TrustAttestation[]) => void): () => void;
}
```

### UserDocumentService

```typescript
interface UserDocument {
  id: string;
  ownerId: string;
  profile: { displayName: string; avatarUrl?: string };
  workspaces: WorkspaceRef[];
  // Trust lebt jetzt in TrustService
}

interface UserDocumentService {
  get(): UserDocument | null;
  isLoaded(): boolean;

  updateProfile(changes: Partial<UserDocument['profile']>): Promise<void>;
  addWorkspace(ref: WorkspaceRef): Promise<void>;
  removeWorkspace(workspaceId: string): Promise<void>;

  subscribe(callback: (doc: UserDocument | null) => void): () => void;
}
```

### WorkspaceService

```typescript
interface Workspace {
  id: string;
  name: string;
  avatarUrl?: string;
  members: Record<string, { displayName: string; role: 'admin' | 'member' }>;
  enabledModules: string[];
}

interface WorkspaceService {
  get(): Workspace | null;
  isLoaded(): boolean;

  updateMetadata(changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>): Promise<void>;
  setEnabledModules(moduleIds: string[]): Promise<void>;

  // Member-Management
  getMember(identityId: string): Workspace['members'][string] | null;
  updateMember(identityId: string, changes: Partial<Workspace['members'][string]>): Promise<void>;

  subscribe(callback: (workspace: Workspace | null) => void): () => void;
}
```

### DataProvider (kombiniert alles)

```typescript
interface DataProvider {
  // Services
  readonly items: ItemStore;
  readonly relations: RelationStore;
  readonly identity: IdentityProvider;
  readonly trust: TrustService;
  readonly userDoc: UserDocumentService;
  readonly workspace: WorkspaceService;

  // Meta
  readonly capabilities: {
    offline: boolean;
    realtime: boolean;
    signatureVerification: boolean;
  };
  readonly syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  onSyncStatusChange(callback: (status: DataProvider['syncStatus']) => void): () => void;
}
```

---

## Implementierungs-Phasen

### Phase 1: Interfaces definieren

**Neue Dateien:**
- `lib/src/data/types.ts` - Alle Interfaces (Item, ItemStore, etc.)
- `lib/src/data/DataProvider.tsx` - React Context für DataProvider

**Keine Änderungen an bestehendem Code.**

### Phase 2: Automerge-Adapter extrahieren

**Ziel:** Bestehenden Code hinter neue Interfaces verschieben, ohne Funktionalität zu ändern.

**Neue Dateien:**
```
lib/src/data/adapters/automerge/
  ├── AutomergeDataProvider.ts
  ├── AutomergeItemStore.ts
  ├── AutomergeIdentityProvider.ts
  ├── AutomergeTrustService.ts
  ├── AutomergeUserDocService.ts
  ├── AutomergeWorkspaceService.ts
  └── index.ts
```

**Mapping (alt → neu):**
| Alter Code | Neuer Adapter |
|------------|---------------|
| `useOpinionGraph` mutations | `AutomergeItemStore` |
| `lib/src/utils/did.ts` | `AutomergeIdentityProvider` |
| `UserDocument.trustGiven/Received` | `AutomergeTrustService` |
| `useUserDocument` | `AutomergeUserDocService` |
| `AppShell` workspace logic | `AutomergeWorkspaceService` |

**Schema-Migration:**
- `Assumption` → `Item` mit `type: 'assumption'`
- `Vote` → `Item.extensions.narrative.votes`
- Bestehende Daten müssen migriert werden (Versionsfeld nutzen)

### Phase 3: React Hooks refactoren

**Neue Hooks:**
```typescript
// lib/src/data/hooks.ts
export function useDataProvider(): DataProvider;
export function useItems(filter?: ItemFilter): { items: Item[]; isLoading: boolean };
export function useItem(id: string): { item: Item | null; isLoading: boolean };
export function useIdentity(): { identity: Identity | null; ... };
export function useTrust(): { trustGiven: TrustAttestation[]; ... };
export function useWorkspace(): { workspace: Workspace | null; ... };
export function useUserDoc(): { userDoc: UserDocument | null; ... };
```

**AppShell refactoren:**
- Erhält `DataProvider` als Prop (oder Factory-Funktion)
- Entfernt direkte Automerge-Abhängigkeiten
- Delegiert an DataProvider-Services

### Phase 4: Module auf generische Items umstellen

**Narrative-Modul:**
```typescript
// Alt
const { assumptions, createAssumption, setVote } = useOpinionGraph(...);

// Neu
const { items } = useItems({ type: 'assumption' });
const { create, update } = useItemMutations();

const createAssumption = (sentence: string, tags: string[]) => {
  create({
    type: 'assumption',
    title: sentence,
    tags,
    extensions: { narrative: { votes: [], editLog: [] } }
  });
};
```

**Map-Modul:**
```typescript
// Zeigt ALLE Items mit geo, unabhängig vom Typ
const { items } = useItems({ hasGeo: true });
```

**Kalender-Modul:**
```typescript
// Zeigt ALLE Items mit dateTime
const { items } = useItems({ hasDateTime: true });
```

### Phase 5: REST-Adapter implementieren

**Neue Dateien:**
```
lib/src/data/adapters/rest/
  ├── RestDataProvider.ts
  ├── RestItemStore.ts
  ├── RestIdentityProvider.ts
  ├── RestTrustService.ts
  ├── RestUserDocService.ts
  ├── RestWorkspaceService.ts
  └── index.ts
```

**Eigenschaften:**
- Last-Write-Wins
- Online-only (kein Offline-Support)
- Polling oder WebSocket für Updates

**Einfacher Test-Server:**
- Express/Fastify mit In-Memory-Storage
- Später: echte Datenbank

### Phase 6: Yjs-Adapter implementieren

**Neue Dateien:**
```
lib/src/data/adapters/yjs/
  ├── YjsDataProvider.ts
  ├── YjsItemStore.ts
  └── ...
```

**Vergleich mit Automerge:**
- Andere CRDT-Semantik
- y-websocket für Sync
- IndexedDB für Persistence

### Phase 7: Tests & Dokumentation

**Mock-Adapter für Tests:**
```
lib/src/data/adapters/mock/
  ├── MockDataProvider.ts
  └── ...
```

**Tests:**
- Unit-Tests pro Service
- Integration-Tests pro Adapter
- E2E-Tests mit Adapter-Switching

---

## Kritische Dateien

| Phase | Datei | Aktion |
|-------|-------|--------|
| 1 | `lib/src/data/types.ts` | Neu |
| 1 | `lib/src/data/DataProvider.tsx` | Neu |
| 2 | `lib/src/data/adapters/automerge/*` | Neu (extrahiert aus bestehendem Code) |
| 2 | `lib/src/schema/index.ts` | Refactor → Item-Schema |
| 3 | `lib/src/data/hooks.ts` | Neu |
| 3 | `lib/src/components/AppShell.tsx` | Refactor |
| 4 | `lib/src/hooks/useOpinionGraph.ts` | Deprecated → useItems |
| 4 | `narrative-app/src/components/*` | Refactor auf Items |
| 5 | `lib/src/data/adapters/rest/*` | Neu |
| 6 | `lib/src/data/adapters/yjs/*` | Neu |

---

## Entschiedene Design-Fragen

1. **Item-Relationen**: ✅ Subject-Predicate-Object Tripel (RelationStore)

2. **Sharing**: ✅ Items können mit Workspaces UND einzelnen Identities geteilt werden

3. **Permissions**: ✅ Item-Level (read/write/admin pro ShareTarget)

## Offene Design-Fragen (für später)

1. **Schema-Validierung**: Wer validiert `extensions`? Module selbst?

2. **Relation-Permissions**: Wer darf Relations auf ein Item erstellen? Nur Owner oder alle mit write-Permission?

3. **Cascading Deletes**: Wenn ein Item gelöscht wird, was passiert mit Relations?

---

## Nächster Schritt

Phase 1 starten: `lib/src/data/types.ts` mit allen Interfaces erstellen.
