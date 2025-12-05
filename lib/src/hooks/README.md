# Hooks

React Hooks für die Narrative-Infrastruktur.

## Übersicht

| Hook | Zweck |
|------|-------|
| `useRepository` | Automerge Repo mit Storage + WebSocket |
| `useUserDocument` | Persönliches User-Dokument (Profil, Trust, Workspaces) |
| `useAppContext` | Zentraler App-State (Identity, Modals, Trust-Handling) |
| `useTrustNotifications` | Erkennt neue Trust-Attestierungen |
| `useCrossTabSync` | Reagiert auf localStorage-Änderungen in anderen Tabs |
| `useProfileUrl` | Profil-DIDs via URL-Hash (`#profile=did:key:...`) |

---

## `useRepository`

Erstellt ein Automerge Repository mit IndexedDB-Storage und WebSocket-Sync.

```tsx
const repo = useRepository({
  syncServer: 'wss://sync.automerge.org', // optional
});
```

---

## `useUserDocument`

Verwaltet das persönliche User-Dokument (cross-workspace).

**Speichert:**
- Profil (Name, Avatar)
- Trust-Attestierungen (gegeben/empfangen)
- Workspace-Liste
- Vouchers

```tsx
const {
  userDoc,
  updateProfile,
  addWorkspace,
  giveTrust,
  getValidReceivedTrust,
} = useUserDocument({ repo, did, displayName });
```

---

## `useAppContext`

Zentraler Hook für App-weiten State. Kombiniert Identity, Workspaces, Trust und UI-Modals.

**Bietet:**
- Identity-Management (laden, speichern, aktualisieren)
- Workspace-Verwaltung
- Trust-Handling (attestieren, widerrufen)
- Modal-Props (TrustReciprocityModal, NewWorkspaceModal, Toast)

```tsx
const {
  identity,
  handleUpdateIdentity,
  handleTrustUser,
  trustReciprocityModalProps,
  toastProps,
} = useAppContext({ docHandle, documentId, ... });
```

---

## `useTrustNotifications`

Erkennt neue Trust-Attestierungen wo der aktuelle User der Empfänger ist.

**Filtert automatisch:**
- Bereits gesehene Attestierungen
- Selbst-Attestierungen
- Attestierungen von Usern, denen man bereits vertraut

```tsx
const {
  pendingAttestations,
  hasPending,
  markAsSeen,
} = useTrustNotifications(userDoc, currentUserDid, documentId);
```

---

## `useCrossTabSync`

Reagiert auf localStorage-Änderungen in anderen Browser-Tabs.

**Triggers:**
- Identity-Änderungen (DID-Wechsel → Page Reload)
- UserDoc-ID-Änderungen

```tsx
useCrossTabSync({
  autoReloadOnIdentityChange: true,
  onIdentityChange: (newIdentity) => { ... },
});
```

> **Hinweis:** Name/Avatar-Änderungen lösen kein Reload aus – diese kommen über Automerge-Sync.

---

## `useProfileUrl`

Ermöglicht Profil-Deeplinks via URL-Hash.

```tsx
const { profileDid, openProfile, closeProfile } = useProfileUrl();

// Öffnet: #doc=...&profile=did:key:z6Mk...
openProfile('did:key:z6Mk...');
```
