/**
 * NarrativeModule - Reusable module component for assumption tracking
 *
 * This is a pure UI component that receives data and callbacks via props.
 * It can be used standalone or integrated into a unified multi-module app.
 */

import { useMemo, useState } from 'react';
import type { ModuleProps } from 'narrative-ui';
import { AssumptionList } from '../components/AssumptionList';
import { CreateAssumptionModal } from '../components/CreateAssumptionModal';
import { ImportModal } from '../components/ImportModal';
import type { OpinionGraphData, Assumption, Vote, Tag, EditEntry } from '../schema/opinion-graph';

/**
 * Extended props for NarrativeModule
 * Includes module-specific callbacks beyond the standard ModuleProps
 */
export interface NarrativeModuleProps extends ModuleProps<OpinionGraphData> {
  /** Callback to create a new assumption */
  onCreateAssumption: (sentence: string, tagNames: string[]) => Promise<void>;
  /** Callback to set a vote */
  onVote: (assumptionId: string, value: 'green' | 'yellow' | 'red') => Promise<void>;
  /** Callback to update an assumption */
  onUpdateAssumption: (id: string, sentence: string, tagNames: string[]) => void;
  /** Get vote summary for an assumption */
  getVoteSummary: (assumptionId: string) => {
    green: number;
    yellow: number;
    red: number;
    total: number;
    userVote?: 'green' | 'yellow' | 'red';
  };
  /** Get votes for an assumption */
  getVotesForAssumption: (assumptionId: string) => Vote[];
  /** Get edits for an assumption */
  getEditsForAssumption: (assumptionId: string) => EditEntry[];
  /** All tags */
  tags: Tag[];
  /** All assumptions (already sorted/filtered by parent) */
  assumptions: Assumption[];
  /** Hidden user DIDs for filtering */
  hiddenUserDids?: Set<string>;
}

/**
 * NarrativeModule Component
 *
 * Displays the assumption list with voting, filtering, and sorting capabilities.
 * This component is designed to work both standalone and within a unified app.
 */
export function NarrativeModule({
  data,
  // onChange reserved for future direct data mutations
  context,
  onCreateAssumption,
  onVote,
  onUpdateAssumption,
  getVoteSummary,
  getVotesForAssumption,
  getEditsForAssumption,
  tags,
  assumptions,
  hiddenUserDids = new Set(),
}: NarrativeModuleProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'agree' | 'recent' | 'created'>('created');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [webOfTrustFilter, setWebOfTrustFilter] = useState(false);

  const { currentUserDid, trustAttestations } = context;

  // Apply filters and sorting
  const sortedAssumptions = useMemo(() => {
    const getLastVoteTs = (assumptionId: string) => {
      const votes = data.votes;
      return (
        data.assumptions[assumptionId]?.voteIds
          .map((id) => votes[id])
          .filter((v): v is Vote => Boolean(v))
          .filter((v) => !hiddenUserDids.has(v.voterDid))
          .reduce((latest, vote) => Math.max(latest, vote.updatedAt ?? vote.createdAt), 0) || 0
      );
    };

    // Filter out assumptions from hidden users
    const withoutHidden = assumptions.filter(
      (a) => !hiddenUserDids.has(a.createdBy)
    );

    // Apply Web of Trust filter if active
    const withTrustFilter = webOfTrustFilter
      ? withoutHidden.filter((a) => {
          if (a.createdBy === currentUserDid) return true;
          const trustAttestation = trustAttestations
            ? Object.values(trustAttestations).find(
                (att) => att.trusterDid === currentUserDid && att.trusteeDid === a.createdBy
              )
            : undefined;
          return trustAttestation !== undefined;
        })
      : withoutHidden;

    // Apply tag filter
    const filtered = activeTagFilter
      ? withTrustFilter.filter((a) => a.tagIds.includes(activeTagFilter))
      : withTrustFilter;

    // Sort
    return [...filtered].sort((a, b) => {
      const summaryA = getVoteSummary(a.id);
      const summaryB = getVoteSummary(b.id);

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
  }, [assumptions, sortBy, activeTagFilter, webOfTrustFilter, hiddenUserDids, currentUserDid, trustAttestations, data, getVoteSummary]);

  const handleImportAssumptions = async (importText: string) => {
    const parsed = JSON.parse(importText || '[]');
    if (!Array.isArray(parsed)) throw new Error('JSON Array erwartet');

    for (const item of parsed) {
      const sentence = typeof item === 'string' ? item : item?.sentence;
      const tagList =
        item && Array.isArray(item.tags)
          ? item.tags.filter((t: unknown) => typeof t === 'string')
          : [];

      if (sentence && typeof sentence === 'string') {
        await onCreateAssumption(sentence, tagList);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter & Sort Bar */}
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
                <span>{tags.find((t) => t.id === activeTagFilter)?.name ?? 'Tag'}</span>
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

      {/* Assumption List */}
      <div className="flex-1">
        <AssumptionList
          assumptions={sortedAssumptions}
          getVoteSummary={getVoteSummary}
          getVotesForAssumption={getVotesForAssumption}
          getEditsForAssumption={getEditsForAssumption}
          onVote={onVote}
          onEdit={onUpdateAssumption}
          tags={tags}
          onTagClick={(tagId) => setActiveTagFilter((prev) => (prev === tagId ? null : tagId))}
          currentUserId={currentUserDid}
          doc={{
            version: '1.0.0',
            lastModified: Date.now(),
            identities: context.identities,
            trustAttestations,
            data,
          }}
        />
      </div>

      {/* Floating New Assumption Button */}
      <button
        className="btn btn-primary gap-2 fixed bottom-6 right-6 shadow-lg shadow-black/30 z-10"
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

      {/* Create Assumption Modal */}
      <CreateAssumptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={onCreateAssumption}
        availableTags={tags}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportAssumptions}
      />
    </div>
  );
}
