/**
 * Assumption Migration Helpers
 *
 * Konvertiert zwischen Legacy OpinionGraph-Daten und dem generischen Item/Relation-Modell.
 * Unterstützt Dual-Write Strategie: Lesen aus Items, Schreiben in beide.
 */

import type { Item, Relation } from '../types';

// Legacy Types (from narrative-app)
export interface LegacyAssumption {
  id: string;
  sentence: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
  voteIds: string[];
  editLogIds: string[];
  signature?: string;
}

export interface LegacyVote {
  id: string;
  assumptionId: string;
  voterDid: string;
  value: 'green' | 'yellow' | 'red';
  createdAt: number;
  updatedAt: number;
  signature?: string;
}

export interface LegacyTag {
  id: string;
  name: string;
  color?: string;
  createdBy: string;
  createdAt: number;
}

export interface LegacyEditEntry {
  id: string;
  assumptionId: string;
  editorDid: string;
  type: 'create' | 'edit';
  previousSentence: string;
  newSentence: string;
  previousTags?: string[];
  newTags?: string[];
  createdAt: number;
  signature?: string;
}

export interface LegacyOpinionGraphData {
  assumptions: Record<string, LegacyAssumption>;
  votes: Record<string, LegacyVote>;
  tags: Record<string, LegacyTag>;
  edits: Record<string, LegacyEditEntry>;
}

// Extension types for narrative module
export interface NarrativeExtension {
  editLog: Array<{
    id: string;
    editorDid: string;
    type: 'create' | 'edit';
    previousSentence: string;
    newSentence: string;
    previousTags?: string[];
    newTags?: string[];
    createdAt: number;
    signature?: string;
  }>;
  signature?: string;
}

export interface VoteRelationMetadata {
  value: 'green' | 'yellow' | 'red';
  signature?: string;
}

// =============================================================================
// Conversion: Legacy -> Items/Relations
// =============================================================================

/**
 * Convert a legacy Assumption to a generic Item
 */
export function assumptionToItem(
  assumption: LegacyAssumption,
  tags: Record<string, LegacyTag>,
  edits: Record<string, LegacyEditEntry>
): Item {
  // Convert tagIds to tag names
  const tagNames = assumption.tagIds
    .map((id) => tags[id]?.name)
    .filter((name): name is string => !!name);

  // Convert editLog entries
  const editLog = assumption.editLogIds
    .map((id) => edits[id])
    .filter((e): e is LegacyEditEntry => !!e)
    .map((e) => ({
      id: e.id,
      editorDid: e.editorDid,
      type: e.type,
      previousSentence: e.previousSentence,
      newSentence: e.newSentence,
      previousTags: e.previousTags,
      newTags: e.newTags,
      createdAt: e.createdAt,
      signature: e.signature,
    }));

  return {
    id: assumption.id,
    type: 'assumption',
    createdBy: assumption.createdBy,
    createdAt: assumption.createdAt,
    updatedAt: assumption.updatedAt,
    title: assumption.sentence,
    tags: tagNames,
    sharing: {
      visibility: 'shared',
      sharedWith: [],
    },
    extensions: {
      narrative: {
        editLog,
        signature: assumption.signature,
      } as NarrativeExtension,
    },
  };
}

/**
 * Convert a legacy Vote to a Relation
 */
export function voteToRelation(vote: LegacyVote): Relation {
  return {
    id: vote.id,
    subject: vote.voterDid,
    predicate: 'votes_on',
    object: vote.assumptionId,
    createdBy: vote.voterDid,
    createdAt: vote.createdAt,
    metadata: {
      value: vote.value,
      updatedAt: vote.updatedAt,
      signature: vote.signature,
    } as Record<string, unknown>,
  };
}

/**
 * Migrate all legacy data to Items and Relations
 */
export function migrateLegacyData(data: LegacyOpinionGraphData): {
  items: Item[];
  relations: Relation[];
} {
  const items: Item[] = [];
  const relations: Relation[] = [];

  // Convert assumptions to items
  for (const assumption of Object.values(data.assumptions)) {
    items.push(assumptionToItem(assumption, data.tags, data.edits));
  }

  // Convert votes to relations
  for (const vote of Object.values(data.votes)) {
    relations.push(voteToRelation(vote));
  }

  return { items, relations };
}

// =============================================================================
// Conversion: Items/Relations -> Legacy
// =============================================================================

/**
 * Convert an Item back to a legacy Assumption (for dual-write)
 */
export function itemToAssumption(
  item: Item,
  existingTags: Record<string, LegacyTag>,
  existingEdits: Record<string, LegacyEditEntry>,
  existingVoteIds: string[]
): { assumption: LegacyAssumption; newTags: LegacyTag[]; newEdits: LegacyEditEntry[] } {
  const newTags: LegacyTag[] = [];
  const newEdits: LegacyEditEntry[] = [];
  const tagIds: string[] = [];

  // Find or create tags
  for (const tagName of item.tags || []) {
    const existingTag = Object.values(existingTags).find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase()
    );
    if (existingTag) {
      tagIds.push(existingTag.id);
    } else {
      // Create new tag
      const newTag: LegacyTag = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tagName,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
      };
      newTags.push(newTag);
      tagIds.push(newTag.id);
    }
  }

  // Extract edit log from extensions
  const narrativeExt = item.extensions?.narrative as NarrativeExtension | undefined;
  const editLogIds: string[] = [];

  if (narrativeExt?.editLog) {
    for (const entry of narrativeExt.editLog) {
      if (!existingEdits[entry.id]) {
        const newEdit: LegacyEditEntry = {
          id: entry.id,
          assumptionId: item.id,
          editorDid: entry.editorDid,
          type: entry.type,
          previousSentence: entry.previousSentence,
          newSentence: entry.newSentence,
          previousTags: entry.previousTags,
          newTags: entry.newTags,
          createdAt: entry.createdAt,
          signature: entry.signature,
        };
        newEdits.push(newEdit);
      }
      editLogIds.push(entry.id);
    }
  }

  const assumption: LegacyAssumption = {
    id: item.id,
    sentence: item.title || '',
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tagIds,
    voteIds: existingVoteIds,
    editLogIds,
    signature: narrativeExt?.signature,
  };

  return { assumption, newTags, newEdits };
}

/**
 * Convert a Relation back to a legacy Vote (for dual-write)
 */
export function relationToVote(relation: Relation): LegacyVote | null {
  if (relation.predicate !== 'votes_on') {
    return null;
  }

  const metadata = relation.metadata as unknown as VoteRelationMetadata & { updatedAt?: number } | undefined;
  if (!metadata?.value) {
    return null;
  }

  return {
    id: relation.id,
    assumptionId: relation.object,
    voterDid: relation.subject,
    value: metadata.value,
    createdAt: relation.createdAt,
    updatedAt: metadata.updatedAt || relation.createdAt,
    signature: metadata.signature,
  };
}

// =============================================================================
// Helper functions for reading/writing
// =============================================================================

/**
 * Get vote value from relations for a specific user and assumption
 */
export function getVoteFromRelations(
  relations: Relation[],
  assumptionId: string,
  voterDid: string
): 'green' | 'yellow' | 'red' | null {
  const voteRelation = relations.find(
    (r) =>
      r.predicate === 'votes_on' &&
      r.object === assumptionId &&
      r.subject === voterDid
  );

  if (!voteRelation?.metadata) return null;
  const metadata = voteRelation.metadata as unknown as VoteRelationMetadata;
  return metadata.value || null;
}

/**
 * Get all votes for an assumption from relations
 */
export function getVotesForAssumptionFromRelations(
  relations: Relation[],
  assumptionId: string
): Array<{ voterDid: string; value: 'green' | 'yellow' | 'red'; updatedAt: number }> {
  return relations
    .filter((r) => r.predicate === 'votes_on' && r.object === assumptionId)
    .map((r) => {
      const metadata = r.metadata as unknown as VoteRelationMetadata & { updatedAt?: number } | undefined;
      return {
        voterDid: r.subject,
        value: metadata?.value || 'yellow',
        updatedAt: metadata?.updatedAt || r.createdAt,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Compute vote summary from relations
 */
export function computeVoteSummaryFromRelations(
  relations: Relation[],
  assumptionId: string,
  currentUserDid?: string
): {
  green: number;
  yellow: number;
  red: number;
  total: number;
  userVote?: 'green' | 'yellow' | 'red';
} {
  const votes = getVotesForAssumptionFromRelations(relations, assumptionId);

  const summary = {
    green: 0,
    yellow: 0,
    red: 0,
    total: votes.length,
    userVote: undefined as 'green' | 'yellow' | 'red' | undefined,
  };

  for (const vote of votes) {
    if (vote.value === 'green') summary.green++;
    else if (vote.value === 'yellow') summary.yellow++;
    else if (vote.value === 'red') summary.red++;

    if (currentUserDid && vote.voterDid === currentUserDid) {
      summary.userVote = vote.value;
    }
  }

  return summary;
}
