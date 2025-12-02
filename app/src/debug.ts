/**
 * Debug utilities for inspecting Narrative data structure
 * Import this in your component during development to expose data to console
 */

import { OpinionGraphDoc } from 'narrative-ui';

/**
 * Expose the document to the browser console for debugging
 * Call this from your component: exposeDocToConsole(doc)
 */
export function exposeDocToConsole(doc: OpinionGraphDoc | null) {
  if (typeof window !== 'undefined') {
    (window as any).__narrativeDoc = doc;
    console.log('📊 Narrative document exposed as window.__narrativeDoc');
    console.log('Try: __narrativeDoc.assumptions');
    console.log('Try: __narrativeDoc.votes');
    console.log('Try: __narrativeDoc.tags');
  }
}

/**
 * Pretty print document structure to console
 */
export function printDocStructure(doc: OpinionGraphDoc | null) {
  if (!doc) {
    console.log('❌ No document loaded');
    return;
  }

  console.group('📊 Narrative Document Structure');

  console.group('👤 Current Identity');
  console.log('DID:', doc.identity.did);
  console.log('Name:', doc.identity.displayName);
  console.groupEnd();

  console.group('👥 All Identities');
  console.table(doc.identities);
  console.groupEnd();

  console.group('💭 Assumptions (' + Object.keys(doc.assumptions).length + ')');
  Object.values(doc.assumptions).forEach(a => {
    console.log(`"${a.sentence}" by ${a.creatorName || a.createdBy}`);
    console.log(`  Tags: ${a.tagIds.length}, Votes: ${a.voteIds.length}, Edits: ${a.editLogIds.length}`);
  });
  console.groupEnd();

  console.group('🗳️  Votes (' + Object.keys(doc.votes).length + ')');
  console.table(Object.values(doc.votes).map(v => ({
    voter: v.voterName || v.voterDid.substring(0, 20),
    value: v.value,
    assumption: doc.assumptions[v.assumptionId]?.sentence.substring(0, 40)
  })));
  console.groupEnd();

  console.group('🏷️  Tags (' + Object.keys(doc.tags).length + ')');
  console.table(Object.values(doc.tags).map(t => ({
    name: t.name,
    creator: doc.identities[t.createdBy]?.displayName || t.createdBy.substring(0, 20)
  })));
  console.groupEnd();

  console.group('📝 Edit History (' + Object.keys(doc.edits).length + ')');
  Object.values(doc.edits)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(e => {
      const time = new Date(e.createdAt).toLocaleString();
      console.log(`[${e.type}] ${e.editorName || e.editorDid} at ${time}`);
      if (e.type === 'edit') {
        console.log(`  Old: "${e.previousSentence}"`);
        console.log(`  New: "${e.newSentence}"`);
      } else {
        console.log(`  Created: "${e.newSentence}"`);
      }
    });
  console.groupEnd();

  console.group('📊 Document Stats');
  console.log('Version:', doc.version);
  console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
  console.log('Total Assumptions:', Object.keys(doc.assumptions).length);
  console.log('Total Votes:', Object.keys(doc.votes).length);
  console.log('Total Tags:', Object.keys(doc.tags).length);
  console.log('Total Edits:', Object.keys(doc.edits).length);
  console.log('Total Users:', Object.keys(doc.identities).length);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
export function exportDocToJson(doc: OpinionGraphDoc | null) {
  if (!doc) {
    console.error('❌ No document to export');
    return;
  }

  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `narrative-doc-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Document exported to JSON file');
}

/**
 * Analyze vote patterns
 */
export function analyzeVotes(doc: OpinionGraphDoc | null) {
  if (!doc) return;

  console.group('🔍 Vote Analysis');

  const votesByUser = new Map<string, { green: number; yellow: number; red: number }>();

  Object.values(doc.votes).forEach(vote => {
    const name = vote.voterName || vote.voterDid;
    if (!votesByUser.has(name)) {
      votesByUser.set(name, { green: 0, yellow: 0, red: 0 });
    }
    const stats = votesByUser.get(name)!;
    stats[vote.value]++;
  });

  console.table(Array.from(votesByUser.entries()).map(([user, stats]) => ({
    user,
    '🟢 Agree': stats.green,
    '🟡 Neutral': stats.yellow,
    '🔴 Disagree': stats.red,
    total: stats.green + stats.yellow + stats.red
  })));

  console.groupEnd();
}

/**
 * Find all assumptions by a specific user
 */
export function findAssumptionsByUser(doc: OpinionGraphDoc | null, userDid: string) {
  if (!doc) return [];

  return Object.values(doc.assumptions)
    .filter(a => a.createdBy === userDid)
    .map(a => ({
      sentence: a.sentence,
      votes: a.voteIds.length,
      tags: a.tagIds.map(id => doc.tags[id]?.name).filter(Boolean)
    }));
}

/**
 * Trace all relationships for an assumption
 */
export function traceAssumption(doc: OpinionGraphDoc | null, assumptionId: string) {
  if (!doc) return;

  const assumption = doc.assumptions[assumptionId];
  if (!assumption) {
    console.error('❌ Assumption not found:', assumptionId);
    return;
  }

  console.group(`🔍 Tracing Assumption: "${assumption.sentence}"`);

  console.group('📌 Tags');
  assumption.tagIds.forEach(tagId => {
    const tag = doc.tags[tagId];
    if (tag) {
      console.log(`- ${tag.name} (created by ${tag.createdBy})`);
    }
  });
  console.groupEnd();

  console.group('🗳️  Votes');
  assumption.voteIds.forEach(voteId => {
    const vote = doc.votes[voteId];
    if (vote) {
      console.log(`- ${vote.value} by ${vote.voterName || vote.voterDid}`);
    }
  });
  console.groupEnd();

  console.group('📝 Edit History');
  assumption.editLogIds.forEach(editId => {
    const edit = doc.edits[editId];
    if (edit) {
      console.log(`- [${edit.type}] by ${edit.editorName || edit.editorDid}`);
      if (edit.type === 'edit') {
        console.log(`  "${edit.previousSentence}" → "${edit.newSentence}"`);
      }
    }
  });
  console.groupEnd();

  console.groupEnd();
}

// Make debug functions available in console
if (typeof window !== 'undefined') {
  (window as any).__narrativeDebug = {
    print: printDocStructure,
    export: exportDocToJson,
    analyze: analyzeVotes,
    trace: traceAssumption,
    findByUser: findAssumptionsByUser
  };

  console.log('🛠️  Narrative Debug Tools loaded!');
  console.log('Available commands:');
  console.log('  __narrativeDebug.print(doc)     - Print document structure');
  console.log('  __narrativeDebug.export(doc)    - Export document to JSON');
  console.log('  __narrativeDebug.analyze(doc)   - Analyze vote patterns');
  console.log('  __narrativeDebug.trace(doc, id) - Trace assumption relationships');
  console.log('  __narrativeDebug.findByUser(doc, did) - Find user\'s assumptions');
}