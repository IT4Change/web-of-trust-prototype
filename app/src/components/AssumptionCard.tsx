import { Assumption, Tag, VoteValue, VoteSummary } from 'narri-ui';
import { VoteBar } from './VoteBar';

interface AssumptionCardProps {
  assumption: Assumption;
  tags: Tag[];
  voteSummary: VoteSummary;
  onVote: (assumptionId: string, value: VoteValue) => void;
  currentUserId?: string; // Currently unused but kept for future features
}

/**
 * Card displaying a single assumption with vote controls
 */
export function AssumptionCard({
  assumption,
  tags,
  voteSummary,
  onVote,
}: AssumptionCardProps) {
  const handleVote = (value: VoteValue) => {
    onVote(assumption.id, value);
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="card-body">
        <p className="text-lg font-semibold text-base-content leading-relaxed">
          {assumption.sentence}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <div key={tag.id} className="badge badge-outline">
                {tag.name}
              </div>
            ))}
          </div>
        )}

        {/* Vote Bar */}
        <div className="mt-4">
          <VoteBar summary={voteSummary} />
        </div>

        {/* Vote Buttons */}
        <div className="card-actions justify-end mt-4">
          <div className="btn-group">
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'green' ? 'tw:btn-success' : 'tw:btn-outline btn-success'
              }`}
              onClick={() => handleVote('green')}
              title="Agree"
            >
              <span className="text-lg">🟢</span>
              <span className="ml-1">{voteSummary.green}</span>
            </button>
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'yellow' ? 'tw:btn-warning' : 'tw:btn-outline btn-warning'
              }`}
              onClick={() => handleVote('yellow')}
              title="Neutral"
            >
              <span className="text-lg">🟡</span>
              <span className="ml-1">{voteSummary.yellow}</span>
            </button>
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'red' ? 'tw:btn-error' : 'tw:btn-outline btn-error'
              }`}
              onClick={() => handleVote('red')}
              title="Disagree"
            >
              <span className="text-lg">🔴</span>
              <span className="ml-1">{voteSummary.red}</span>
            </button>
          </div>

          <div className="text-sm text-base-content opacity-60">
            {voteSummary.total} {voteSummary.total === 1 ? 'vote' : 'votes'}
          </div>
        </div>
      </div>
    </div>
  );
}
