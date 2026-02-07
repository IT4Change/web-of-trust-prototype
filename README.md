# Narrative

> **Hinweis:** Dies ist ein Prototyp. Die aktive Weiterentwicklung des Web of Trust findet im neuen Repository statt: [antontranelis/web-of-trust](https://github.com/antontranelis/web-of-trust)

[![Deploy](https://github.com/it4change/web-of-trust/actions/workflows/deploy.yml/badge.svg)](https://github.com/it4change/web-of-trust/actions/workflows/deploy.yml)
[![Tests](https://github.com/it4change/web-of-trust/actions/workflows/test.yml/badge.svg)](https://github.com/it4change/web-of-trust/actions/workflows/test.yml)

**Live Demo**: [it4change.github.io/web-of-trust](https://it4change.github.io/web-of-trust/)

Local-first Collaboration Platform mit dezentraler Identität und Web of Trust.

## Features

- **Offline-first**: Funktioniert ohne Internet, synct automatisch wenn verbunden
- **Real-time Collaboration**: Änderungen werden sofort über WebSocket synchronisiert
- **Dezentrale Identität**: did:key basierte Identitäten mit Ed25519 Signaturen
- **Web of Trust**: Gegenseitige Vertrauensbeziehungen via QR-Code Scan
- **Cross-App Identity**: Eine Identität für alle Apps im Ökosystem

## Apps

| App | Beschreibung | URL |
|-----|--------------|-----|
| **Unified** | All-in-One PWA mit allen Modulen | [/web-of-trust/](https://it4change.github.io/web-of-trust/) |
| **Narrative** | Assumptions & Meinungsbilder | [/web-of-trust/narrative/](https://it4change.github.io/web-of-trust/narrative/) |
| **Map** | Kollaborative Karten | [/web-of-trust/map/](https://it4change.github.io/web-of-trust/map/) |
| **Market** | Dezentraler Marktplatz | [/web-of-trust/market/](https://it4change.github.io/web-of-trust/market/) |
| **Dank** | Voucher & Gutschein-System | [/web-of-trust/dank/](https://it4change.github.io/web-of-trust/dank/) |

## Architektur

```
narrative/
├── lib/               # Shared Library (narrative-ui)
│   ├── src/
│   │   ├── schema/    # TypeScript Types & Document Structures
│   │   ├── hooks/     # React Hooks (useAppContext, useUserDocument, etc.)
│   │   ├── components/# Shared UI Components
│   │   └── utils/     # DID, Signaturen, Storage
│   └── README.md
│
├── narrative-app/     # Assumptions App
├── map-app/           # Map App
├── market-app/        # Marketplace App
├── dank-app/          # Voucher App
├── unified-app/       # All-in-One PWA
│
├── shared-config/     # Shared Vite/TypeScript Config
├── scripts/           # Scaffolding Scripts
└── CLAUDE.md          # AI Development Guide
```

## Tech Stack

| Kategorie | Technologie |
|-----------|-------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, DaisyUI |
| **CRDT** | Automerge 2.x |
| **Sync** | WebSocket (sync.automerge.org) |
| **Storage** | IndexedDB |
| **Crypto** | Web Crypto API (Ed25519) |
| **Identity** | did:key |

## Schnellstart

```bash
# Dependencies installieren
npm install

# Library + alle Apps bauen
npm run build

# Entwicklung starten (alle Apps)
npm run dev

# Einzelne App starten
npm run dev:narrative
npm run dev:map
npm run dev:unified
```

## Datenmodell

### UserDocument (Cross-Workspace)

Persönliches Dokument das zwischen allen Apps geteilt wird:

```typescript
interface UserDocument {
  did: string;                    // Identität
  profile: { displayName, avatarUrl };
  trustGiven: Record<DID, TrustAttestation>;     // Wem ich vertraue
  trustReceived: Record<DID, TrustAttestation>;  // Wer mir vertraut
  workspaces: Record<DocID, WorkspaceRef>;       // Meine Workspaces
}
```

### BaseDocument (Workspace)

Jedes Workspace-Dokument hat diese Basisstruktur:

```typescript
interface BaseDocument<TData> {
  version: string;
  lastModified: number;
  identities: Record<DID, IdentityProfile>;
  identityLookup: Record<DID, IdentityLookupEntry>;
  data: TData;  // App-spezifische Daten
}
```

## Web of Trust

Vertrauensbeziehungen werden via QR-Code etabliert:

1. **A scannt B's QR-Code** → A erstellt signierte Attestierung
2. **Attestierung wird in B's UserDoc geschrieben**
3. **B bekommt Notification** → kann zurück-vertrauen
4. **Bidirektionales Vertrauen** → beide können sich gegenseitig verifizieren

```typescript
interface TrustAttestation {
  id: string;
  trusterDid: string;      // Wer vertraut
  trusteeDid: string;      // Wem vertraut wird
  level: 'verified' | 'endorsed';
  signature: string;       // JWS Signatur
  createdAt: number;
}
```

## Identität

DIDs im `did:key` Format mit Ed25519:

```
did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH
```

**Storage**: `localStorage` unter `narrative_shared_identity`

```typescript
interface StoredIdentity {
  did: string;
  displayName: string;
  publicKey: string;   // Base64
  privateKey: string;  // Base64 (PKCS#8)
}
```

## Development

### Neue App erstellen

```bash
npm run create-app my-app --port 3005 --title "My App"
```

### Library entwickeln

```bash
# Watch mode
npm run dev --workspace=lib

# Tests
npm run test --workspace=lib

# Build
npm run build:lib
```

### Debugging

Die Debug Tools sind in **allen Environments** (dev + production) verfügbar und bieten Zugriff auf den internen State der App.

#### Quick Access (auto-aktualisiert)

```javascript
__userDoc     // Aktuelles UserDocument
__doc         // Aktuelles Workspace-Dokument
__identity    // Aktuelle Identität
```

#### Alle Befehle

```javascript
// Hilfe
__narrative.help()

// Identity
__narrative.identity()        // Identität anzeigen
__narrative.exportIdentity()  // Als JSON exportieren

// User Document
__narrative.userDoc()         // UserDocument anzeigen
__narrative.printUserDoc()    // Formatiert ausgeben
__narrative.trustGiven()      // Ausgehende Trust-Attestationen
__narrative.trustReceived()   // Eingehende Trust-Attestationen
__narrative.workspaces()      // Alle Workspaces
__narrative.exportUserDoc()   // Als JSON exportieren

// Workspace Document
__narrative.doc()             // Workspace-Dokument anzeigen
__narrative.printDoc()        // Formatiert ausgeben
__narrative.exportDoc()       // Als JSON exportieren

// Beliebige Dokumente laden
await __narrative.loadDoc('automerge:xyz...')    // Dokument nach ID laden
await __narrative.loadUserDoc('did:key:z6Mk...') // UserDoc eines Users laden
```

#### App-spezifische Extensions

Einzelne Apps erweitern die Debug Tools mit app-spezifischen Befehlen:

**narrative-app:**

```javascript
__narrative.assumptions()     // Alle Assumptions
__narrative.votes()           // Alle Votes
__narrative.trace('id')       // Assumption + Votes + Edits
```

**market-app:**

```javascript
__narrative.listings()        // Alle Listings
__narrative.offers()          // Nur Angebote
__narrative.needs()           // Nur Gesuche
__narrative.reactions()       // Alle Reaktionen
```

#### Tipps

- `__userDoc` und `__doc` aktualisieren sich automatisch bei Änderungen
- `loadUserDoc()` funktioniert nur für User, die dir vertrauen (URL ist in trustReceived)
- Für Raw-JSON: `JSON.stringify(__userDoc, null, 2)`

## Deployment

GitHub Actions deployed automatisch bei Push auf `main`:

1. Library wird gebaut
2. Alle Apps werden parallel gebaut
3. Deployment auf GitHub Pages

**GitHub Pages**: `https://it4change.github.io/web-of-trust/`

## Dokumentation

**Für Entwickler:**

- [docs/TUTORIAL.md](docs/TUTORIAL.md) - **Tutorial: Deine erste App**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Wie du beitragen kannst
- [lib/README.md](lib/README.md) - Library Dokumentation
- [lib/src/hooks/README.md](lib/src/hooks/README.md) - Hooks Dokumentation

**Für AI-Assistenten:**

- [llms.txt](llms.txt) - Kompakte Referenz für LLMs
- [CLAUDE.md](CLAUDE.md) - Detaillierter Development Guide

**Konzepte & Architektur:**

- [docs/WEB-OF-TRUST-CONCEPT.md](docs/WEB-OF-TRUST-CONCEPT.md) - Trust-System inkl. Profil-Signaturen
- [docs/IDENTITY-CONCEPT.md](docs/IDENTITY-CONCEPT.md) - Identitätssystem

## Lizenz

MIT
