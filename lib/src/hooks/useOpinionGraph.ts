import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { DocHandle, DocumentId } from '@automerge/automerge-repo';
import {
  Assumption,
  OpinionGraphDoc,
  Vote,
  VoteValue,
  computeVoteSummary,
  generateId,
} from '../schema';

/**
 * Main hook for accessing and mutating Narrative data
 * Uses Automerge CRDT for automatic conflict resolution
 */
export function useOpinionGraph(
  docId: DocumentId,
  docHandle: DocHandle<OpinionGraphDoc>,
  currentUserDid: string
) {
  const [doc] = useDocument<OpinionGraphDoc>(docId);

  if (!doc) {
    return null;
  }

  // Convert normalized data to arrays for UI
  const assumptions = Object.values(doc.assumptions);
  const tags = Object.values(doc.tags);

  const findOrCreateTag = (d: OpinionGraphDoc, name: string): string => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return '';

    const existing = Object.values(d.tags).find(
      (tag) => tag.name.trim().toLowerCase() === normalized
    );
    if (existing) return existing.id;

    const tagId = generateId();
    d.tags[tagId] = {
      id: tagId,
      name: name.trim(),
      createdBy: currentUserDid,
      createdAt: Date.now(),
    };
    return tagId;
  };

  /**
   * Create a new assumption
   */
  const createAssumption = (sentence: string, tagNames: string[] = []) => {
    docHandle.change((d) => {
      const id = generateId();
      const tagIds = tagNames
        .map((tag) => findOrCreateTag(d, tag))
        .filter((tagId): tagId is string => !!tagId);

      const assumption: any = {
        id,
        sentence,
        createdBy: currentUserDid,
        creatorName: d.identities?.[currentUserDid]?.displayName || d.identity.displayName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tagIds,
        voteIds: [],
        editLogIds: [],
      };

      if (!d.edits) d.edits = {};
      const editId = generateId();
      d.edits[editId] = {
        id: editId,
        assumptionId: id,
        editorDid: currentUserDid,
        editorName: assumption.creatorName,
        type: 'create',
        previousSentence: '',
        newSentence: sentence,
        previousTags: [],
        newTags: tagNames,
        createdAt: Date.now(),
      };
      assumption.editLogIds.push(editId);
      // Note: Sorting is done on read (getEditsForAssumption) to avoid CRDT conflicts

      d.assumptions[id] = assumption;
      d.lastModified = Date.now();
    });
  };

  /**
   * Update an assumption
   */
  const updateAssumption = (assumptionId: string, newSentence: string, tagNames: string[] = []) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption) return;

      const trimmed = newSentence.trim();
      const newTagIds = tagNames
        .map((tag) => findOrCreateTag(d, tag))
        .filter((tagId): tagId is string => !!tagId);
      const currentTagIdsSorted = [...assumption.tagIds].sort().join('|');
      const newTagIdsSorted = [...newTagIds].sort().join('|');

      const sentenceChanged = trimmed && trimmed !== assumption.sentence;
      const tagsChanged = currentTagIdsSorted !== newTagIdsSorted;

      if (!sentenceChanged && !tagsChanged) return;

      if (!assumption.editLogIds) assumption.editLogIds = [];
      if (!d.edits) d.edits = {};

      const previousTagNames = assumption.tagIds
        .map((id) => d.tags[id])
        .filter((t): t is NonNullable<typeof d.tags[string]> => Boolean(t))
        .map((t) => t.name);

      // Update tagIds with minimal changes (avoid array replacement for better CRDT merging)
      const toRemove = assumption.tagIds.filter(id => !newTagIds.includes(id));
      const toAdd = newTagIds.filter(id => !assumption.tagIds.includes(id));

      toRemove.forEach(id => {
        const idx = assumption.tagIds.indexOf(id);
        if (idx !== -1) assumption.tagIds.splice(idx, 1);
      });
      toAdd.forEach(id => assumption.tagIds.push(id));

      const editId = generateId();
      const entry: any = {
        id: editId,
        assumptionId,
        editorDid: currentUserDid,
        previousSentence: assumption.sentence,
        newSentence: trimmed,
        createdAt: Date.now(),
        type: 'edit',
        previousTags: previousTagNames,
        newTags: tagNames,
      };

      const editorName =
        d.identities?.[currentUserDid]?.displayName || d.identity.displayName;
      if (editorName) {
        entry.editorName = editorName;
      }

      d.edits[editId] = entry;
      assumption.editLogIds.push(editId);

      assumption.sentence = trimmed;
      assumption.updatedAt = Date.now();
      d.lastModified = Date.now();
    });
  };

  /**
   * Delete an assumption
   */
  const deleteAssumption = (assumptionId: string) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption) return;

      // Delete associated votes
      assumption.voteIds.forEach((voteId) => {
        delete d.votes[voteId];
      });

      // Remove from document
      delete d.assumptions[assumptionId];
      d.lastModified = Date.now();
    });
  };

  /**
   * Set or update a vote on an assumption
   * Enforces one vote per user per assumption
   */
  const setVote = (assumptionId: string, value: VoteValue) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption) return;

      const voterName =
        d.identities?.[currentUserDid]?.displayName || d.identity.displayName;

      // Find existing vote by current user
      const existingVoteId = assumption.voteIds.find((voteId) => {
        const vote = d.votes[voteId];
        return vote && vote.voterDid === currentUserDid;
      });

      if (existingVoteId) {
        // Update existing vote
        const vote = d.votes[existingVoteId];
        if (vote) {
          vote.value = value;
          if (voterName) vote.voterName = voterName;
          vote.updatedAt = Date.now();
        }
      } else {
        // Create new vote
        const voteId = generateId();
        d.votes[voteId] = {
          id: voteId,
          assumptionId,
          voterDid: currentUserDid,
          voterName,
          value,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        assumption.voteIds.push(voteId);
      }

      d.lastModified = Date.now();
    });
  };

  /**
   * Remove current user's vote from an assumption
   */
  const removeVote = (assumptionId: string) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption) return;

      const voteIndex = assumption.voteIds.findIndex((voteId) => {
        const vote = d.votes[voteId];
        return vote && vote.voterDid === currentUserDid;
      });

      if (voteIndex !== -1) {
        const voteId = assumption.voteIds[voteIndex];
        delete d.votes[voteId];
        assumption.voteIds.splice(voteIndex, 1);
      }

      d.lastModified = Date.now();
    });
  };

  /**
   * Create a new tag
   */
  const createTag = (name: string, color?: string): string => {
    let tagId = '';
    docHandle.change((d) => {
      tagId = generateId();
      const tag: any = {
        id: tagId,
        name,
        createdBy: currentUserDid,
        createdAt: Date.now(),
      };

      // Only add color if provided (Automerge doesn't allow undefined)
      if (color !== undefined && color !== '') {
        tag.color = color;
      }

      d.tags[tagId] = tag;
      d.lastModified = Date.now();
    });
    return tagId;
  };

  /**
   * Add tag to assumption
   */
  const addTagToAssumption = (assumptionId: string, tagId: string) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption || !d.tags[tagId]) return;

      if (!assumption.tagIds.includes(tagId)) {
        assumption.tagIds.push(tagId);
      }
      d.lastModified = Date.now();
    });
  };

  /**
   * Remove tag from assumption
   */
  const removeTagFromAssumption = (assumptionId: string, tagId: string) => {
    docHandle.change((d) => {
      const assumption = d.assumptions[assumptionId];
      if (!assumption) return;

      const index = assumption.tagIds.indexOf(tagId);
      if (index !== -1) {
        assumption.tagIds.splice(index, 1);
      }
      d.lastModified = Date.now();
    });
  };

  /**
   * Get vote summary for an assumption
   */
  const getVoteSummary = (assumptionId: string) => {
    const assumption = doc.assumptions[assumptionId];
    if (!assumption) {
      return { green: 0, yellow: 0, red: 0, total: 0 };
    }
    return computeVoteSummary(assumption, doc.votes, currentUserDid);
  };

  /**
   * Get all votes for an assumption, sorted by most recent update
   */
  const getVotesForAssumption = (assumptionId: string) => {
    const assumption = doc.assumptions[assumptionId];
    if (!assumption) return [];

    return assumption.voteIds
      .map((id) => doc.votes[id])
      .filter((v): v is Vote => Boolean(v))
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  };

  /**
   * Get all edits for an assumption, sorted by newest first
   */
  const getEditsForAssumption = (assumptionId: string) => {
    const assumption = doc.assumptions[assumptionId];
    if (!assumption || !assumption.editLogIds) return [];

    return assumption.editLogIds
      .map((id) => doc.edits[id])
      .filter((e): e is NonNullable<typeof doc.edits[string]> => Boolean(e))
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  /**
   * Update user identity
   */
  const updateIdentity = (updates: Partial<Omit<typeof doc.identity, 'did'>>) => {
    docHandle.change((d) => {
      if (updates.displayName !== undefined) {
        if (!d.identities) d.identities = {};
        let profile = d.identities[currentUserDid];
        if (!profile) {
          d.identities[currentUserDid] = {};
          profile = d.identities[currentUserDid];
        }
        if (updates.displayName === '') {
          delete profile.displayName;
        } else {
          profile.displayName = updates.displayName;
        }
        // Propagate to current user's votes so name shows in logs/tooltips
        // NOTE: This is denormalization for display performance (avoids lookup on every vote render)
        // PERFORMANCE: O(n) where n = total votes. Could be slow with 1000s of votes.
        // TODO: Future optimization options:
        //   1. Create index: doc.votesByUser[did] = voteIds[] for O(1) lookup
        //   2. Remove denormalization: compute names on-read from doc.identities[did]
        Object.values(d.votes).forEach((vote) => {
          if (vote.voterDid === currentUserDid) {
            if (updates.displayName === '') {
              delete vote.voterName;
            } else {
              vote.voterName = updates.displayName;
            }
          }
        });
      }
      if (updates.avatarUrl !== undefined) {
        if (updates.avatarUrl === '') {
          delete d.identity.avatarUrl;
        } else {
          d.identity.avatarUrl = updates.avatarUrl;
        }
      }
      d.lastModified = Date.now();
    });
  };

  return {
    doc,
    docHandle,
    currentUserDid,
    assumptions,
    tags,
    // Mutations
    createAssumption,
    updateAssumption,
    deleteAssumption,
    setVote,
    removeVote,
    createTag,
    addTagToAssumption,
    removeTagFromAssumption,
    updateIdentity,
    // Helpers
    getVoteSummary,
    getVotesForAssumption,
    getEditsForAssumption,
  };
}

export type OpinionGraphHook = ReturnType<typeof useOpinionGraph>;
