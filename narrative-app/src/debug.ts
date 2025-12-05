/**
 * Narrative App - Debug Extensions
 *
 * App-specific debug tools that extend the central __narrative namespace.
 * These tools work with the automatically populated __doc (workspace document).
 *
 * Usage:
 *   __narrative.assumptions()   - List all assumptions
 *   __narrative.votes()         - Analyze vote patterns
 *   __narrative.trace(id)       - Trace assumption relationships
 */

import type { OpinionGraphDoc } from './schema/opinion-graph';
import type { NarrativeDebug } from 'narrative-ui';

// Narrative-specific debug extensions
interface NarrativeAppDebug extends NarrativeDebug {
  assumptions: () => void;
  votes: () => void;
  trace: (assumptionId: string) => void;
}

// Extend the global window type
declare global {
  interface Window {
    __narrative: NarrativeAppDebug;
    __doc: OpinionGraphDoc | null;
  }
}

/**
 * Helper to resolve DID to display name
 */
function resolveName(doc: OpinionGraphDoc, did: string): string {
  return doc.identities?.[did]?.displayName || did.substring(0, 20) + '...';
}

/**
 * Get the current workspace document as OpinionGraphDoc
 */
function getDoc(): OpinionGraphDoc | null {
  return window.__doc as OpinionGraphDoc | null;
}

/**
 * List all assumptions with their stats
 */
function listAssumptions(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  console.group(`💭 Assumptions (${Object.keys(doc.data.assumptions).length})`);

  const assumptions = Object.entries(doc.data.assumptions).map(([id, a]) => ({
    id: id.substring(0, 8) + '...',
    sentence: a.sentence.length > 50 ? a.sentence.substring(0, 50) + '...' : a.sentence,
    author: resolveName(doc, a.createdBy),
    votes: a.voteIds.length,
    tags: a.tagIds.length,
  }));

  console.table(assumptions);
  console.groupEnd();
}

/**
 * Analyze vote patterns per user
 */
function analyzeVotes(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  console.group('🗳️ Vote Analysis');

  const votesByUser = new Map<string, { green: number; yellow: number; red: number }>();

  Object.values(doc.data.votes).forEach((vote) => {
    const name = resolveName(doc, vote.voterDid);
    if (!votesByUser.has(name)) {
      votesByUser.set(name, { green: 0, yellow: 0, red: 0 });
    }
    const stats = votesByUser.get(name)!;
    stats[vote.value]++;
  });

  console.table(
    Array.from(votesByUser.entries()).map(([user, stats]) => ({
      user,
      '🟢 Agree': stats.green,
      '🟡 Neutral': stats.yellow,
      '🔴 Disagree': stats.red,
      total: stats.green + stats.yellow + stats.red,
    }))
  );

  console.groupEnd();
}

/**
 * Trace all relationships for an assumption
 */
function traceAssumption(assumptionId: string): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  // Find assumption by ID or partial ID
  let assumption = doc.data.assumptions[assumptionId];
  let foundId = assumptionId;

  if (!assumption) {
    // Try partial match
    const match = Object.entries(doc.data.assumptions).find(([id]) =>
      id.startsWith(assumptionId)
    );
    if (match) {
      [foundId, assumption] = match;
    }
  }

  if (!assumption) {
    console.error('❌ Assumption not found:', assumptionId);
    console.log('💡 Tip: Use __narrative.assumptions() to list all assumption IDs');
    return;
  }

  console.group(`🔍 Tracing: "${assumption.sentence}"`);
  console.log('ID:', foundId);
  console.log('Author:', resolveName(doc, assumption.createdBy));
  console.log('Created:', new Date(assumption.createdAt).toLocaleString());

  if (assumption.tagIds.length > 0) {
    console.group(`🏷️ Tags (${assumption.tagIds.length})`);
    assumption.tagIds.forEach((tagId) => {
      const tag = doc.data.tags[tagId];
      if (tag) {
        console.log(`- ${tag.name}`);
      }
    });
    console.groupEnd();
  }

  if (assumption.voteIds.length > 0) {
    console.group(`🗳️ Votes (${assumption.voteIds.length})`);
    const voteSummary = { green: 0, yellow: 0, red: 0 };
    assumption.voteIds.forEach((voteId) => {
      const vote = doc.data.votes[voteId];
      if (vote) {
        voteSummary[vote.value]++;
      }
    });
    console.log(`🟢 ${voteSummary.green}  🟡 ${voteSummary.yellow}  🔴 ${voteSummary.red}`);
    console.groupEnd();
  }

  if (assumption.editLogIds.length > 0) {
    console.group(`📝 Edit History (${assumption.editLogIds.length})`);
    assumption.editLogIds.forEach((editId) => {
      const edit = doc.data.edits[editId];
      if (edit) {
        const time = new Date(edit.createdAt).toLocaleString();
        if (edit.type === 'edit') {
          console.log(`[${time}] ${resolveName(doc, edit.editorDid)}: "${edit.previousSentence}" → "${edit.newSentence}"`);
        } else {
          console.log(`[${time}] ${resolveName(doc, edit.editorDid)}: Created`);
        }
      }
    });
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Initialize Narrative-specific debug extensions
 * Call this after the central debug tools are initialized
 */
export function initNarrativeDebug(): void {
  if (typeof window === 'undefined') return;

  // Wait for __narrative to be available
  const extend = () => {
    if (!window.__narrative) {
      setTimeout(extend, 100);
      return;
    }

    // Extend __narrative with app-specific functions
    window.__narrative.assumptions = listAssumptions;
    window.__narrative.votes = analyzeVotes;
    window.__narrative.trace = traceAssumption;

    console.log('📊 Narrative App debug extensions loaded:');
    console.log('  __narrative.assumptions()  - List all assumptions');
    console.log('  __narrative.votes()        - Analyze vote patterns');
    console.log('  __narrative.trace(id)      - Trace assumption relationships');
  };

  extend();
}

// Auto-initialize when imported
initNarrativeDebug();
