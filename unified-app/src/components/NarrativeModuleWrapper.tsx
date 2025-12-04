/**
 * NarrativeModuleWrapper - Connects NarrativeModule to Automerge document
 *
 * This wrapper handles:
 * - Converting UnifiedDocument to NarrativeModule props
 * - Providing mutation callbacks that update the Automerge doc
 * - Managing the module-specific data within the unified document
 */

import { useCallback, useMemo } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { NarrativeModule } from 'narrative-app/modules';
import type { UserIdentity } from 'narrative-ui';
import { generateId } from 'narrative-ui';
import type { UnifiedDocument } from '../types';
import type { Assumption, Vote, Tag, EditEntry, OpinionGraphData } from 'narrative-app/schema';

interface NarrativeModuleWrapperProps {
  doc: UnifiedDocument;
  docHandle: DocHandle<UnifiedDocument>;
  identity: UserIdentity;
  hiddenUserDids: Set<string>;
}

export function NarrativeModuleWrapper({
  doc,
  docHandle,
  identity,
  hiddenUserDids,
}: NarrativeModuleWrapperProps) {
  const narrativeData = doc.data.narrative;

  // Get all assumptions as array
  const assumptions = useMemo((): Assumption[] => {
    if (!narrativeData) return [];
    return Object.values(narrativeData.assumptions) as Assumption[];
  }, [narrativeData]);

  // Get all tags as array
  const tags = useMemo((): Tag[] => {
    if (!narrativeData) return [];
    return Object.values(narrativeData.tags) as Tag[];
  }, [narrativeData]);

  // Create new assumption
  const handleCreateAssumption = useCallback(
    async (sentence: string, tagNames: string[]) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.narrative) return;
        const data = d.data.narrative as OpinionGraphData;

        const now = Date.now();

        // Create or find tags
        const tagIds: string[] = [];
        for (const tagName of tagNames) {
          const existingTag = (Object.values(data.tags) as Tag[]).find(
            (t: Tag) => t.name.toLowerCase() === tagName.toLowerCase()
          );

          if (existingTag) {
            tagIds.push(existingTag.id);
          } else {
            const newTag: Tag = {
              id: generateId(),
              name: tagName,
              createdBy: identity.did,
              createdAt: now,
            };
            data.tags[newTag.id] = newTag;
            tagIds.push(newTag.id);
          }
        }

        // Create assumption
        const assumptionId = generateId();
        const editId = generateId();

        const editEntry: EditEntry = {
          id: editId,
          assumptionId,
          editorDid: identity.did,
          type: 'create',
          previousSentence: '',
          newSentence: sentence,
          newTags: tagIds,
          createdAt: now,
        };

        const assumption: Assumption = {
          id: assumptionId,
          sentence,
          createdBy: identity.did,
          createdAt: now,
          updatedAt: now,
          tagIds,
          voteIds: [],
          editLogIds: [editId],
        };

        data.assumptions[assumptionId] = assumption;
        data.edits[editId] = editEntry;
        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Vote on assumption
  const handleVote = useCallback(
    async (assumptionId: string, value: 'green' | 'yellow' | 'red') => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.narrative) return;
        const data = d.data.narrative as OpinionGraphData;

        const assumption = data.assumptions[assumptionId];
        if (!assumption) return;

        const now = Date.now();

        // Find existing vote from this user
        const existingVoteId = assumption.voteIds.find((vId: string) => {
          const vote = data.votes[vId];
          return vote && vote.voterDid === identity.did;
        });

        if (existingVoteId) {
          // Update existing vote
          const vote = data.votes[existingVoteId];
          if (vote) {
            vote.value = value;
            vote.updatedAt = now;
          }
        } else {
          // Create new vote
          const voteId = generateId();
          const vote: Vote = {
            id: voteId,
            assumptionId,
            voterDid: identity.did,
            value,
            createdAt: now,
            updatedAt: now,
          };

          data.votes[voteId] = vote;
          assumption.voteIds.push(voteId);
        }

        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Update assumption
  const handleUpdateAssumption = useCallback(
    (id: string, sentence: string, tagNames: string[]) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.narrative) return;
        const data = d.data.narrative as OpinionGraphData;

        const assumption = data.assumptions[id];
        if (!assumption) return;

        const now = Date.now();

        // Create or find tags
        const newTagIds: string[] = [];
        for (const tagName of tagNames) {
          const existingTag = (Object.values(data.tags) as Tag[]).find(
            (t: Tag) => t.name.toLowerCase() === tagName.toLowerCase()
          );

          if (existingTag) {
            newTagIds.push(existingTag.id);
          } else {
            const newTag: Tag = {
              id: generateId(),
              name: tagName,
              createdBy: identity.did,
              createdAt: now,
            };
            data.tags[newTag.id] = newTag;
            newTagIds.push(newTag.id);
          }
        }

        // Create edit entry
        const editId = generateId();
        const editEntry: EditEntry = {
          id: editId,
          assumptionId: id,
          editorDid: identity.did,
          type: 'edit',
          previousSentence: assumption.sentence,
          newSentence: sentence,
          previousTags: [...assumption.tagIds],
          newTags: newTagIds,
          createdAt: now,
        };

        data.edits[editId] = editEntry;
        assumption.editLogIds.push(editId);

        // Update assumption - use granular operations for tags
        assumption.sentence = sentence;
        assumption.updatedAt = now;

        // Update tagIds granularly (Automerge best practice)
        const toRemove = assumption.tagIds.filter((tid: string) => !newTagIds.includes(tid));
        const toAdd = newTagIds.filter((tid: string) => !assumption.tagIds.includes(tid));

        toRemove.forEach((tid: string) => {
          const idx = assumption.tagIds.indexOf(tid);
          if (idx !== -1) assumption.tagIds.splice(idx, 1);
        });
        toAdd.forEach((tid: string) => assumption.tagIds.push(tid));

        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Get vote summary for an assumption
  const getVoteSummary = useCallback(
    (assumptionId: string) => {
      if (!narrativeData) {
        return { green: 0, yellow: 0, red: 0, total: 0 };
      }

      const assumption = narrativeData.assumptions[assumptionId];
      if (!assumption) {
        return { green: 0, yellow: 0, red: 0, total: 0 };
      }

      const summary = { green: 0, yellow: 0, red: 0, total: 0, userVote: undefined as 'green' | 'yellow' | 'red' | undefined };

      for (const voteId of assumption.voteIds) {
        const vote = narrativeData.votes[voteId];
        if (!vote) continue;

        // Skip hidden users
        if (hiddenUserDids.has(vote.voterDid)) continue;

        if (vote.value === 'green') summary.green++;
        else if (vote.value === 'yellow') summary.yellow++;
        else if (vote.value === 'red') summary.red++;

        summary.total++;

        if (vote.voterDid === identity.did) {
          summary.userVote = vote.value;
        }
      }

      return summary;
    },
    [narrativeData, identity.did, hiddenUserDids]
  );

  // Get votes for an assumption
  const getVotesForAssumption = useCallback(
    (assumptionId: string): Vote[] => {
      if (!narrativeData) return [];

      const assumption = narrativeData.assumptions[assumptionId];
      if (!assumption) return [];

      return assumption.voteIds
        .map((vId: string) => narrativeData.votes[vId])
        .filter((v: Vote | undefined): v is Vote => v !== undefined)
        .filter((v: Vote) => !hiddenUserDids.has(v.voterDid));
    },
    [narrativeData, hiddenUserDids]
  );

  // Get edits for an assumption
  const getEditsForAssumption = useCallback(
    (assumptionId: string): EditEntry[] => {
      if (!narrativeData) return [];

      const assumption = narrativeData.assumptions[assumptionId];
      if (!assumption) return [];

      return assumption.editLogIds
        .map((eId: string) => narrativeData.edits[eId])
        .filter((e: EditEntry | undefined): e is EditEntry => e !== undefined);
    },
    [narrativeData]
  );

  if (!narrativeData) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Narrative Module</h2>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <NarrativeModule
      data={narrativeData}
      onChange={() => {}} // Reserved for future direct data mutations
      context={{
        currentUserDid: identity.did,
        identities: doc.identities,
        trustAttestations: doc.trustAttestations,
      }}
      onCreateAssumption={handleCreateAssumption}
      onVote={handleVote}
      onUpdateAssumption={handleUpdateAssumption}
      getVoteSummary={getVoteSummary}
      getVotesForAssumption={getVotesForAssumption}
      getEditsForAssumption={getEditsForAssumption}
      tags={tags}
      assumptions={assumptions}
      hiddenUserDids={hiddenUserDids}
    />
  );
}
