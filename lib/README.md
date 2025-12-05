# narrative-ui

Shared Library für Narrative Apps. Bietet Infrastruktur für lokale, dezentrale Collaboration mit Automerge CRDTs.

## Installation

```bash
npm install narrative-ui
```

## Architektur

```
lib/src/
├── schema/         # TypeScript-Typen & Dokument-Strukturen
├── hooks/          # React Hooks
├── components/     # UI-Komponenten
├── utils/          # Hilfsfunktionen (DID, Signatur, Storage)
└── modules/        # Modul-System für App-Erweiterungen
```

---

## Schema

### Dokument-Typen

| Typ | Beschreibung |
|-----|--------------|
| `BaseDocument<T>` | Generisches Workspace-Dokument mit Identities |
| `UserDocument` | Persönliches Dokument (Profil, Trust, Workspaces) |
| `UserIdentity` | DID + öffentlicher Schlüssel |
| `TrustAttestation` | Signierte Vertrauensbeziehung |

### BaseDocument

Jedes Workspace-Dokument erbt von `BaseDocument<TData>`:

```typescript
interface BaseDocument<TData> {
  version: string;
  lastModified: number;
  identities: Record<string, IdentityProfile>;
  identityLookup: Record<string, IdentityLookupEntry>;
  data: TData;
}
```

### UserDocument

Cross-Workspace persönliches Dokument:

```typescript
interface UserDocument {
  did: string;
  profile: UserProfile;          // Name, Avatar
  trustGiven: Record<string, TrustAttestation>;    // Wem ich vertraue
  trustReceived: Record<string, TrustAttestation>; // Wer mir vertraut
  workspaces: Record<string, WorkspaceRef>;        // Meine Workspaces
  vouchers: Record<string, Voucher>;               // DANK-Token
}
```

---

## Hooks

| Hook | Zweck |
|------|-------|
| `useRepository` | Automerge Repo mit IndexedDB + WebSocket |
| `useUserDocument` | UserDocument laden/verwalten |
| `useAppContext` | Zentraler App-State (Identity, Trust, Modals) |
| `useTrustNotifications` | Neue Trust-Anfragen erkennen |
| `useCrossTabSync` | Tab-übergreifende Synchronisation |
| `useProfileUrl` | Profil-Deeplinks via URL-Hash |

Siehe [hooks/README.md](src/hooks/README.md) für Details.

---

## Komponenten

### App-Shell

| Komponente | Beschreibung |
|------------|--------------|
| `AppShell` | Initialisiert Repo, Identity, Document |
| `AppNavbar` | Navigation mit Profil, Workspaces, Trust |
| `AppLayout` | Standard-Layout mit Navbar + Content |

### Modals

| Komponente | Beschreibung |
|------------|--------------|
| `ProfileModal` | Eigenes Profil bearbeiten |
| `UserProfileModal` | Fremdes Profil anzeigen |
| `QRScannerModal` | QR-Code scannen für Trust |
| `TrustReciprocityModal` | Trust-Anfragen beantworten |
| `NewWorkspaceModal` | Neuen Workspace erstellen |
| `CollaboratorsModal` | Workspace-Teilnehmer anzeigen |
| `ParticipantsModal` | Aktive Teilnehmer anzeigen |
| `WorkspaceSwitcher` | Zwischen Workspaces wechseln |

### UI-Elemente

| Komponente | Beschreibung |
|------------|--------------|
| `UserAvatar` | Avatar aus DID generieren |
| `UserListItem` | User in Listen anzeigen |
| `ClickableUserName` | Name mit Profil-Link |
| `LoadingScreen` | Lade-Spinner |
| `Toast` | Benachrichtigungen |

---

## Utilities

### DID & Kryptografie

```typescript
import { generateDidIdentity, signJws, verifyJws } from 'narrative-ui';

// Neue Identity erstellen
const identity = await generateDidIdentity('Max Mustermann');
// { did: 'did:key:z6Mk...', publicKey: '...', privateKey: '...' }

// Daten signieren
const jws = await signJws(data, privateKey);

// Signatur verifizieren
const { valid, payload } = await verifyJws(jws, publicKey);
```

### Storage

```typescript
import {
  loadSharedIdentity,
  saveSharedIdentity,
  loadDocumentId,
  saveDocumentId
} from 'narrative-ui';

// Identity wird app-übergreifend geteilt
const identity = loadSharedIdentity();

// Document-IDs sind app-spezifisch
const docId = loadDocumentId('narrative'); // narrative_docId
```

### Debug-Tools

Im Browser verfügbar unter `window.__narrative`:

```javascript
__narrative.help()           // Hilfe
__narrative.userDoc()        // UserDocument
__narrative.trustGiven()     // Ausgehende Trust
__narrative.trustReceived()  // Eingehende Trust
__narrative.exportUserDoc()  // Als JSON exportieren
```

---

## Quick Start

```tsx
import {
  useRepository,
  AppShell,
  AppLayout,
  createBaseDocument
} from 'narrative-ui';

function App() {
  const repo = useRepository();

  return (
    <AppShell
      repo={repo}
      storagePrefix="myapp"
      createEmptyDocument={(identity) => createBaseDocument(identity, { items: [] })}
      enableUserDocument
    >
      {(props) => (
        <AppLayout {...props}>
          <MyContent doc={props.doc} />
        </AppLayout>
      )}
    </AppShell>
  );
}
```

---

## Trust-System

Das Web-of-Trust basiert auf gegenseitig signierten Attestierungen:

1. **A scannt B's QR-Code** → A erstellt signierte Attestierung
2. **Attestierung wird in B's UserDocument geschrieben** (trustReceived)
3. **B bekommt Benachrichtigung** → TrustReciprocityModal
4. **B scannt A's QR-Code zurück** → Bidirektionales Vertrauen

```typescript
// Trust attestieren
await handleTrustUser(trusteeDid, trusteeUserDocUrl);

// Trust-Status prüfen
const givenTrust = userDoc.trustGiven[targetDid];
const receivedTrust = userDoc.trustReceived[targetDid];
const isMutual = givenTrust && receivedTrust;
```

---

## Entwicklung

```bash
# Library bauen
npm run build --workspace=lib

# Tests
npm run test --workspace=lib

# Watch-Mode
npm run dev --workspace=lib
```
