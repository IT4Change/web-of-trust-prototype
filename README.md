# Narrative

Narrative is a local-first app for capturing assumptions as single sentences, tagging them freely, and letting collaborators vote (🟢 agree / 🟡 neutral / 🔴 disagree). It runs entirely in the browser using CRDT sync.

## Overview
- Local-first, offline-friendly via Automerge CRDTs
- Single-sentence assumptions with free-form tags
- Real-time voting with simple aggregation
- No central backend required

## Tech Stack
- React 18 + TypeScript
- Tailwind CSS + DaisyUI
- Automerge (sync via `wss://sync.automerge.org`)
- Vite

## Monorepo
```
narrative/
├── app/   # Narrative React app
└── lib/   # narrative-ui library (schema + hooks)
```

## Getting Started
```bash
# Install dependencies
npm install

# Build everything (lib first, then app)
npm run build

# Start dev servers
npm run dev            # from repo root (runs app)
```
App opens at http://localhost:3000.

## Scripts
- `npm run build:lib` / `npm run build:app`
- `npm run lint`
- `npm run test` (library)

## Data Model
- **Assumption**: `sentence`, `tagIds[]`, votes
- **Tag**: free-form name (with optional color)
- **Vote**: one per user per assumption (`green | yellow | red`)

## Identity
Each browser generates a keypair-derived DID on first run. Identity and the last document ID are stored in `localStorage` (`narrativeIdentity`, `narrativeDocId`). Reset clears them and starts a fresh document.

## License
MIT
