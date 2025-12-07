import type { Assumption, Tag, Vote, VoteValue, EditEntry, OpinionGraphDoc } from '../schema';
import { AssumptionCard } from './AssumptionCard';

interface AssumptionListProps {
  assumptions: (Assumption | null)[];
  getVoteSummary: (assumptionId: string) => any;
  getVotesForAssumption: (assumptionId: string) => Vote[];
  getEditsForAssumption: (assumptionId: string) => EditEntry[];
  onVote: (assumptionId: string, value: VoteValue) => void;
  onEdit: (assumptionId: string, newSentence: string, tags: string[]) => void;
  tags: Tag[];
  onTagClick?: (tagId: string) => void;
  currentUserId?: string;
  doc?: OpinionGraphDoc;
  onCreate?: () => void;
}

/**
 * List view of all assumptions
 */
export function AssumptionList({
  assumptions,
  getVoteSummary,
  getVotesForAssumption,
  getEditsForAssumption,
  onVote,
  onEdit,
  tags,
  onTagClick,
  currentUserId,
  doc,
  onCreate,
}: AssumptionListProps) {
  const validAssumptions = assumptions.filter((a): a is Assumption => a !== null);
  const tagMap = tags.reduce<Record<string, Tag>>((acc, tag) => {
    acc[tag.id] = tag;
    return acc;
  }, {});

  if (validAssumptions.length === 0) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <button
            className="btn btn-primary"
            onClick={onCreate}
          >
            + New Assumption
          </button>
          <p className="mt-2 text-base-content/60">Create your first assumption to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {validAssumptions.map((assumption) => (
        <AssumptionCard
          key={assumption.id}
          assumption={assumption}
          votes={getVotesForAssumption(assumption.id)}
          edits={getEditsForAssumption(assumption.id)}
          tags={assumption.tagIds.map((id) => tagMap[id]).filter((t): t is Tag => !!t)}
          availableTags={tags}
          voteSummary={getVoteSummary(assumption.id)}
          onVote={onVote}
          onEdit={onEdit}
          onTagClick={onTagClick}
          currentUserId={currentUserId}
          doc={doc}
        />
      ))}
    </div>
  );
}
