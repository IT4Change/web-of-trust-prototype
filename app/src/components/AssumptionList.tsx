import { Assumption, Tag, VoteValue } from 'narri-ui';
import { AssumptionCard } from './AssumptionCard';

interface AssumptionListProps {
  assumptions: (Assumption | null)[];
  getVoteSummary: (assumptionId: string) => any;
  onVote: (assumptionId: string, value: VoteValue) => void;
  tags: Tag[];
  currentUserId?: string;
}

/**
 * List view of all assumptions
 */
export function AssumptionList({
  assumptions,
  getVoteSummary,
  onVote,
  tags,
  currentUserId,
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
          <h2 className="card-title">No assumptions yet</h2>
          <p>Create your first assumption to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {validAssumptions.map((assumption) => (
        <AssumptionCard
          key={assumption.id}
          assumption={assumption}
          tags={assumption.tagIds.map((id) => tagMap[id]).filter((t): t is Tag => !!t)}
          voteSummary={getVoteSummary(assumption.id)}
          onVote={onVote}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
