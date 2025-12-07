# WoT Content Sharing Konzept

> **Status:** Design-Konzept (noch nicht implementiert)
> **Abhängigkeiten:** Web of Trust, UserDocument, Module-System

## Übersicht

Dieses Dokument beschreibt, wie App-Inhalte (Orte, Annahmen, Marktplatz-Anzeigen, Events, Tasks) zwischen Freunden im Web of Trust geteilt werden können - unabhängig von Workspaces.

## Motivation

Aktuell gibt es zwei getrennte Konzepte:

1. **Workspaces/Gruppen** - Geteilte Automerge-Dokumente wo alle Teilnehmer den gleichen Content sehen
2. **Web of Trust** - Persönliches Vertrauensnetzwerk im UserDocument (Trust-Attestations)

**Ziel:** Inhalte auch 1:1 oder selektiv mit Freunden teilen können, ohne einen gemeinsamen Workspace zu benötigen.

## Architektur

### Content lebt im UserDocument des Erstellers

```
UserDocument (von Alice)
├── profile: { displayName, avatarUrl }
├── trustGiven: { bob: TrustAttestation, ... }
├── trustReceived: { bob: TrustAttestation, ... }
├── workspaces: { ... }
└── sharedContent: {              ← NEU
      "loc-123": SharedContentItem,
      "asn-456": SharedContentItem,
      ...
    }
```

**Vorteile:**
- Natürliches Ownership-Modell (jeder kontrolliert seinen Content)
- Nutzt bestehende UserDoc-Sync-Infrastruktur
- Content ist signiert und verifizierbar
- Offline-first durch Automerge-Replikation

### Lesen von Freunde-Content

Die bestehende Infrastruktur in `useAppContext.ts` subscribed bereits die UserDocuments aller Freunde (für Profile/Avatare). Diese Subscriptions können erweitert werden um auch `sharedContent` zu aggregieren.

```
┌─────────────────────────────────────────────────────────────┐
│  Mein Client                                                │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Mein UserDoc    │    │ Alices UserDoc  │ ← subscribed   │
│  │ sharedContent   │    │ sharedContent   │                │
│  └─────────────────┘    └─────────────────┘                │
│          │                      │                           │
│          └──────────┬───────────┘                           │
│                     ▼                                       │
│            ┌─────────────────┐                              │
│            │  Unified Feed   │                              │
│            │  (aggregiert)   │                              │
│            └─────────────────┘                              │
│                     │                                       │
│                     ▼                                       │
│            ┌─────────────────┐                              │
│            │  Modul-Views    │                              │
│            │  (Map, etc.)    │                              │
│            └─────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Datenmodell

### SharedContentItem

```typescript
interface SharedContentItem<T = unknown> {
  id: string;

  // Content-Typ (entspricht Modul)
  type: SharedContentType;

  // App-spezifischer Inhalt
  payload: T;

  // Metadata
  ownerDid: string;
  createdAt: number;
  updatedAt: number;

  // Sichtbarkeit
  visibility: ContentVisibility;

  // Kryptographische Signatur
  signature?: string;
}

type SharedContentType =
  | 'location'      // Map-Modul
  | 'assumption'    // Assumptions-Modul
  | 'listing'       // Marketplace-Modul
  | 'event'         // Kalender (future)
  | 'task';         // Tasks (future)
```

### ContentVisibility

```typescript
interface ContentVisibility {
  // Wer kann sehen?
  scope: VisibilityScope;

  // Für 'selected-friends': Liste von DIDs
  allowedDids?: string[];

  // Optional: Ablaufdatum
  expiresAt?: number;
}

type VisibilityScope =
  | 'all-friends'      // Alle direkten Trust-Beziehungen
  | 'mutual-friends'   // Nur gegenseitiges Vertrauen
  | 'selected-friends' // Nur ausgewählte DIDs
  | 'private';         // Nur für mich (Entwurf)
```

### Type-spezifische Payloads

```typescript
// Ort
interface LocationPayload {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
  category?: string;
}

// Annahme
interface AssumptionPayload {
  sentence: string;
  context?: string;
  tagIds?: string[];
}

// Marktplatz-Anzeige
interface ListingPayload {
  type: 'offer' | 'need';
  title: string;
  description: string;
  categoryId: string;
  location?: string;
  availableFrom?: number;
  availableUntil?: number;
}

// Event (future)
interface EventPayload {
  title: string;
  description?: string;
  startTime: number;
  endTime?: number;
  location?: string;
}

// Task (future)
interface TaskPayload {
  title: string;
  description?: string;
  dueDate?: number;
  priority?: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
}
```

### UserDocument Erweiterung

```typescript
interface UserDocument {
  // ... bestehende Felder ...

  /**
   * Geteilte Inhalte, sichtbar für Freunde
   */
  sharedContent?: Record<string, SharedContentItem>;

  /**
   * Einstellungen für Content-Sharing
   */
  contentSettings?: ContentSettings;
}

interface ContentSettings {
  // Standard-Sichtbarkeit für neue Inhalte
  defaultVisibility: ContentVisibility;

  // Welche Content-Typen von Freunden zeigen
  subscribedTypes: SharedContentType[];

  // Stummgeschaltete Freunde (Content verstecken)
  mutedDids?: string[];
}
```

## UI/UX Integration

### Freunde-Content in Modulen anzeigen

Statt eines separaten "WoT-Feeds" erscheint Freunde-Content **innerhalb der bestehenden Module**:

```
┌─────────────────────────────────────────┐
│  Map-Modul                              │
│  ─────────────────────────────────────  │
│                                         │
│  [Workspace-Orte]  [Freunde-Orte ▼]     │ ← Toggle/Filter
│                                         │
│  📍 Café Central                        │
│  📍 Bäckerei Schmidt                    │
│  📍 Park (von Anna) ← Badge zeigt Quelle│
│                                         │
└─────────────────────────────────────────┘
```

### Content teilen

```
┌─────────────────────────────────────────┐
│  Ort erstellen                          │
│  ─────────────────────────────────────  │
│                                         │
│  Name: [Mein Lieblingsplatz          ]  │
│  Kategorie: [Café ▼]                    │
│                                         │
│  Teilen mit:                            │
│  ○ Nur in diesem Workspace              │
│  ● Mit Freunden                         │
│    ○ Alle Freunde                       │
│    ○ Nur gegenseitiges Vertrauen        │
│    ○ Ausgewählte Freunde...             │
│                                         │
│  [Erstellen]                            │
└─────────────────────────────────────────┘
```

## Implementierungs-Roadmap

### Phase 1: Schema (dieses Dokument)
- [x] SharedContentItem Design
- [x] ContentVisibility Design
- [x] UserDocument Erweiterung definiert

### Phase 2: Schema-Implementation
- [ ] `lib/src/schema/sharedContent.ts` erstellen
- [ ] UserDocument Interface erweitern
- [ ] CRUD Helper-Funktionen
- [ ] Signatur-Utilities für Content

### Phase 3: Hook für WoT-Content
- [ ] `useWoTContent` Hook erstellen
- [ ] Aggregation aus Freunde-UserDocs
- [ ] Visibility-Filterung
- [ ] Signatur-Verifizierung

### Phase 4: Modul-Integration
- [ ] Map-Modul: Freunde-Orte anzeigen
- [ ] Assumptions: Freunde-Annahmen
- [ ] Marketplace: Freunde-Anzeigen
- [ ] UI für Content-Sharing

## Offene Fragen

1. **Reaktionen/Kommentare:** Können Freunde auf geteilten Content reagieren?
   - Wo werden Reaktionen gespeichert?
   - Im UserDoc des Reagierenden oder des Erstellers?

2. **Löschung:** Was passiert wenn Content gelöscht wird?
   - Soft-delete mit Tombstone?
   - Sofortige Entfernung?

3. **Konflikte:** Wie mit doppelten Inhalten umgehen?
   - Gleicher Ort in Workspace UND von Freund geteilt?
   - Deduplizierung oder beide anzeigen?

4. **Performance:** Bei vielen Freunden mit viel Content
   - Pagination?
   - Lazy Loading?
   - Content-Limits pro User?

## Verwandte Dokumente

- [WEB-OF-TRUST-CONCEPT.md](./WEB-OF-TRUST-CONCEPT.md) - Trust-System
- [USER_DOC_CONCEPT.md](./USER_DOC_CONCEPT.md) - UserDocument Architektur
- [SHARED-INFRASTRUCTURE-CONCEPT.md](./SHARED-INFRASTRUCTURE-CONCEPT.md) - Modul-System
