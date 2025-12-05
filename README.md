# Narrative

[![Deploy](https://github.com/it4change/narrative/actions/workflows/deploy.yml/badge.svg)](https://github.com/it4change/narrative/actions/workflows/deploy.yml)
[![Tests](https://github.com/it4change/narrative/actions/workflows/test.yml/badge.svg)](https://github.com/it4change/narrative/actions/workflows/test.yml)

**Live Demo**: [web-of-trust.de](https://web-of-trust.de)

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
| **Unified** | All-in-One PWA mit allen Modulen | [/unified/](https://web-of-trust.de/unified/) |
| **Narrative** | Assumptions & Meinungsbilder | [/narrative/](https://web-of-trust.de/narrative/) |
| **Map** | Kollaborative Karten | [/map/](https://web-of-trust.de/map/) |
| **Market** | Dezentraler Marktplatz | [/market/](https://web-of-trust.de/market/) |
| **Dank** | Voucher & Gutschein-System | [/dank/](https://web-of-trust.de/dank/) |

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

Im Browser verfügbar unter `window.__narrative`:

```javascript
__narrative.help()           // Hilfe
__narrative.userDoc()        // UserDocument
__narrative.trustGiven()     // Ausgehende Trust
__narrative.trustReceived()  // Eingehende Trust
__narrative.exportUserDoc()  // Als JSON exportieren
```

## Deployment

GitHub Actions deployed automatisch bei Push auf `main`:

1. Library wird gebaut
2. Alle Apps werden parallel gebaut
3. Deployment auf GitHub Pages

**Custom Domain**: `web-of-trust.de`

## Dokumentation

- [lib/README.md](lib/README.md) - Library Dokumentation
- [lib/src/hooks/README.md](lib/src/hooks/README.md) - Hooks Dokumentation
- [CLAUDE.md](CLAUDE.md) - Development Guide für AI

## Lizenz

MIT
