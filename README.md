# Narrative

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Data Model (CRDT)](#data-model-crdt)
5. [Identity System (DIDs)](#identity-system-dids)
6. [Key Management](#key-management)
7. [Cryptographic Signatures (JWS)](#cryptographic-signatures-jws)
8. [Sync & Collaboration](#sync--collaboration)
9. [Component Architecture](#component-architecture)
10. [Data Flow](#data-flow)
11. [Security Considerations](#security-considerations)
12. [Performance Optimizations](#performance-optimizations)

---

## Overview

**Narrative** is a local-first, collaborative assumption tracking application where users can:
- Create single-sentence assumptions
- Tag assumptions with free-form labels
- Vote on assumptions (🟢 agree / 🟡 neutral / 🔴 disagree)
- View edit history and activity logs

**Key Features:**
- **Offline-first**: Works without internet connection
- **Real-time collaboration**: Changes sync automatically across devices/users
- **Cryptographic verification**: All entities are signed with Ed25519 signatures
- **Decentralized identity**: Uses did:key for user identification
- **Conflict-free**: Built on Automerge CRDTs for automatic conflict resolution

---

## Tech Stack

### Core Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Frontend** | React | 18.3.0 | UI framework |
| **Build Tool** | Vite | 5.4.0 | Development server & bundler |
| **Language** | TypeScript | 5.6.0 | Type-safe development |
| **Styling** | Tailwind CSS | 3.4.0 | Utility-first CSS |
| **UI Components** | DaisyUI | 4.12.0 | Tailwind component library |

### CRDT & Sync Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `@automerge/automerge` | 2.2.8 | Core CRDT engine |
| `@automerge/automerge-repo` | 1.2.1 | Document management & sync orchestration |
| `@automerge/automerge-repo-react-hooks` | 1.2.1 | React integration hooks |
| `@automerge/automerge-repo-storage-indexeddb` | 1.2.1 | Browser-local persistence |
| `@automerge/automerge-repo-network-websocket` | 1.2.1 | WebSocket-based peer sync |

### Cryptography

| Library | Purpose |
|---------|---------|
| **Web Crypto API** | Ed25519 signing/verification (native browser API) |
| `multiformats` | Multicodec/multibase encoding for DIDs |

### Testing

| Library | Version | Purpose |
|---------|---------|---------|
| Vitest | 2.0.0 | Unit testing (library) |
| Testing Library | Latest | React component testing (app) |

---

## Architecture Overview

### Monorepo Structure

```
narrative/
├── app/              # React frontend application
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── App.tsx            # Automerge Repo setup
│   │   ├── NarrativeApp.tsx   # Document & identity management
│   │   ├── components/        # UI components
│   │   ├── utils/             # DID generation
│   │   └── debug.ts           # Debug utilities
│   └── package.json
│
├── lib/              # Shared library (narrative-ui)
│   ├── src/
│   │   ├── schema/            # TypeScript types & CRDT structure
│   │   ├── hooks/             # useOpinionGraph hook (CRUD operations)
│   │   ├── utils/             # Signature & DID utilities
│   │   └── __tests__/         # Unit tests
│   └── package.json
│
└── package.json      # Workspace root
```

### Layer Separation

```
┌─────────────────────────────────────────────────┐
│          UI Components (React)                  │
│  AssumptionCard, VoteBar, CreateModal, etc.    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│     Business Logic (useOpinionGraph Hook)       │
│  createAssumption, setVote, updateIdentity     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│        CRDT Layer (Automerge Repo)              │
│   Document mutations, change tracking          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│    Storage & Sync (IndexedDB + WebSocket)      │
│   Local persistence, remote synchronization    │
└─────────────────────────────────────────────────┘
```

---

## Data Model (CRDT)

### Document Structure

The root CRDT document type is `OpinionGraphDoc`:

```typescript
interface OpinionGraphDoc {
  // User identity (DEPRECATED - use identities map)
  identity?: UserIdentity;

  // Per-user identity profiles (display names, public keys)
  identities: Record<string, IdentityProfile>;

  // DID of board creator (for UI display)
  createdBy?: string;

  // Normalized collections (by ID)
  assumptions: Record<string, Assumption>;
  votes: Record<string, Vote>;
  tags: Record<string, Tag>;
  edits: Record<string, EditEntry>;

  // Metadata
  version: string;
  lastModified: number;
}
```

### Entity Types

#### Assumption
```typescript
interface Assumption {
  id: string;
  sentence: string;
  createdBy: string;        // DID of creator
  createdAt: number;
  updatedAt: number;
  tagIds: string[];         // Foreign keys to tags
  voteIds: string[];        // Foreign keys to votes
  editLogIds: string[];     // Foreign keys to edit history
  signature?: string;       // JWS signature (Phase 2)
  publicKey?: string;       // DEPRECATED (use identities map)
}
```

#### Vote
```typescript
interface Vote {
  id: string;
  assumptionId: string;     // Foreign key
  voterDid: string;         // DID of voter
  value: VoteValue;         // 'green' | 'yellow' | 'red'
  createdAt: number;
  updatedAt: number;
  signature?: string;       // JWS signature (Phase 2)
}
```

**Constraint**: One vote per user per assumption (enforced in `useOpinionGraph.setVote()`)

#### Tag
```typescript
interface Tag {
  id: string;
  name: string;
  color?: string;
  createdBy: string;        // DID of creator
  createdAt: number;
  signature?: string;       // JWS signature (Phase 2)
}
```

#### EditEntry
```typescript
interface EditEntry {
  id: string;
  assumptionId: string;
  editorDid: string;        // DID of editor
  type: 'create' | 'edit';
  previousSentence: string;
  newSentence: string;
  previousTags?: string[];
  newTags?: string[];
  createdAt: number;
  signature?: string;       // JWS signature (Phase 2)
}
```

#### IdentityProfile
```typescript
interface IdentityProfile {
  displayName?: string;     // User's chosen display name
  avatarUrl?: string;       // Future: avatar URL
  publicKey?: string;       // Base64-encoded Ed25519 public key (32 bytes)
}
```

### CRDT Mutation Patterns

**Critical Rule**: All mutations must happen inside `docHandle.change()` callbacks:

```typescript
// ✅ CORRECT: Direct mutation inside change callback
docHandle.change((d) => {
  d.assumptions[id] = newAssumption;
  d.assumptions[id].sentence = "Updated text";
  d.assumptions[id].tagIds.push(tagId);
});

// ❌ WRONG: Immutable-style updates
doc = {...doc, field: newValue};  // Breaks CRDT tracking!

// ❌ WRONG: Array replacement
assumption.tagIds = newTagIds;    // Loses concurrent edits!
```

**Array Operations**: Use granular operations to preserve concurrent changes:
```typescript
// Add tags
newTagIds.filter(id => !assumption.tagIds.includes(id))
         .forEach(id => assumption.tagIds.push(id));

// Remove tags
oldTagIds.forEach(id => {
  const idx = assumption.tagIds.indexOf(id);
  if (idx !== -1) assumption.tagIds.splice(idx, 1);
});
```

### Normalization Strategy

**Fully Normalized**: All entities stored in flat maps by ID, referenced via foreign keys.

**Benefits:**
- O(1) lookups
- No data duplication
- Clear ownership boundaries
- Easier conflict resolution

**Display Name Resolution**: Names are looked up dynamically from `doc.identities[did].displayName` at render time (not stored in entities). This allows instant name updates without expensive propagation.

---

## Identity System (DIDs)

### DID Format

Narrative uses **did:key** with **Ed25519** keypairs:

```
did:key:z6Mk<base58btc-encoded-public-key>
```

Example:
```
did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH
```

### DID Generation Process

**Implementation**: [app/src/utils/did.ts](app/src/utils/did.ts)

```typescript
async function generateDid(): Promise<UserIdentity> {
  // 1. Generate Ed25519 keypair via Web Crypto API
  const keypair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,  // extractable
    ['sign', 'verify']
  );

  // 2. Export keys
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keypair.publicKey);
  const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keypair.privateKey);

  // 3. Create DID from public key
  const publicKeyBytes = new Uint8Array(publicKeyRaw);
  const multicodecBytes = new Uint8Array([0xed, 0x01, ...publicKeyBytes]);
  const did = 'did:key:' + base58btc.encode(multicodecBytes);

  return {
    did,
    privateKey: base64Encode(new Uint8Array(privateKeyPkcs8)),
    publicKey: base64Encode(publicKeyBytes),
    displayName: generateUsername(),  // Random "adjective-noun" format
  };
}
```

### DID Derivation & Verification

- **Derivation**: Public key → Multicodec prefix (0xed01) → Base58btc encoding
- **Verification**: DID → Base58btc decode → Extract public key → Verify signature

**No Central Registry**: DIDs are self-certifying - the public key is embedded in the DID itself.

---

## Key Management

### Storage

**localStorage** is used to persist identity across sessions:

```typescript
interface StoredIdentity {
  did: string;              // did:key:z6Mk...
  privateKey: string;       // Base64-encoded PKCS#8 (private key)
  publicKey: string;        // Base64-encoded raw bytes (32 bytes)
  displayName?: string;     // User's chosen name
}
```

**Storage Key**: `narrativeIdentity`

### Lifecycle

```
┌─────────────────────────────────────────────────┐
│  First Visit: No identity in localStorage      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Generate Ed25519 keypair via Web Crypto       │
│  Create DID from public key                    │
│  Generate random display name                  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Store in localStorage:                        │
│  - DID                                         │
│  - Private key (Base64)                        │
│  - Public key (Base64)                         │
│  - Display name                                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Subsequent Visits: Load identity from storage │
└─────────────────────────────────────────────────┘
```

### Security Model

**Threat Model:**
- ✅ **Protected against**: Tampering of other users' data (verified via signatures)
- ✅ **Protected against**: Replay attacks (timestamps in signed data)
- ❌ **NOT protected against**: Malicious JavaScript with localStorage access
- ❌ **NOT protected against**: XSS attacks that can read private keys

**Trade-off**: Usability (no password, instant start) vs Security (keys in localStorage)

**Future Improvements:**
- Web Crypto API non-extractable keys (requires browser support for DID operations)
- Hardware security modules (HSM)
- Key export/import for multi-device support

### Public Key Distribution

Public keys are stored in `doc.identities[did].publicKey` when a user first interacts with a document:

```typescript
function ensureIdentityProfile(d: OpinionGraphDoc) {
  if (!d.identities[currentUserDid]) {
    d.identities[currentUserDid] = {};
  }
  if (publicKey && !d.identities[currentUserDid].publicKey) {
    d.identities[currentUserDid].publicKey = publicKey;
  }
}
```

This ensures all peers can verify each other's signatures.

---

## Cryptographic Signatures (JWS)

### JWS Format (RFC 7515)

All entities are signed using **JWS Compact Serialization**:

```
<base64url(header)>.<base64url(payload)>.<base64url(signature)>
```

Example:
```
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMy...<truncated>
```

**Header:**
```json
{
  "alg": "EdDSA",  // Ed25519
  "typ": "JWT"
}
```

**Payload**: The entity data (excluding `signature`, `publicKey`, and mutable name fields)

**Signature**: Ed25519 signature over `base64url(header).base64url(payload)`

### Signing Process

**Implementation**: [lib/src/utils/signature.ts](lib/src/utils/signature.ts)

```typescript
async function signEntity(entity: Record<string, unknown>, privateKey: string) {
  // 1. Exclude metadata and mutable fields
  const { signature, publicKey, voterName, creatorName, editorName, ...payload } = entity;

  // 2. Create JWS header
  const header = { alg: 'EdDSA', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));

  // 3. Sign with Ed25519
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKeyObj = await importPrivateKey(base64Decode(privateKey));
  const signatureBuffer = await crypto.subtle.sign(
    'Ed25519',
    privateKeyObj,
    new TextEncoder().encode(signingInput)
  );

  // 4. Return JWS compact serialization
  const encodedSignature = base64urlEncode(new Uint8Array(signatureBuffer));
  return `${signingInput}.${encodedSignature}`;
}
```

### Verification Process

```typescript
async function verifyEntitySignature(entity: Record<string, unknown>, publicKey: string) {
  // 1. Exclude same fields as signing
  const { signature, publicKey: _, voterName, creatorName, editorName, ...payload } = entity;

  // 2. Verify JWS signature
  const result = await verifyJws(entity.signature, publicKey);
  if (!result.valid) return { valid: false };

  // 3. Verify payload matches (use canonical stringification for determinism)
  const payloadStr = canonicalStringify(payload);
  const decodedPayloadStr = canonicalStringify(result.payload);

  return { valid: payloadStr === decodedPayloadStr };
}
```

### Canonical JSON Serialization

**Problem**: `JSON.stringify()` doesn't guarantee key ordering, causing signature mismatches across browsers.

**Solution**: Alphabetically sort object keys recursively:

```typescript
function canonicalStringify(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';

  // Sort keys alphabetically
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key =>
    JSON.stringify(key) + ':' + canonicalStringify(obj[key])
  );
  return '{' + pairs.join(',') + '}';
}
```

### Excluded Fields from Signatures

**Metadata** (not part of semantic data):
- `signature` - The signature itself
- `publicKey` - Redundant with DID

**Mutable fields** (can change without invalidating entity):
- `voterName`, `creatorName`, `editorName` - Display names (looked up dynamically from `identities`)

**Rationale**: Users can change their display name without invalidating all past signatures. The DID remains immutable and is the source of truth.

### Signature Workflow

```
┌────────────────────────────────────────────────────┐
│  User creates assumption/vote/edit                 │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  Build entity object (without signature)           │
│  {id, sentence, createdBy: did, createdAt, ...}   │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  Sign entity with user's private key               │
│  signature = signEntity(entity, privateKey)        │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  Add signature to entity                           │
│  entity.signature = signature                      │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  Store in CRDT (triggers sync to other peers)      │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  Other peers verify signature on display           │
│  Show ✓ (valid) or ✗ (invalid) indicator          │
└────────────────────────────────────────────────────┘
```

### UI Verification Indicators

Each entity displays a signature verification badge:
- **✓ (green)**: Signature valid, public key found, payload matches
- **✗ (red)**: Signature invalid or payload tampered
- **No indicator**: No signature present (old data or unsigned)

---

## Sync & Collaboration

### Automerge CRDT Engine

**Conflict-Free Replicated Data Type (CRDT)**: Data structure that guarantees eventual consistency without coordination.

**Key Properties:**
- **Commutative**: Operations can be applied in any order
- **Associative**: Grouping doesn't matter
- **Idempotent**: Applying same operation twice = applying once

**Example**: Two users concurrently add different tags to the same assumption:
```
User A: assumption.tagIds.push("politics")
User B: assumption.tagIds.push("economics")

Result: assumption.tagIds = ["politics", "economics"]
```
No conflict - both tags are preserved.

### Automerge Repo Architecture

```
┌─────────────────────────────────────────────────┐
│           Automerge Repo (Singleton)            │
│  - Document management                          │
│  - Change batching                              │
│  - Sync orchestration                           │
└─────────────────────────────────────────────────┘
          ↓                    ↓
┌──────────────────┐  ┌──────────────────────┐
│  Storage Adapter │  │  Network Adapter(s)  │
│  (IndexedDB)     │  │  (WebSocket)         │
└──────────────────┘  └──────────────────────┘
```

**Setup**: [app/src/App.tsx](app/src/App.tsx)

```typescript
const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [
    new BrowserWebSocketClientAdapter('wss://sync.automerge.org'),
  ],
});
```

### Storage: IndexedDB

**Purpose**: Local persistence of CRDT documents

**Schema:**
```
Database: automerge-repo
  ObjectStore: chunks
    Key: [docId, chunkId]
    Value: Uint8Array (compressed CRDT changes)
```

**Benefits:**
- Survives browser restarts
- Large storage capacity (GBs)
- Asynchronous API (doesn't block UI)

### Network: WebSocket Sync

**Server**: `wss://sync.automerge.org` (Automerge's public sync server)

**Protocol**:
1. Client connects via WebSocket
2. Client announces known document IDs
3. Server responds with missing changes
4. Bi-directional streaming of changes

**Sync Process:**
```
Client A                    Server                  Client B
   │                          │                         │
   ├─── Connect ──────────────>│                         │
   │<── Connected ─────────────┤                         │
   │                          │<─── Connect ────────────┤
   │                          ├─── Connected ───────────>│
   │                          │                         │
   ├─── Announce doc:123 ─────>│                         │
   │                          ├─── Sync doc:123 ────────>│
   │<── Changes ───────────────┤                         │
   │                          │<── Changes ──────────────┤
   │                          ├─── Forward ─────────────>│
   │<── Forward ───────────────┤                         │
```

**Conflict Resolution**: Automatic via Automerge CRDT. No manual intervention needed.

### Document Sharing Model

**Document ID**: Stored in URL hash (`#doc=<automerge-url>`)

Example URL:
```
https://narrative.app/#doc=automerge:2wMvz6RKEhPZgGRJVDw8AwQx
```

**Sharing Flow:**
1. User A creates document → receives `documentId`
2. User A shares URL with User B
3. User B opens URL → extracts `documentId` from hash
4. User B's client connects to sync server
5. Sync server transmits document from A → B
6. Both users now collaborate on same document

**Privacy**: Anyone with the document URL can access it. No authentication on sync server.

### Network Adapter Constraints

**BroadcastChannel Incompatibility**: `BroadcastChannelNetworkAdapter` was found to interfere with cross-browser WebSocket sync. When a document created in Browser A is loaded in Browser B, BroadcastChannel can prevent proper sync from the WebSocket server.

**Recommendation**: Use **only** `BrowserWebSocketClientAdapter` for reliable cross-browser collaboration.

---

## Component Architecture

### Component Hierarchy

```
App (Automerge Repo setup)
 └─ NarrativeApp (Document & identity management)
     ├─ MainView (Opinion board UI)
     │   ├─ AssumptionCard (Single assumption)
     │   │   ├─ VoteBar (Visual vote distribution)
     │   │   ├─ SignatureIndicator (✓/✗ badge)
     │   │   └─ EditModal
     │   └─ CreateAssumptionModal
     └─ UserProfile (Identity management)
```

### Key Components

#### App.tsx
- **Purpose**: Automerge Repo initialization
- **Responsibilities**:
  - Configure IndexedDB storage
  - Configure WebSocket sync
  - Provide `RepoContext` to React tree

#### NarrativeApp.tsx
- **Purpose**: Document and identity lifecycle
- **Responsibilities**:
  - Load or create identity from localStorage
  - Load or create document from URL hash
  - Handle document switching (hash change events)
  - Provide reset/new board functions

#### MainView.tsx
- **Purpose**: Main opinion board interface
- **Responsibilities**:
  - Initialize `useOpinionGraph` hook
  - Render list of assumptions
  - Handle tag filtering
  - Coordinate modal dialogs

#### AssumptionCard.tsx
- **Purpose**: Display single assumption with votes/activity
- **Responsibilities**:
  - Show vote summary (VoteBar)
  - Show vote buttons (🟢🟡🔴)
  - Show activity log (votes + edits)
  - Verify signatures and display indicators
  - Handle edit modal

#### VoteBar.tsx
- **Purpose**: Visual vote distribution
- **Responsibilities**:
  - Render colored bar chart (green/yellow/red)
  - Show tooltips with voter names (dynamic lookup from `doc.identities`)

### useOpinionGraph Hook

**Location**: [lib/src/hooks/useOpinionGraph.ts](lib/src/hooks/useOpinionGraph.ts)

**Purpose**: Central business logic for all CRUD operations

**API:**
```typescript
const narrative = useOpinionGraph(
  docId,           // Automerge document ID
  docHandle,       // Document handle
  currentUserDid,  // Current user's DID
  privateKey?,     // For signing (optional)
  publicKey?,      // For identity profile (optional)
  displayName?     // For identity profile (optional)
);

// Mutations (async for signing)
await narrative.createAssumption(sentence, tagNames);
await narrative.setVote(assumptionId, 'green');
narrative.updateAssumption(id, newSentence, tagNames);
narrative.deleteAssumption(id);
narrative.removeVote(assumptionId);
narrative.updateIdentity({ displayName: 'New Name' });
narrative.createTag(name, color);

// Queries
narrative.getVoteSummary(assumptionId, currentUserDid);
narrative.getVotesForAssumption(assumptionId);
narrative.getEditsForAssumption(assumptionId);
```

**Signing Integration:**
```typescript
const createAssumption = async (sentence: string, tagNames: string[]) => {
  // Step 1: Pre-create tags to get IDs
  docHandle.change((d) => {
    tagNames.forEach(name => findOrCreateTag(d, name));
  });

  // Step 2: Build entity with complete data
  const assumptionData = { id, sentence, createdBy, tagIds, ... };

  // Step 3: Sign entity (if privateKey available)
  if (privateKey) {
    assumptionData.signature = await signEntity(assumptionData, privateKey);
  }

  // Step 4: Store signed entity (no modification after signing!)
  docHandle.change((d) => {
    d.assumptions[id] = assumptionData;
  });
};
```

---

## Data Flow

### Write Path (Creating Assumption)

```
┌────────────────────────────────────────────────────┐
│  User types sentence, selects tags                 │
│  Clicks "Create"                                   │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  CreateAssumptionModal.onSubmit()                  │
│  → calls narrative.createAssumption()              │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  useOpinionGraph.createAssumption()                │
│  1. Pre-create tags in CRDT (get IDs)             │
│  2. Build assumption object                        │
│  3. Sign with private key                          │
│  4. Store in CRDT                                  │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  docHandle.change() triggers Automerge             │
│  - Updates local doc                               │
│  - Persists to IndexedDB                           │
│  - Broadcasts to WebSocket                         │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  useDocument() hook re-renders components          │
│  - MainView sees new assumption                    │
│  - AssumptionCard renders with signature ✓         │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  WebSocket sends changes to other peers            │
│  - Sync server forwards to connected clients       │
│  - Other clients merge changes automatically       │
└────────────────────────────────────────────────────┘
```

### Read Path (Display Assumption)

```
┌────────────────────────────────────────────────────┐
│  useDocument(docId) subscribes to doc changes      │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  doc.assumptions → Array of assumptions            │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  MainView.map(assumption => <AssumptionCard>)      │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  AssumptionCard resolves:                          │
│  - Tags: doc.tags[assumption.tagIds[i]]           │
│  - Votes: doc.votes[assumption.voteIds[i]]        │
│  - Edits: doc.edits[assumption.editLogIds[i]]     │
│  - Names: doc.identities[did].displayName         │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  SignatureIndicator verifies signature:            │
│  1. Get public key from doc.identities[createdBy]  │
│  2. Verify JWS signature                           │
│  3. Display ✓ (valid) or ✗ (invalid)              │
└────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Threat Model

| Threat | Mitigation | Status |
|--------|-----------|--------|
| **Data Tampering** | Ed25519 signatures verify all entities | ✅ Mitigated |
| **Replay Attacks** | Timestamps in signed data | ✅ Mitigated |
| **Identity Spoofing** | DIDs derived from public keys (self-certifying) | ✅ Mitigated |
| **XSS (Private Key Theft)** | Private keys in localStorage are vulnerable | ⚠️ Trade-off for UX |
| **Man-in-the-Middle** | WebSocket uses TLS (wss://) | ✅ Mitigated |
| **Malicious Sync Server** | Can drop/delay messages, but can't forge signatures | ⚠️ Partial mitigation |
| **Document URL Leak** | Anyone with URL can access document | ⚠️ By design (no auth) |

### Trust Assumptions

1. **Sync Server**: Assumed to forward messages honestly (but can't forge data)
2. **Browser**: Assumed to execute JavaScript faithfully
3. **Web Crypto API**: Assumed to implement Ed25519 correctly
4. **User Device**: Assumed not compromised (malware could steal keys)

### Privacy Considerations

- **No Server-Side Authentication**: Sync server sees all document IDs and changes
- **URL-Based Sharing**: Document IDs are secret identifiers (security through obscurity)
- **Pseudonymous**: DIDs don't reveal real identity, but are linkable across documents
- **Local Data**: All data stored unencrypted in IndexedDB (accessible to local scripts)

### Recommended Best Practices

1. **Don't share document URLs publicly** - treat like passwords
2. **Use HTTPS** - prevent URL leakage via network eavesdropping
3. **Clear localStorage** if device is shared - prevents identity reuse
4. **Audit signatures** - verify ✓ indicators before trusting data

---

## Performance Optimizations

### Dynamic Name Lookup (Recent Optimization)

**Previous Approach**: Denormalized display names stored in every entity
- ❌ O(n) updates when user changes name (1000s of CRDT mutations)
- ❌ Large document size (redundant names)
- ❌ Propagation delay (names update slowly)

**Current Approach**: Dynamic lookup from `doc.identities[did].displayName`
- ✅ O(1) updates (single CRDT mutation)
- ✅ Smaller documents (~10-20% reduction)
- ✅ Instant updates (no propagation needed)
- ✅ Render performance unchanged (hash map lookups are O(1))

### CRDT Best Practices

1. **Minimal Changes**: Only mutate changed fields, avoid full object replacement
2. **Granular Array Ops**: Use `splice()/push()` instead of array assignment
3. **Avoid Sorting**: Sort on read, append on write (preserves concurrent edits)
4. **Delete vs Undefined**: Use `delete` operator (Automerge doesn't allow `undefined`)

### React Optimizations

1. **useMemo**: Compute derived data (vote summaries, activity logs) only when inputs change
2. **Component Splitting**: Small components re-render less often
3. **Lazy Loading**: Modals/dialogs loaded on-demand

### Indexing Strategy

**Current**: Linear scans through `Object.values(doc.votes)` when filtering

**Future**: Build indexes for common queries:
```typescript
doc.votesByUser[did] = voteIds[];
doc.votesByAssumption[assumptionId] = voteIds[];
```

**Trade-off**: Faster reads vs slower writes (index maintenance)

---

## Future Enhancements

### Planned Features

1. **Encrypted Documents**: End-to-end encryption (keys derived from document URL)
2. **Multi-Device Identity**: Key export/import for same identity across devices
3. **Rich Text**: Markdown support for assumption sentences
4. **Attachments**: Images, links embedded in assumptions
5. **Search**: Full-text search across assumptions
6. **Permissions**: Role-based access control (view-only, editor, admin)
7. **Audit Log**: Immutable log of all document changes
8. **Offline Indicators**: Show which peers are currently online

### Technical Debt

1. **Remove `doc.identity`**: Fully deprecated in favor of `doc.identities` map
2. **UUID v4 IDs**: Replace timestamp-based IDs with proper UUIDs
3. **Signature Versioning**: Support multiple signature algorithms (future-proofing)
4. **Test Coverage**: Increase unit test coverage (currently library-only)
5. **Error Handling**: Graceful degradation when sync fails

---

## Appendix: Key Files Reference

### Core Logic
- [lib/src/schema/index.ts](lib/src/schema/index.ts) - CRDT document types
- [lib/src/hooks/useOpinionGraph.ts](lib/src/hooks/useOpinionGraph.ts) - Business logic hook
- [lib/src/utils/signature.ts](lib/src/utils/signature.ts) - JWS signing/verification
- [lib/src/utils/did.ts](lib/src/utils/did.ts) - DID generation

### React Components
- [app/src/App.tsx](app/src/App.tsx) - Automerge Repo setup
- [app/src/NarrativeApp.tsx](app/src/NarrativeApp.tsx) - Document lifecycle
- [app/src/components/MainView.tsx](app/src/components/MainView.tsx) - Main UI
- [app/src/components/AssumptionCard.tsx](app/src/components/AssumptionCard.tsx) - Assumption display
- [app/src/components/VoteBar.tsx](app/src/components/VoteBar.tsx) - Vote visualization

### Configuration
- [package.json](package.json) - Monorepo config
- [app/package.json](app/package.json) - App dependencies
- [lib/package.json](lib/package.json) - Library dependencies
- [CLAUDE.md](CLAUDE.md) - Development guide for AI assistants

---

**Last Updated**: 2025-12-03
**Version**: 0.1.0
**Authors**: Narrative Team
