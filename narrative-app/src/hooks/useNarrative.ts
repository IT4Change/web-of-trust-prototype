/**
 * useNarrative Hook
 *
 * Neuer Hook basierend auf dem Data Layer (useItems + useRelations).
 * Bietet die gleiche API wie useOpinionGraph für einfache Migration.
 *
 * Dieser Hook ist der Migrations-Pfad von useOpinionGraph zum Data Layer.
 * Er liest aus dem neuen Item/Relation-Modell und kann optional in
 * beide Strukturen schreiben (Dual-Write für Rückwärtskompatibilität).
 */

import { useCallback, useMemo } from 'react';
import {
  useItems,
  useRelations,
  useItemMutations,
  useRelationMutations,
  useDataProviderOptional,
  type NarrativeExtension,
  computeVoteSummaryFromRelations,
  getVotesForAssumptionFromRelations,
} from 'narrative-ui';
import type { VoteValue } from '../schema/opinion-graph';

// Types for the hook result
export interface NarrativeAssumption {
  id: string;
  sentence: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tagIds: string[]; // Kept for backward compatibility, contains tag names
  tags: string[];   // Tag names
}

export interface NarrativeVoteSummary {
  green: number;
  yellow: number;
  red: number;
  total: number;
  userVote?: VoteValue;
}

export interface NarrativeVote {
  id: string;
  assumptionId: string;
  voterDid: string;
  value: VoteValue;
  createdAt: number;
  updatedAt: number;
}

export interface NarrativeEditEntry {
  id: string;
  assumptionId: string;
  editorDid: string;
  type: 'create' | 'edit';
  previousSentence: string;
  newSentence: string;
  previousTags?: string[];
  newTags?: string[];
  createdAt: number;
}

export interface NarrativeTag {
  id: string;
  name: string;
  color?: string;
  createdBy: string;
  createdAt: number;
}

export interface UseNarrativeResult {
  // Data
  assumptions: NarrativeAssumption[];
  tags: NarrativeTag[];
  currentUserDid: string;
  isLoading: boolean;

  // Mutations
  createAssumption: (sentence: string, tagNames?: string[]) => Promise<void>;
  updateAssumption: (assumptionId: string, newSentence: string, tagNames?: string[]) => Promise<void>;
  deleteAssumption: (assumptionId: string) => Promise<void>;
  setVote: (assumptionId: string, value: VoteValue) => Promise<void>;
  removeVote: (assumptionId: string) => Promise<void>;
  createTag: (name: string, color?: string) => string;
  updateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;

  // Helpers
  getVoteSummary: (assumptionId: string) => NarrativeVoteSummary;
  getVotesForAssumption: (assumptionId: string) => NarrativeVote[];
  getEditsForAssumption: (assumptionId: string) => NarrativeEditEntry[];
}

/**
 * useNarrative - Data Layer based hook for Narrative app
 *
 * Replaces useOpinionGraph with a cleaner interface based on Items and Relations.
 */
export function useNarrative(currentUserDid: string): UseNarrativeResult | null {
  const dataProvider = useDataProviderOptional();

  // Get items and relations from Data Layer
  // Hooks must be called unconditionally
  const itemsResult = useItems({ type: 'assumption' });
  const relationsResult = useRelations({ predicate: 'votes_on' });
  const itemMutations = useItemMutations();
  const relationMutations = useRelationMutations();

  // Extract values
  const allItems = itemsResult.items;
  const itemsLoading = itemsResult.isLoading;
  const allRelations = relationsResult.relations;
  const relationsLoading = relationsResult.isLoading;
  const createItem = itemMutations.create;
  const updateItem = itemMutations.update;
  const deleteItem = itemMutations.remove;
  const createRelation = relationMutations.create;
  const deleteRelation = relationMutations.remove;

  const isLoading = itemsLoading || relationsLoading;

  // Convert Items to NarrativeAssumptions
  const assumptions: NarrativeAssumption[] = useMemo(() => {
    if (!dataProvider) return [];
    return allItems.map((item) => ({
      id: item.id,
      sentence: item.title || '',
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tagIds: item.tags || [], // For backward compatibility
      tags: item.tags || [],
    }));
  }, [allItems, dataProvider]);

  // Extract unique tags from all items
  const tags: NarrativeTag[] = useMemo(() => {
    if (!dataProvider) return [];
    const tagMap = new Map<string, NarrativeTag>();

    for (const item of allItems) {
      for (const tagName of item.tags || []) {
        if (!tagMap.has(tagName.toLowerCase())) {
          tagMap.set(tagName.toLowerCase(), {
            id: tagName.toLowerCase(), // Use name as ID
            name: tagName,
            createdBy: item.createdBy,
            createdAt: item.createdAt,
          });
        }
      }
    }

    return Array.from(tagMap.values());
  }, [allItems, dataProvider]);

  // Create assumption
  const createAssumption = useCallback(
    async (sentence: string, tagNames: string[] = []) => {
      if (!dataProvider) return;
      const now = Date.now();
      const editEntry = {
        id: `edit-${now}-${Math.random().toString(36).substr(2, 9)}`,
        editorDid: currentUserDid,
        type: 'create' as const,
        previousSentence: '',
        newSentence: sentence,
        previousTags: [],
        newTags: tagNames,
        createdAt: now,
      };

      await createItem({
        type: 'assumption',
        createdBy: currentUserDid,
        title: sentence,
        tags: tagNames,
        sharing: {
          visibility: 'shared',
          sharedWith: [],
        },
        extensions: {
          narrative: {
            editLog: [editEntry],
          } as NarrativeExtension,
        },
      });
    },
    [createItem, currentUserDid, dataProvider]
  );

  // Update assumption
  const updateAssumption = useCallback(
    async (assumptionId: string, newSentence: string, tagNames: string[] = []) => {
      if (!dataProvider) return;
      const item = allItems.find((i) => i.id === assumptionId);
      if (!item) return;

      const now = Date.now();
      const narrativeExt = item.extensions?.narrative as NarrativeExtension | undefined;
      const editLog = narrativeExt?.editLog || [];

      const editEntry = {
        id: `edit-${now}-${Math.random().toString(36).substr(2, 9)}`,
        editorDid: currentUserDid,
        type: 'edit' as const,
        previousSentence: item.title || '',
        newSentence,
        previousTags: item.tags,
        newTags: tagNames,
        createdAt: now,
      };

      await updateItem(assumptionId, {
        title: newSentence,
        tags: tagNames,
        extensions: {
          ...item.extensions,
          narrative: {
            ...narrativeExt,
            editLog: [...editLog, editEntry],
          } as NarrativeExtension,
        },
      });
    },
    [updateItem, allItems, currentUserDid, dataProvider]
  );

  // Delete assumption
  const deleteAssumption = useCallback(
    async (assumptionId: string) => {
      if (!dataProvider) return;
      // Delete associated vote relations
      const voteRelations = allRelations.filter(
        (r) => r.predicate === 'votes_on' && r.object === assumptionId
      );
      for (const relation of voteRelations) {
        await deleteRelation(relation.id);
      }

      // Delete the item
      await deleteItem(assumptionId);
    },
    [deleteItem, deleteRelation, allRelations, dataProvider]
  );

  // Set vote
  const setVote = useCallback(
    async (assumptionId: string, value: VoteValue) => {
      if (!dataProvider) return;
      // Find existing vote relation
      const existingVote = allRelations.find(
        (r) =>
          r.predicate === 'votes_on' &&
          r.object === assumptionId &&
          r.subject === currentUserDid
      );

      if (existingVote) {
        // Delete old vote and create new one (relations are immutable)
        await deleteRelation(existingVote.id);
      }

      // Create new vote relation
      await createRelation({
        subject: currentUserDid,
        predicate: 'votes_on',
        object: assumptionId,
        createdBy: currentUserDid,
        metadata: {
          value,
          updatedAt: Date.now(),
        },
      });
    },
    [createRelation, deleteRelation, allRelations, currentUserDid, dataProvider]
  );

  // Remove vote
  const removeVote = useCallback(
    async (assumptionId: string) => {
      if (!dataProvider) return;
      const existingVote = allRelations.find(
        (r) =>
          r.predicate === 'votes_on' &&
          r.object === assumptionId &&
          r.subject === currentUserDid
      );

      if (existingVote) {
        await deleteRelation(existingVote.id);
      }
    },
    [deleteRelation, allRelations, currentUserDid, dataProvider]
  );

  // Create tag (no-op in new model, tags are just strings)
  const createTag = useCallback(
    (name: string, _color?: string): string => {
      // In the new model, tags are just strings stored on items
      // This is a no-op, but we return the tag name as ID for compatibility
      return name.toLowerCase();
    },
    []
  );

  // Update identity (delegate to identity provider)
  const updateIdentity = useCallback(
    (updates: { displayName?: string; avatarUrl?: string }) => {
      if (!dataProvider) return;
      dataProvider.identity.updateProfile(updates);
    },
    [dataProvider]
  );

  // Get vote summary
  const getVoteSummary = useCallback(
    (assumptionId: string): NarrativeVoteSummary => {
      return computeVoteSummaryFromRelations(allRelations, assumptionId, currentUserDid);
    },
    [allRelations, currentUserDid]
  );

  // Get votes for assumption
  const getVotesForAssumption = useCallback(
    (assumptionId: string): NarrativeVote[] => {
      const votes = getVotesForAssumptionFromRelations(allRelations, assumptionId);

      return votes.map((v) => {
        const relation = allRelations.find(
          (r) =>
            r.predicate === 'votes_on' &&
            r.object === assumptionId &&
            r.subject === v.voterDid
        );

        return {
          id: relation?.id || `vote-${v.voterDid}-${assumptionId}`,
          assumptionId,
          voterDid: v.voterDid,
          value: v.value,
          createdAt: relation?.createdAt || v.updatedAt,
          updatedAt: v.updatedAt,
        };
      });
    },
    [allRelations]
  );

  // Get edits for assumption
  const getEditsForAssumption = useCallback(
    (assumptionId: string): NarrativeEditEntry[] => {
      const item = allItems.find((i) => i.id === assumptionId);
      if (!item) return [];

      const narrativeExt = item.extensions?.narrative as NarrativeExtension | undefined;
      const editLog = narrativeExt?.editLog || [];

      return editLog
        .map((e) => ({
          id: e.id,
          assumptionId,
          editorDid: e.editorDid,
          type: e.type,
          previousSentence: e.previousSentence,
          newSentence: e.newSentence,
          previousTags: e.previousTags,
          newTags: e.newTags,
          createdAt: e.createdAt,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    [allItems]
  );

  // Return null if data provider not available (check at the end)
  if (!dataProvider) {
    return null;
  }

  return {
    assumptions,
    tags,
    currentUserDid,
    isLoading,
    createAssumption,
    updateAssumption,
    deleteAssumption,
    setVote,
    removeVote,
    createTag,
    updateIdentity,
    getVoteSummary,
    getVotesForAssumption,
    getEditsForAssumption,
  };
}
