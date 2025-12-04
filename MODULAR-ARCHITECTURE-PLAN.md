# Modular Architecture Plan

## Vision

Narrative entwickelt sich zu einem modularen Ökosystem, in dem verschiedene Apps (Narrative, Map, Market, etc.) als Module in gemeinsamen Kontexten/Workspaces zusammenarbeiten.

## Kern-Konzepte

```
Workspace/Kontext = Eine Gruppe/Community mit:
  - Gemeinsame Identitäten (wer ist dabei?)
  - Gemeinsames Web of Trust (wer vertraut wem?)
  - Aktivierbare Module (Narrative, Map, Market, Chat, Kanban, ...)
```

## Architektur-Entscheidung: Option 1 → Option 3

### Option 1: Single Document mit Modul-Namespace (START)

```typescript
interface UnifiedDocument {
  // Shared infrastructure (bereits vorhanden in BaseDocument)
  identities: Record<string, IdentityProfile>;
  trustAttestations: Record<string, TrustAttestation>;

  // Kontext-Metadaten
  context: {
    name: string;
    description?: string;
    avatar?: string;
  };

  // Aktive Module
  enabledModules: {
    narrative: boolean;
    map: boolean;
    market: boolean;
  };

  // Modul-Daten (alles in einem Document)
  modules: {
    narrative?: OpinionGraphData;
    map?: MapData;
    market?: MarketData;
  };
}
```

**Vorteile:**
- ✅ Single Sync Point - alles synct zusammen
- ✅ Identity/Trust System wird natürlich geteilt
- ✅ Ein URL zum Teilen
- ✅ Einfaches Umschalten zwischen Modulen (nur UI)

**Nachteile:**
- ⚠️ Dokument wird größer mit mehr Modulen
- ⚠️ Alle Teilnehmer sehen alle Module

### Option 3: Workspace-System (ZIEL)

```typescript
// User hat Zugriff auf mehrere Workspaces
interface WorkspaceList {
  workspaces: Array<{
    id: DocumentId;
    name: string;
    avatar?: string;
    lastAccessed: number;
  }>;
}

// Jeder Workspace ist ein vollständiges Document (wie Option 1)
interface Workspace extends BaseDocument<UnifiedModules> {
  // ... alles von Option 1
}
```

**Vorteile:**
- ✅ Skalierbar - unbegrenzte Kontexte
- ✅ Saubere Trennung zwischen Gruppen
- ✅ Industry-Standard Pattern (wie Slack/Discord)
- ✅ Jeder Kontext ist unabhängig

---

## Migrations-Roadmap

### Phase 1: Foundation & Single Workspace (1-2 Wochen)

**Ziel:** BaseDocument erweitern + Unified App mit Module Switcher

#### 1.1 BaseDocument Schema erweitern

```typescript
// lib/src/schema/document.ts
export interface ContextMetadata {
  name: string;
  description?: string;
  avatar?: string;
}

export interface BaseDocument<TData = unknown> {
  version: string;
  lastModified: number;

  // NEU: Context info
  context?: ContextMetadata;

  // NEU: Module flags
  enabledModules?: Record<string, boolean>;

  // Existing shared infrastructure
  identities: Record<string, IdentityProfile>;
  trustAttestations: Record<string, TrustAttestation>;

  // Module data (kann mehrere Module enthalten)
  data: TData;
}
```

**Tasks:**
- [ ] `BaseDocument` Interface erweitern mit `context` und `enabledModules`
- [ ] `createBaseDocument()` aktualisieren
- [ ] Type exports in `lib/src/index.ts` ergänzen
- [ ] Library bauen und testen

#### 1.2 Module Interface standardisieren

```typescript
// lib/src/modules/types.ts (NEU)
export interface ModuleContext {
  currentUserDid: string;
  identities: Record<string, IdentityProfile>;
  trustAttestations: Record<string, TrustAttestation>;
}

export interface ModuleProps<TData> {
  data: TData;
  onChange: (data: TData) => void;
  context: ModuleContext;
}

export interface ModuleDefinition<TData> {
  id: string;
  name: string;
  icon: string;
  description?: string;
  version: string;
  createEmptyData: () => TData;
  component: React.ComponentType<ModuleProps<TData>>;
}
```

**Tasks:**
- [ ] Module types in `lib/src/modules/types.ts` erstellen
- [ ] Exports in `lib/src/index.ts` ergänzen

#### 1.3 Narrative App refactoren

**Ziel:** Narrative als wiederverwendbares Modul extrahieren

```typescript
// narrative-app/src/modules/NarrativeModule.tsx (NEU)
export interface NarrativeModuleProps {
  data: OpinionGraphData;
  onChange: (data: OpinionGraphData) => void;
  context: ModuleContext;
}

export function NarrativeModule({
  data,
  onChange,
  context
}: NarrativeModuleProps) {
  // Pure component - no document loading
  // All existing UI logic from MainView
  return <NarrativeView ... />;
}

// narrative-app/src/modules/definition.ts (NEU)
export const narrativeModule: ModuleDefinition<OpinionGraphData> = {
  id: 'narrative',
  name: 'Narrative',
  icon: '💭',
  description: 'Collaborative assumption tracking',
  version: '1.0.0',
  createEmptyData: () => ({
    assumptions: {},
    votes: {},
    tags: {},
  }),
  component: NarrativeModule,
};
```

**Tasks:**
- [ ] `NarrativeModule.tsx` komponente extrahieren
- [ ] `narrativeModule` Definition erstellen
- [ ] Bestehende `NarrativeApp.tsx` aktualisieren um `NarrativeModule` zu nutzen
- [ ] Exports in `narrative-app/src/index.ts` ergänzen

#### 1.4 Unified App erstellen

```typescript
// unified-app/src/App.tsx
import { narrativeModule } from '../narrative-app/src/modules/definition';

type UnifiedModules = {
  narrative?: OpinionGraphData;
  // map?: MapData;  // später
  // market?: MarketData;  // später
};

const AVAILABLE_MODULES = {
  narrative: narrativeModule,
};

function UnifiedApp() {
  const [activeModule, setActiveModule] = useState<string>('narrative');
  const doc = useDocument<BaseDocument<UnifiedModules>>(docId);

  const context: ModuleContext = {
    currentUserDid,
    identities: doc.identities,
    trustAttestations: doc.trustAttestations,
  };

  return (
    <AppShell>
      {/* Module Tabs */}
      <div className="tabs">
        {Object.entries(doc.enabledModules || {}).map(([id, enabled]) =>
          enabled && (
            <button
              key={id}
              className={activeModule === id ? 'tab-active' : ''}
              onClick={() => setActiveModule(id)}
            >
              {AVAILABLE_MODULES[id].icon} {AVAILABLE_MODULES[id].name}
            </button>
          )
        )}
      </div>

      {/* Active Module */}
      {activeModule === 'narrative' && (
        <NarrativeModule
          data={doc.modules.narrative}
          onChange={(data) => updateModule('narrative', data)}
          context={context}
        />
      )}
    </AppShell>
  );
}
```

**Tasks:**
- [ ] `unified-app` Workspace erstellen
- [ ] Package.json, vite config, etc. setup
- [ ] `UnifiedApp.tsx` implementieren
- [ ] Module Tabs/Switcher UI
- [ ] Document loading & initialization
- [ ] Test mit Narrative Modul

**Deliverable:** Funktionierende Unified App mit Narrative Modul

---

### Phase 2: Multi-Module Support (2-4 Wochen)

**Ziel:** Map & Market Module integrieren

#### 2.1 Map Modul refactoren

**Tasks:**
- [ ] `MapModule.tsx` komponente extrahieren
- [ ] `mapModule` Definition erstellen
- [ ] In Unified App integrieren
- [ ] Tab Switcher erweitern

#### 2.2 Market Modul refactoren

**Tasks:**
- [ ] `MarketModule.tsx` komponente extrahieren
- [ ] `marketModule` Definition erstellen
- [ ] In Unified App integrieren

#### 2.3 Module Registry System

```typescript
// lib/src/modules/registry.ts
export const moduleRegistry: Record<string, ModuleDefinition<any>> = {};

export function registerModule<TData>(
  module: ModuleDefinition<TData>
): void {
  moduleRegistry[module.id] = module;
}

export function getModule(id: string): ModuleDefinition<any> | undefined {
  return moduleRegistry[id];
}
```

**Tasks:**
- [ ] Registry System implementieren
- [ ] Auto-discovery für Module
- [ ] Plugin loader (optional)

**Deliverable:** Unified App mit 3+ Modulen

---

### Phase 3: Workspace Switcher (1-2 Wochen)

**Ziel:** Mehrere Workspaces/Kontexte verwalten

#### 3.1 Workspace Registry

```typescript
// lib/src/workspaces/registry.ts
export interface WorkspaceInfo {
  id: string;  // DocumentId
  name: string;
  avatar?: string;
  enabledModules: string[];
  lastAccessed: number;
}

export interface WorkspaceRegistry {
  workspaces: WorkspaceInfo[];
  currentWorkspace: string;
}

// localStorage persistence
export function loadWorkspaceRegistry(): WorkspaceRegistry;
export function saveWorkspaceRegistry(registry: WorkspaceRegistry): void;
export function addWorkspace(info: WorkspaceInfo): void;
export function removeWorkspace(id: string): void;
export function switchWorkspace(id: string): void;
```

**Tasks:**
- [ ] Workspace Registry types & utilities
- [ ] LocalStorage persistence
- [ ] Workspace Manager hook

#### 3.2 Workspace Switcher UI

```typescript
// unified-app/src/components/WorkspaceSwitcher.tsx
function WorkspaceSwitcher() {
  const { workspaces, current } = useWorkspaceRegistry();

  return (
    <Dropdown>
      {workspaces.map(ws => (
        <WorkspaceItem
          key={ws.id}
          workspace={ws}
          isCurrent={ws.id === current}
          onClick={() => switchToWorkspace(ws.id)}
        />
      ))}
      <Divider />
      <CreateWorkspaceButton />
    </Dropdown>
  );
}
```

**Tasks:**
- [ ] Workspace Switcher Dropdown
- [ ] Create New Workspace Flow
- [ ] Workspace Settings Modal
- [ ] Recent Workspaces

#### 3.3 Context/Workspace Metadata UI

**Tasks:**
- [ ] Workspace Name/Avatar Editor
- [ ] Module Aktivierung/Deaktivierung UI
- [ ] Workspace Sharing (URL copy)

**Deliverable:** Vollständiges Multi-Workspace System

---

### Phase 4: Module Marketplace (Langfristig)

**Ziel:** Community Module System

#### 4.1 Module als NPM Packages

```bash
narrative/
├── modules/
│   ├── @narrative/module-narrative/
│   ├── @narrative/module-map/
│   ├── @narrative/module-market/
│   ├── @narrative/module-chat/       # Community
│   └── @narrative/module-kanban/     # Community
```

#### 4.2 Dynamic Module Loading

```typescript
// Runtime module loading
async function loadModule(moduleId: string) {
  const module = await import(`@narrative/module-${moduleId}`);
  registerModule(module.default);
}
```

#### 4.3 Module Discovery & Installation

```typescript
// Module marketplace API
interface ModuleMarketplace {
  search(query: string): Promise<ModuleInfo[]>;
  install(moduleId: string): Promise<void>;
  uninstall(moduleId: string): Promise<void>;
}
```

**Tasks:**
- [ ] Module Package standard
- [ ] Dynamic loading system
- [ ] Module Marketplace UI
- [ ] Community module submission

---

## Development Guidelines

### Creating a New Module

```bash
# Using the create-module script
npm run create-module <module-name>

# Example:
npm run create-module chat
```

This generates:
```
narrative/
└── <module-name>-app/
    ├── package.json
    ├── src/
    │   ├── modules/
    │   │   ├── <ModuleName>Module.tsx
    │   │   └── definition.ts
    │   ├── App.tsx (standalone wrapper)
    │   └── index.ts
```

### Module Development Workflow

1. **Develop standalone:**
   ```bash
   cd chat-app
   npm run dev
   ```

2. **Test in unified app:**
   ```bash
   cd unified-app
   npm run dev
   # Chat module is auto-discovered
   ```

3. **Build & deploy:**
   ```bash
   npm run build
   # Builds lib + all modules + unified-app
   ```

### Module Interface Contract

Every module MUST:
- ✅ Export a `ModuleDefinition<TData>`
- ✅ Implement `ModuleProps<TData>` interface
- ✅ Be a pure function of props (no side effects)
- ✅ Handle own internal state
- ✅ Emit changes via `onChange` callback
- ✅ Access shared context via `context` prop

Every module SHOULD:
- ✅ Have standalone app wrapper for development
- ✅ Include tests
- ✅ Document data schema
- ✅ Provide empty data initializer

---

## Migration Strategy

### Backwards Compatibility

**Standalone Apps:** Alle existierenden Apps (`narrative-app`, `map-app`, `market-app`) bleiben funktional:
- Können weiterhin standalone deployed werden
- Nutzen das alte Single-Module Document Format
- Keine Breaking Changes

**URL Migration:** Alte Document URLs funktionieren:
```
# Alt (Single Module)
https://narrative.app/#doc=automerge:abc123

# Neu (Unified, aber kompatibel)
https://narrative.app/#doc=automerge:abc123
→ Erkennt altes Format, wrapped in Unified Structure
```

### Gradual Rollout

1. **Soft Launch:** Unified App läuft parallel zu standalone apps
2. **User Testing:** Early adopters testen Multi-Module Workflow
3. **Feature Parity:** Alle Module haben gleiche Features standalone vs unified
4. **Default Switch:** Unified App wird default, standalone apps bleiben verfügbar
5. **Full Migration:** Nach 6+ Monaten, wenn stabil

---

## Success Metrics

### Phase 1 Success:
- [ ] Unified App deployed & accessible
- [ ] Narrative Module funktioniert identisch zu standalone
- [ ] Module Switcher UI implementiert
- [ ] Dokumentation für Module Development

### Phase 2 Success:
- [ ] 3+ Module in Unified App
- [ ] Module Registry funktioniert
- [ ] Performance ist vergleichbar mit standalone apps

### Phase 3 Success:
- [ ] Users können zwischen Workspaces wechseln
- [ ] Workspace Creation Flow ist intuitiv
- [ ] LocalStorage Registry funktioniert zuverlässig

### Long-term Success:
- [ ] Community hat 5+ Module erstellt
- [ ] Module Marketplace ist aktiv
- [ ] Unified App ist Primary Entry Point
- [ ] Standalone Apps nur noch für Power Users

---

## Open Questions

1. **Module Permissions:** Brauchen Module granulare Permissions?
   - Read-only access to shared data?
   - Sandboxing?

2. **Module Communication:** Sollen Module miteinander kommunizieren können?
   - Event Bus?
   - Shared State beyond document?

3. **Version Management:** Wie handeln wir inkompatible Module Versions?
   - Semantic versioning enforcement?
   - Migration scripts?

4. **Performance:** Ab wann wird ein Document zu groß?
   - Lazy loading für deaktivierte Module?
   - Data pagination?

---

## Resources

- **Design Figma:** [Link TBD]
- **Architecture Decisions:** See `/docs/adr/`
- **Module Development Guide:** See `/docs/modules/`
- **API Reference:** See `/docs/api/`

---

## Timeline Estimate

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1 | 1-2 weeks | Week 1 | Week 2 |
| Phase 2 | 2-4 weeks | Week 3 | Week 6 |
| Phase 3 | 1-2 weeks | Week 7 | Week 8 |
| Phase 4 | Ongoing | Month 3+ | - |

**Total to MVP (Phase 1-3):** ~2 months

---

## Next Steps

1. Review this plan with team
2. Create GitHub project board
3. Start Phase 1.1: BaseDocument Schema
4. Set up unified-app workspace
5. Refactor Narrative as first module

**Let's build the future of modular, local-first collaboration! 🚀**
