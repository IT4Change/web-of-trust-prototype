# Dokumentenstruktur Option A: Items im gleichen Dokument

## Übersicht

Diese Dokumentation beschreibt die Automerge-Dokumentenstruktur nach der Migration auf den Data Layer.

**Prinzip:** Die Anzahl der Dokumente bleibt gleich - wir erweitern nur die interne Struktur.

---

## Dokument 1: UserDocument (Pro User)

**Speicherort:** localStorage (`narrative_user_doc_id`) + Automerge Sync
**Erstellt:** Beim ersten Sign-Up eines Users

```typescript
interface UserDocument {
  // Metadata
  version: string;              // "1.0.0"
  lastModified: number;         // Unix timestamp
  did: string;                  // "did:key:z6Mk..."

  // Profil
  profile: {
    displayName: string;
    avatarUrl?: string;
    signature?: string;         // JWS für Authentizität
  };

  // Trust (Web of Trust)
  trustGiven: Record<string, TrustAttestation>;     // Key = trusteeDid
  trustReceived: Record<string, TrustAttestation>;  // Key = trusterDid

  // Vouchers (DANK Tokens)
  vouchers: Record<string, Voucher>;

  // Workspaces (Referenzen)
  workspaces: Record<string, WorkspaceRef>;
}

// Trust Attestation Format
interface TrustAttestation {
  id: string;
  trusterDid: string;           // Wer vertraut
  trusteeDid: string;           // Wem wird vertraut
  level: 'verified' | 'endorsed';
  createdAt: number;
  updatedAt: number;
  signature?: string;           // JWS
  trusterUserDocUrl?: string;   // Für bidirektionalen Trust
  trusteeUserDocUrl?: string;
}

// Workspace Referenz
interface WorkspaceRef {
  docId: string;                // Automerge URL
  name: string;                 // Gecached für Offline
  avatar?: string;
  addedAt: number;
  lastAccessedAt?: number;
}
```

**DataProvider Mapping:**
- `IdentityProvider` → localStorage (Keypair) + `profile`
- `TrustService` → `trustGiven` + `trustReceived`
- `UserDocumentService` → gesamtes Dokument

---

## Dokument 2: WorkspaceDocument (Pro Workspace)

**Speicherort:** URL-Hash (`#doc=automerge:...`) + localStorage (`{app}_docId`) + Automerge Sync
**Erstellt:** Beim Erstellen eines neuen Workspace/Board

### Aktuelle Struktur (Legacy)

```typescript
interface OpinionGraphDoc {
  // Metadata
  version: string;
  lastModified: number;
  context?: { name: string; avatar?: string };
  enabledModules?: Record<string, boolean>;

  // Identities (workspace-lokal)
  identities: Record<string, IdentityProfile>;

  // App-spezifische Daten
  data: {
    assumptions: Record<string, Assumption>;
    votes: Record<string, Vote>;
    tags: Record<string, Tag>;
    edits: Record<string, EditEntry>;
  };
}
```

### Neue Struktur (nach Migration)

```typescript
interface WorkspaceDocument {
  // Metadata (unverändert)
  version: string;
  lastModified: number;
  context?: { name: string; avatar?: string };
  enabledModules?: Record<string, boolean>;

  // Identities (unverändert)
  identities: Record<string, IdentityProfile>;
  identityLookup?: Record<string, IdentityLookupEntry>;

  // =========================================
  // NEU: Generische Items & Relations
  // =========================================
  items: Record<string, Item>;
  relations: Record<string, Relation>;

  // =========================================
  // LEGACY: App-spezifische Daten (optional für Rückwärtskompatibilität)
  // =========================================
  data?: {
    assumptions?: Record<string, Assumption>;
    votes?: Record<string, Vote>;
    tags?: Record<string, Tag>;
    edits?: Record<string, EditEntry>;
  };
}
```

**DataProvider Mapping:**
- `WorkspaceService` → `context`, `enabledModules`, `identities`
- `ItemStore` → `items`
- `RelationStore` → `relations`

---

## Item-Struktur (generisch)

```typescript
interface Item {
  // Core
  id: string;                   // "item-1234567890-abc123"
  type: string;                 // "assumption" | "offer" | "event" | ...
  createdBy: string;            // DID
  createdAt: number;
  updatedAt: number;

  // Gemeinsame optionale Felder
  title?: string;               // Bei Assumption: sentence
  description?: string;
  geo?: Feature;                // GeoJSON
  dateTime?: { start: number; end?: number; allDay?: boolean };
  tags?: string[];              // Tag-Namen oder IDs

  // Sharing
  sharing: {
    visibility: 'private' | 'shared' | 'public';
    sharedWith: ShareTarget[];
  };

  // Modul-spezifische Erweiterungen
  extensions: {
    [moduleId: string]: unknown;
  };
}
```

---

## Relation-Struktur (für Votes, Parent-Child, etc.)

```typescript
interface Relation {
  id: string;                   // "rel-1234567890-abc123"
  subject: string;              // Item-ID oder DID
  predicate: string;            // "votes_on" | "parent_of" | "tagged_with"
  object: string;               // Item-ID oder DID
  createdBy: string;            // DID
  createdAt: number;

  // Zusätzliche Daten
  metadata?: Record<string, unknown>;
}
```

---

## Migration: Assumption → Item + Relations

### Vorher (Legacy)

```typescript
// Assumption
{
  id: "a-123",
  sentence: "Die Erde ist rund",
  createdBy: "did:key:z6Mk...",
  tagIds: ["tag-1", "tag-2"],
  voteIds: ["v-1", "v-2"],
  ...
}

// Vote
{
  id: "v-1",
  assumptionId: "a-123",
  voterDid: "did:key:z6Mk...",
  value: "green",
  ...
}

// Tag
{
  id: "tag-1",
  name: "Wissenschaft",
  ...
}
```

### Nachher (mit Items & Relations)

```typescript
// Item (Assumption)
{
  id: "item-123",
  type: "assumption",
  title: "Die Erde ist rund",
  createdBy: "did:key:z6Mk...",
  tags: ["Wissenschaft", "Geographie"],  // Direkt als String-Array
  extensions: {
    narrative: {
      // App-spezifische Daten hier
      editLogIds: ["edit-1", "edit-2"]
    }
  }
}

// Relation (Vote)
{
  id: "rel-v1",
  subject: "did:key:z6Mk...",     // Wer voted
  predicate: "votes_on",
  object: "item-123",             // Worauf
  metadata: { value: "green" }
}
```

---

## Vorteile von Option A

1. **Ein Dokument = Ein Sync**
   - Alle Workspace-Daten werden gemeinsam synchronisiert
   - Einfaches Offline-Handling

2. **Einfache Berechtigungen**
   - Wer Zugang zum Workspace-Dokument hat, hat Zugang zu allem
   - Keine komplexe Dokumenten-Verknüpfung

3. **Rückwärtskompatibilität**
   - Legacy `data` Feld kann beibehalten werden
   - Schrittweise Migration möglich

4. **Cross-Modul-Queries**
   - Map-Modul kann alle Items mit `geo` anzeigen
   - Kalender-Modul kann alle Items mit `dateTime` anzeigen

---

## Migrations-Strategie

### Phase 1: Dual-Write (Rückwärtskompatibel)

```typescript
// Beim Erstellen einer Assumption
async function createAssumption(sentence: string) {
  // Schreibe in BEIDE Strukturen
  const item = await itemStore.create({
    type: 'assumption',
    title: sentence,
    ...
  });

  // Legacy-Format parallel pflegen
  docHandle.change(d => {
    d.data.assumptions[item.id] = mapToLegacyAssumption(item);
  });
}
```

### Phase 2: Read from Items

```typescript
// Lese aus Items, schreibe in beide
const assumptions = useItems({ type: 'assumption' });
```

### Phase 3: Remove Legacy

```typescript
// Legacy-Felder entfernen wenn alle Clients migriert
```

---

## Dokument-Größen-Überlegungen

| Daten | Geschätzte Größe pro Eintrag | Max empfohlen |
|-------|------------------------------|---------------|
| Item | ~500 Bytes | 10.000 Items |
| Relation | ~200 Bytes | 50.000 Relations |
| Identity | ~300 Bytes | 1.000 Members |

Bei ~10.000 Items + 50.000 Relations: ~15 MB Dokumentgröße

**Für größere Workspaces:** Option B (separate Dokumente) erwägen.
