/**
 * NarrativeModuleWrapper - Connects NarrativeModule to Automerge document
 *
 * This wrapper handles:
 * - Converting UnifiedDocument to NarrativeModule props
 * - Providing mutation callbacks that update the Automerge doc
 * - Managing the module-specific data within the unified document
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { NarrativeModule } from 'narrative-app/modules';
import type { UserIdentity } from 'narrative-ui';
import { generateId, signEntity } from 'narrative-ui';
import type { UnifiedDocument } from '../types';
import type { Assumption, Vote, Tag, EditEntry, OpinionGraphData } from 'narrative-app/schema';

interface NarrativeModuleWrapperProps {
  doc: UnifiedDocument;
  docHandle: DocHandle<UnifiedDocument>;
  identity: UserIdentity;
  privateKey?: string;
  hiddenUserDids: Set<string>;
}

export function NarrativeModuleWrapper({
  doc,
  docHandle,
  identity,
  privateKey,
  hiddenUserDids,
}: NarrativeModuleWrapperProps) {
  const narrativeData = doc.data.narrative;

  // Ensure current user's publicKey is stored in identities for signature verification
  useEffect(() => {
    if (!docHandle || !identity.publicKey) return;

    const existingProfile = doc.identities?.[identity.did];
    if (existingProfile?.publicKey) return; // Already has publicKey

    docHandle.change((d) => {
      if (!d.identities[identity.did]) {
        d.identities[identity.did] = {};
      }
      if (!d.identities[identity.did].publicKey && identity.publicKey) {
        d.identities[identity.did].publicKey = identity.publicKey;
      }
      if (identity.displayName && !d.identities[identity.did].displayName) {
        d.identities[identity.did].displayName = identity.displayName;
      }
    });
  }, [docHandle, identity.did, identity.publicKey, identity.displayName, doc.identities]);

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

      const now = Date.now();
      const assumptionId = generateId();
      const editId = generateId();

      // Prepare data for signing (before change)
      const assumptionData: Assumption = {
        id: assumptionId,
        sentence,
        createdBy: identity.did,
        createdAt: now,
        updatedAt: now,
        tagIds: [], // Will be filled in change
        voteIds: [],
        editLogIds: [editId],
      };

      const editData: EditEntry = {
        id: editId,
        assumptionId,
        editorDid: identity.did,
        type: 'create',
        previousSentence: '',
        newSentence: sentence,
        newTags: [], // Will be filled in change
        createdAt: now,
      };

      // Sign entities if privateKey available
      if (privateKey) {
        assumptionData.signature = await signEntity(assumptionData as unknown as Record<string, unknown>, privateKey);
        editData.signature = await signEntity(editData as unknown as Record<string, unknown>, privateKey);
      }

      docHandle.change((d) => {
        if (!d.data.narrative) return;
        const data = d.data.narrative as OpinionGraphData;

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

        // Update tagIds in prepared data
        assumptionData.tagIds = tagIds;
        editData.newTags = tagIds;

        data.assumptions[assumptionId] = assumptionData;
        data.edits[editId] = editData;
        d.lastModified = now;
      });
    },
    [docHandle, identity.did, privateKey]
  );

  // Vote on assumption
  const handleVote = useCallback(
    async (assumptionId: string, value: 'green' | 'yellow' | 'red') => {
      if (!docHandle) return;

      const now = Date.now();

      // Check if user already has a vote on this assumption
      const existingVoteId = narrativeData?.assumptions[assumptionId]?.voteIds.find((vId: string) => {
        const vote = narrativeData?.votes[vId];
        return vote && vote.voterDid === identity.did;
      });

      if (existingVoteId) {
        // Update existing vote
        const existingVote = narrativeData?.votes[existingVoteId];
        if (!existingVote) return;

        const updatedVoteData: Vote = {
          ...existingVote,
          value,
          updatedAt: now,
        };

        // Sign updated vote
        if (privateKey) {
          updatedVoteData.signature = await signEntity(updatedVoteData as unknown as Record<string, unknown>, privateKey);
        }

        docHandle.change((d) => {
          if (!d.data.narrative) return;
          const vote = d.data.narrative.votes[existingVoteId];
          if (vote) {
            vote.value = value;
            vote.updatedAt = now;
            if (updatedVoteData.signature) {
              vote.signature = updatedVoteData.signature;
            }
          }
          d.lastModified = now;
        });
      } else {
        // Create new vote
        const voteId = generateId();
        const voteData: Vote = {
          id: voteId,
          assumptionId,
          voterDid: identity.did,
          value,
          createdAt: now,
          updatedAt: now,
        };

        // Sign new vote
        if (privateKey) {
          voteData.signature = await signEntity(voteData as unknown as Record<string, unknown>, privateKey);
        }

        docHandle.change((d) => {
          if (!d.data.narrative) return;
          const data = d.data.narrative as OpinionGraphData;
          const assumption = data.assumptions[assumptionId];
          if (!assumption) return;

          data.votes[voteId] = voteData;
          assumption.voteIds.push(voteId);
          d.lastModified = now;
        });
      }
    },
    [docHandle, identity.did, privateKey, narrativeData]
  );

  // Update assumption
  const handleUpdateAssumption = useCallback(
    async (id: string, sentence: string, tagNames: string[]) => {
      if (!docHandle || !narrativeData) return;

      const existingAssumption = narrativeData.assumptions[id];
      if (!existingAssumption) return;

      const now = Date.now();
      const editId = generateId();

      // Prepare edit entry for signing
      const editEntry: EditEntry = {
        id: editId,
        assumptionId: id,
        editorDid: identity.did,
        type: 'edit',
        previousSentence: existingAssumption.sentence,
        newSentence: sentence,
        previousTags: [...existingAssumption.tagIds],
        newTags: [], // Will be filled in change
        createdAt: now,
      };

      // Sign edit entry
      if (privateKey) {
        editEntry.signature = await signEntity(editEntry as unknown as Record<string, unknown>, privateKey);
      }

      docHandle.change((d) => {
        if (!d.data.narrative) return;
        const data = d.data.narrative as OpinionGraphData;

        const assumption = data.assumptions[id];
        if (!assumption) return;

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

        // Update edit entry with tag IDs
        editEntry.newTags = newTagIds;

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
    [docHandle, identity.did, privateKey, narrativeData]
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
        // Trust attestations are now in UserDocument, not workspace doc
        // TODO: Pass userDoc for full trust support
        trustGiven: {},
        trustReceived: {},
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
