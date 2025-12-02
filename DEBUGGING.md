# Narrative Datenstruktur Debugging Guide

## Quick Start: Daten im Browser Console inspizieren

### Option 1: Direkter Zugriff (Temporär für Development)

1. **Import Debug Tools in MainView.tsx hinzufügen:**

```typescript
// Am Anfang der Datei
import { exposeDocToConsole, printDocStructure } from '../debug';

// Im MainView Component, nach narrative Hook:
useEffect(() => {
  if (narrative?.doc) {
    exposeDocToConsole(narrative.doc);
  }
}, [narrative?.doc]);
```

2. **Browser Console öffnen (F12)**

3. **Dokument inspizieren:**

```javascript
// Gesamte Datenstruktur anzeigen
__narrativeDoc

// Alle Annahmen
__narrativeDoc.assumptions

// Alle Votes
__narrativeDoc.votes

// Alle Tags
__narrativeDoc.tags

// Identitäten
__narrativeDoc.identities

// Pretty Print
__narrativeDebug.print(__narrativeDoc)

// Vote Analyse
__narrativeDebug.analyze(__narrativeDoc)

// Dokument als JSON exportieren
__narrativeDebug.export(__narrativeDoc)

// Specific Assumption tracen
__narrativeDebug.trace(__narrativeDoc, "assumption-id-hier")
```

## Option 2: React DevTools

1. **React DevTools Browser Extension installieren**
2. **Components Tab öffnen**
3. **MainView Component suchen**
4. **Props/Hooks inspizieren:**
   - Suche nach `narrative` in den Hooks
   - Klicke auf `doc` Objekt
   - Navigiere durch die Struktur

## Option 3: Automerge Inspector (Advanced)

```typescript
// In App.tsx oder MainView.tsx
import { useRepo } from '@automerge/automerge-repo-react-hooks';

// Im Component
const repo = useRepo();
console.log('Repo:', repo);
console.log('All Documents:', repo.find);

// Document Handle inspizieren
const docHandle = repo.find(documentId);
console.log('Doc Handle:', docHandle);
console.log('Doc URL:', docHandle.url);
```

## Datenstruktur Beispiel

```json
{
  "identity": {
    "did": "did:key:1733155123456-abc123xyz",
    "displayName": "Alice"
  },
  "identities": {
    "did:key:1733155123456-abc123xyz": {
      "displayName": "Alice"
    },
    "did:key:1733155234567-def456uvw": {
      "displayName": "Bob"
    }
  },
  "assumptions": {
    "1733155123456-abc123": {
      "id": "1733155123456-abc123",
      "sentence": "TypeScript ist besser als JavaScript für große Projekte",
      "createdBy": "did:key:1733155123456-abc123xyz",
      "creatorName": "Alice",
      "createdAt": 1733155123456,
      "updatedAt": 1733155123456,
      "tagIds": ["1733155123457-tag001", "1733155123458-tag002"],
      "voteIds": ["1733155123459-vote01", "1733155123460-vote02"],
      "editLogIds": ["1733155123461-edit01"]
    }
  },
  "votes": {
    "1733155123459-vote01": {
      "id": "1733155123459-vote01",
      "assumptionId": "1733155123456-abc123",
      "voterDid": "did:key:1733155123456-abc123xyz",
      "voterName": "Alice",
      "value": "green",
      "createdAt": 1733155123459,
      "updatedAt": 1733155123459
    },
    "1733155123460-vote02": {
      "id": "1733155123460-vote02",
      "assumptionId": "1733155123456-abc123",
      "voterDid": "did:key:1733155234567-def456uvw",
      "voterName": "Bob",
      "value": "red",
      "createdAt": 1733155123460,
      "updatedAt": 1733155123460
    }
  },
  "tags": {
    "1733155123457-tag001": {
      "id": "1733155123457-tag001",
      "name": "Programming",
      "createdBy": "did:key:1733155123456-abc123xyz",
      "createdAt": 1733155123457
    },
    "1733155123458-tag002": {
      "id": "1733155123458-tag002",
      "name": "Opinion",
      "createdBy": "did:key:1733155123456-abc123xyz",
      "createdAt": 1733155123458
    }
  },
  "edits": {
    "1733155123461-edit01": {
      "id": "1733155123461-edit01",
      "assumptionId": "1733155123456-abc123",
      "editorDid": "did:key:1733155123456-abc123xyz",
      "editorName": "Alice",
      "type": "create",
      "previousSentence": "",
      "newSentence": "TypeScript ist besser als JavaScript für große Projekte",
      "previousTags": [],
      "newTags": ["Programming", "Opinion"],
      "createdAt": 1733155123461
    }
  },
  "version": "0.1.0",
  "lastModified": 1733155123461
}
```

## Wichtige Beziehungen verstehen

### 1. Von Assumption zu Votes:
```javascript
const assumption = __narrativeDoc.assumptions["assumption-id"];
const votes = assumption.voteIds.map(id => __narrativeDoc.votes[id]);
console.log(votes);
```

### 2. Von Assumption zu Tags:
```javascript
const assumption = __narrativeDoc.assumptions["assumption-id"];
const tags = assumption.tagIds.map(id => __narrativeDoc.tags[id]);
console.log(tags);
```

### 3. Alle Votes eines Users:
```javascript
const userDid = "did:key:1733155123456-abc123xyz";
const userVotes = Object.values(__narrativeDoc.votes)
  .filter(v => v.voterDid === userDid);
console.log(userVotes);
```

### 4. Alle Assumptions mit einem bestimmten Tag:
```javascript
const tagId = "tag-id-hier";
const assumptions = Object.values(__narrativeDoc.assumptions)
  .filter(a => a.tagIds.includes(tagId));
console.log(assumptions);
```

### 5. Edit History für eine Assumption:
```javascript
const assumption = __narrativeDoc.assumptions["assumption-id"];
const edits = assumption.editLogIds
  .map(id => __narrativeDoc.edits[id])
  .sort((a, b) => b.createdAt - a.createdAt);
console.log(edits);
```

## IndexedDB inspizieren

Die Daten werden in IndexedDB gespeichert:

1. **Chrome DevTools → Application Tab → IndexedDB**
2. **Suche nach "automerge"**
3. **Öffne die Datenbank**
4. **Inspiziere die gespeicherten Documents**

## Nützliche Console Befehle

```javascript
// Alle Assumption Sentences anzeigen
Object.values(__narrativeDoc.assumptions).map(a => a.sentence)

// Vote Verteilung
const votes = Object.values(__narrativeDoc.votes);
console.log({
  green: votes.filter(v => v.value === 'green').length,
  yellow: votes.filter(v => v.value === 'yellow').length,
  red: votes.filter(v => v.value === 'red').length
});

// Aktivste User (meiste Votes)
const voteCounts = {};
Object.values(__narrativeDoc.votes).forEach(v => {
  const name = v.voterName || v.voterDid;
  voteCounts[name] = (voteCounts[name] || 0) + 1;
});
console.table(voteCounts);

// Neueste Aktivität
const allActivities = [
  ...Object.values(__narrativeDoc.votes).map(v => ({
    type: 'vote',
    time: v.updatedAt || v.createdAt,
    user: v.voterName,
    data: v
  })),
  ...Object.values(__narrativeDoc.edits).map(e => ({
    type: 'edit',
    time: e.createdAt,
    user: e.editorName,
    data: e
  }))
].sort((a, b) => b.time - a.time);
console.table(allActivities.slice(0, 10));
```

## Performance Monitoring

```javascript
// Document Größe messen
const docSize = JSON.stringify(__narrativeDoc).length;
console.log(`Document Size: ${(docSize / 1024).toFixed(2)} KB`);

// Anzahl Einträge pro Collection
console.table({
  assumptions: Object.keys(__narrativeDoc.assumptions).length,
  votes: Object.keys(__narrativeDoc.votes).length,
  tags: Object.keys(__narrativeDoc.tags).length,
  edits: Object.keys(__narrativeDoc.edits).length,
  identities: Object.keys(__narrativeDoc.identities).length
});

// Durchschnittliche Votes pro Assumption
const avgVotes = Object.values(__narrativeDoc.assumptions)
  .reduce((sum, a) => sum + a.voteIds.length, 0) /
  Object.keys(__narrativeDoc.assumptions).length;
console.log(`Average votes per assumption: ${avgVotes.toFixed(2)}`);
```

## Troubleshooting

### Problem: Document lädt nicht
```javascript
// Check Repo Status
const repo = (window as any).__repo; // wenn exposed
console.log('Repo ready:', repo?.ready);

// Check Document Handle
const handle = repo?.find(documentId);
console.log('Handle:', handle);
console.log('Handle state:', await handle?.whenReady());
```

### Problem: Votes werden nicht aktualisiert
```javascript
// Check Vote Denormalization
const vote = __narrativeDoc.votes["vote-id"];
console.log('Vote voterName:', vote.voterName);
console.log('Identity displayName:', __narrativeDoc.identities[vote.voterDid]?.displayName);
// Sollten übereinstimmen!
```

### Problem: Tags fehlen
```javascript
// Check Tag References
const assumption = __narrativeDoc.assumptions["assumption-id"];
assumption.tagIds.forEach(tagId => {
  const tag = __narrativeDoc.tags[tagId];
  if (!tag) {
    console.error('Missing tag:', tagId);
  }
});
```

## Best Practices

1. **Nie die CRDT-Daten direkt mutieren** - immer über `docHandle.change()`
2. **Referenzen prüfen** - Stelle sicher, dass IDs in Arrays existieren
3. **Performance im Auge behalten** - Bei >1000 Votes/Assumptions könnte es langsam werden
4. **Backups machen** - Export Funktion vor großen Änderungen nutzen

## Weiterführende Tools

- **Automerge DevTools**: https://github.com/automerge/automerge-devtools
- **React DevTools**: https://react.dev/learn/react-developer-tools
- **Redux DevTools** (für State): https://github.com/reduxjs/redux-devtools

## Cleanup nach Debugging

**Vergiss nicht, Debug Code wieder zu entfernen:**
- Import von `debug.ts` aus `MainView.tsx` entfernen
- `exposeDocToConsole()` Aufrufe entfernen
- Optional: `debug.ts` Datei löschen oder in `.gitignore` eintragen