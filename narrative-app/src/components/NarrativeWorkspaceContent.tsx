/**
 * NarrativeWorkspaceContent
 *
 * The workspace content that uses the Data Layer hooks.
 * This component is rendered inside DataProviderWrapper.
 */

import { useState } from 'react';
import { type AppContextValue, type UserDocument } from 'narrative-ui';
import type { OpinionGraphDoc } from '../schema/opinion-graph';
import { useNarrative } from '../hooks/useNarrative';
import { AssumptionList } from './AssumptionList';
import { CreateAssumptionModal } from './CreateAssumptionModal';
import { ImportModal } from './ImportModal';

interface NarrativeWorkspaceContentProps {
  currentUserDid: string;
  userDoc: UserDocument | undefined;
  ctx: AppContextValue;
  /** Workspace document for identity resolution and signature verification */
  doc: OpinionGraphDoc | undefined;
}

export function NarrativeWorkspaceContent({
  currentUserDid,
  userDoc,
  ctx,
  doc,
}: NarrativeWorkspaceContentProps) {
  // Use the new Data Layer hook
  const narrative = useNarrative(currentUserDid);

  // App-specific UI state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'agree' | 'recent' | 'created'>('created');
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [webOfTrustFilter, setWebOfTrustFilter] = useState(false);

  const handleImportAssumptions = async (importText: string) => {
    if (!narrative) return;

    const parsed = JSON.parse(importText || '[]');
    if (!Array.isArray(parsed)) throw new Error('JSON Array erwartet');

    for (const item of parsed) {
      const sentence = typeof item === 'string' ? item : item?.sentence;
      const tags =
        item && Array.isArray(item.tags)
          ? item.tags.filter((t: unknown) => typeof t === 'string')
          : [];

      if (sentence && typeof sentence === 'string') {
        await narrative.createAssumption(sentence, tags);
      }
    }
  };

  // If narrative is not available (no DataProvider), show nothing
  // AppLayout will show start screen or loading state
  if (!narrative) {
    return null;
  }

  // Wrapper functions that filter by hidden users
  const getFilteredVotesForAssumption = (assumptionId: string) => {
    const votes = narrative.getVotesForAssumption(assumptionId);
    return votes.filter((vote) => !ctx.hiddenUserDids.has(vote.voterDid));
  };

  const getFilteredEditsForAssumption = (assumptionId: string) => {
    const edits = narrative.getEditsForAssumption(assumptionId);
    return edits.filter((edit) => !ctx.hiddenUserDids.has(edit.editorDid));
  };

  const getFilteredVoteSummary = (assumptionId: string) => {
    const filteredVotes = getFilteredVotesForAssumption(assumptionId);
    const green = filteredVotes.filter((v) => v.value === 'green').length;
    const yellow = filteredVotes.filter((v) => v.value === 'yellow').length;
    const red = filteredVotes.filter((v) => v.value === 'red').length;
    const userVote = filteredVotes.find((v) => v.voterDid === currentUserDid)?.value;

    return {
      green,
      yellow,
      red,
      total: green + yellow + red,
      userVote,
    };
  };

  // Get last vote timestamp from relations
  const getLastVoteTs = (assumptionId: string) => {
    const votes = narrative.getVotesForAssumption(assumptionId);
    const filteredVotes = votes.filter((v) => !ctx.hiddenUserDids.has(v.voterDid));
    if (filteredVotes.length === 0) return 0;
    return Math.max(...filteredVotes.map((v) => v.updatedAt));
  };

  // Filter out assumptions from hidden users
  const withoutHidden = narrative.assumptions.filter(
    (a) => !ctx.hiddenUserDids.has(a.createdBy)
  );

  // Apply Web of Trust filter if active
  const withTrustFilter = webOfTrustFilter
    ? withoutHidden.filter((a) => {
        if (a.createdBy === currentUserDid) return true;
        if (!userDoc?.trustGiven) return false;
        return Object.values(userDoc.trustGiven).some(
          (att) => att.trusteeDid === a.createdBy
        );
      })
    : withoutHidden;

  // Filter by tag (using tag name as ID in new model)
  const filtered = activeTagFilter
    ? withTrustFilter.filter((a) =>
        a.tags.some((t) => t.toLowerCase() === activeTagFilter.toLowerCase())
      )
    : withTrustFilter;

  const sortedAssumptions = [...filtered].sort((a, b) => {
    const summaryA = getFilteredVoteSummary(a.id);
    const summaryB = getFilteredVoteSummary(b.id);

    const totalA = summaryA.total;
    const totalB = summaryB.total;
    const agreeRateA = totalA ? summaryA.green / totalA : 0;
    const agreeRateB = totalB ? summaryB.green / totalB : 0;
    const lastVoteA = getLastVoteTs(a.id);
    const lastVoteB = getLastVoteTs(b.id);

    if (sortBy === 'votes') {
      return totalB - totalA || agreeRateB - agreeRateA || lastVoteB - lastVoteA || b.createdAt - a.createdAt;
    }
    if (sortBy === 'agree') {
      return agreeRateB - agreeRateA || totalB - totalA || lastVoteB - lastVoteA || b.createdAt - a.createdAt;
    }
    if (sortBy === 'created') {
      return b.createdAt - a.createdAt || lastVoteB - lastVoteA || totalB - totalA;
    }
    // recent
    return lastVoteB - lastVoteA || totalB - totalA || agreeRateB - agreeRateA || b.createdAt - a.createdAt;
  });

  // Convert assumptions to the format expected by AssumptionList
  const assumptionsForList = sortedAssumptions.map((a) => ({
    id: a.id,
    sentence: a.sentence,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    tagIds: a.tags, // Use tags as tagIds for compatibility
    voteIds: [], // Not used by AssumptionList
    editLogIds: [], // Not used by AssumptionList
  }));

  return (
    <>
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="container mx-auto px-4 md:px-10 pt-6 md:pt-8 pb-24 max-w-6xl w-full">
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap gap-2 mt-3">
                {/* Web of Trust Filter */}
                <button
                  className={`badge gap-1 p-4 cursor-pointer transition-all ${
                    webOfTrustFilter
                      ? 'badge-success'
                      : 'badge-ghost border-base-300 hover:border-success'
                  }`}
                  onClick={() => setWebOfTrustFilter(!webOfTrustFilter)}
                  title={webOfTrustFilter ? 'Nur Web of Trust' : 'Alle Assumptions'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>{webOfTrustFilter ? 'Web of Trust' : 'Alle'}</span>
                </button>

                {/* Tag Filter */}
                {activeTagFilter && (
                  <div className="badge badge-primary gap-1 p-4 pr-1">
                    <span>{narrative.tags.find((t) => t.id === activeTagFilter)?.name ?? activeTagFilter}</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setActiveTagFilter(null)}
                      aria-label="Filter entfernen"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="form-control w-full md:w-64">
                  <div className="label py-0">
                    <span className="label-text">Sortieren nach</span>
                  </div>
                  <select
                    className="select select-bordered select-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  >
                    <option value="recent">Neuster Vote</option>
                    <option value="votes">Anzahl Votes</option>
                    <option value="agree">Zustimmung</option>
                    <option value="created">Neueste Annahme</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <AssumptionList
            assumptions={assumptionsForList}
            getVoteSummary={getFilteredVoteSummary}
            getVotesForAssumption={getFilteredVotesForAssumption}
            getEditsForAssumption={getFilteredEditsForAssumption}
            onVote={narrative.setVote}
            onEdit={(id, sentence, tagNames) => narrative.updateAssumption(id, sentence, tagNames)}
            tags={narrative.tags}
            onTagClick={(tagId) => setActiveTagFilter((prev) => (prev === tagId ? null : tagId))}
            currentUserId={currentUserDid}
            doc={doc}
            onCreate={() => setIsCreateModalOpen(true)}
          />
        </div>

        {/* Floating New Assumption Button */}
        <button
          className="btn btn-primary gap-2 fixed bottom-6 right-6 shadow-lg shadow-black/30"
          onClick={() => setIsCreateModalOpen(true)}
          title="New Assumption"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>New Assumption</span>
        </button>

        {/* Import Button */}
        <button
          className="btn btn-neutral gap-2 fixed bottom-6 left-6 shadow-lg shadow-black/30"
          onClick={() => setShowImportModal(true)}
          title="Import"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          Import
        </button>
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportAssumptions}
      />

      <CreateAssumptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={narrative.createAssumption}
        availableTags={narrative.tags}
      />
    </>
  );
}
