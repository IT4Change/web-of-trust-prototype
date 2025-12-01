import { useMemo, useState } from 'react';
import { Assumption, Tag, Vote, VoteValue, VoteSummary, EditEntry } from 'narri-ui';
import { VoteBar } from './VoteBar';
import { CreateAssumptionModal } from './CreateAssumptionModal';

interface AssumptionCardProps {
  assumption: Assumption;
  tags: Tag[];
  availableTags: Tag[];
  votes: Vote[];
  edits: EditEntry[];
  voteSummary: VoteSummary;
  onVote: (assumptionId: string, value: VoteValue) => void;
  onEdit: (assumptionId: string, newSentence: string, tags: string[]) => void;
  onTagClick?: (tagId: string) => void;
  currentUserId?: string; // Currently unused but kept for future features
}

/**
 * Card displaying a single assumption with vote controls
 */
export function AssumptionCard({
  assumption,
  tags,
  availableTags,
  votes,
  edits,
  voteSummary,
  onVote,
  onEdit,
  onTagClick,
}: AssumptionCardProps) {
  const [showLog, setShowLog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const formatRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSeconds < 30) return 'gerade eben';
    if (diffSeconds < 90) return 'vor 1 Minute';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `vor ${diffMinutes} Minuten`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return diffHours === 1 ? 'vor 1 Stunde' : `vor ${diffHours} Stunden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return diffDays === 1 ? 'vor 1 Tag' : `vor ${diffDays} Tagen`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return diffWeeks === 1 ? 'vor 1 Woche' : `vor ${diffWeeks} Wochen`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return diffMonths === 1 ? 'vor 1 Monat' : `vor ${diffMonths} Monaten`;
    const diffYears = Math.floor(diffDays / 365);
    return diffYears === 1 ? 'vor 1 Jahr' : `vor ${diffYears} Jahren`;
  };

  const handleVote = (value: VoteValue) => {
    onVote(assumption.id, value);
  };

  const handleSaveEdit = (sentence: string, tags: string[]) => {
    const trimmed = sentence.trim();
    if (!trimmed) {
      setShowEditModal(false);
      return;
    }
    onEdit(assumption.id, trimmed, tags);
    setShowEditModal(false);
  };

  const uniqueVotes = useMemo(() => {
    const latestByDid = new Map<string, Vote>();
    votes.forEach((vote) => {
      const existing = latestByDid.get(vote.voterDid);
      const ts = vote.updatedAt ?? vote.createdAt;
      if (!existing || ts > (existing.updatedAt ?? existing.createdAt)) {
        latestByDid.set(vote.voterDid, vote);
      }
    });
    return Array.from(latestByDid.values()).sort(
      (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
    );
  }, [votes]);

  const activities = useMemo(() => {
    const voteActivities = uniqueVotes.map((vote) => ({
      kind: 'vote' as const,
      ts: vote.updatedAt ?? vote.createdAt,
      vote,
    }));
    const editActivities = edits.map((edit) => ({
      kind: 'edit' as const,
      ts: edit.createdAt,
      edit,
    }));
    return [...voteActivities, ...editActivities].sort((a, b) => b.ts - a.ts);
  }, [uniqueVotes, edits]);

  const resolveName = (did: string, fallback?: string) => {
    const matchingVote = uniqueVotes.find((v) => v.voterDid === did && v.voterName);
    if (matchingVote?.voterName) return matchingVote.voterName;
    return fallback ?? did;
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="card-body">
        <div className="flex items-start gap-3 justify-between">
          <p className="text-lg font-semibold text-base-content leading-relaxed">
            {assumption.sentence}
          </p>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setShowEditModal(true);
            }}
            title="Annahme bearbeiten"
          >
            Edit
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                className="badge badge-outline hover:badge-primary"
                type="button"
                onClick={() => onTagClick && onTagClick(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Vote Bar */}
        <div className="mt-4">
          <VoteBar summary={voteSummary} votes={uniqueVotes} />
        </div>

        {/* Vote Buttons */}
        <div className="card-actions w-full items-center mt-4 flex-wrap gap-3">
          <span className="flex-1" aria-hidden="true"></span>
          <div className="btn-group">
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'green' ? 'tw:btn-success' : 'tw:btn-outline btn-success'
              }`}
              onClick={() => handleVote('green')}
              title="Agree"
            >
              <span className="relative inline-flex items-center justify-center w-7 h-7 text-lg">
                <span>🟢</span>
                {voteSummary.userVote === 'green' && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    ✔︎
                  </span>
                )}
              </span>
              <span className="ml-1">{voteSummary.green}</span>
            </button>
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'yellow' ? 'tw:btn-warning' : 'tw:btn-outline btn-warning'
              }`}
              onClick={() => handleVote('yellow')}
              title="Neutral"
            >
              <span className="relative inline-flex items-center justify-center w-7 h-7 text-lg">
                <span>🟡</span>
                {voteSummary.userVote === 'yellow' && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    ✔︎
                  </span>
                )}
              </span>
              <span className="ml-1">{voteSummary.yellow}</span>
            </button>
            <button
              className={`tw:btn btn-sm ${
                voteSummary.userVote === 'red' ? 'tw:btn-error' : 'tw:btn-outline btn-error'
              }`}
              onClick={() => handleVote('red')}
              title="Disagree"
            >
              <span className="relative inline-flex items-center justify-center w-7 h-7 text-lg">
                <span>🔴</span>
                {voteSummary.userVote === 'red' && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    ✔︎
                  </span>
                )}
              </span>
              <span className="ml-1">{voteSummary.red}</span>
            </button>
          </div>

          <div className="flex-1 text-right text-sm text-base-content/70">
            {voteSummary.total} {voteSummary.total === 1 ? 'vote' : 'votes'}
          </div>

          <div className="w-full flex justify-center mt-2">
            {activities.length > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-semibold text-base-content hover:text-primary transition-colors"
                onClick={() => setShowLog((v) => !v)}
              >
                Details
                <span className={`transition-transform ${showLog ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            )}
          </div>

          {activities.length > 0 && showLog && (
            <div className="mt-3 border-t border-base-200 pt-3 w-full">
              <div className="text-sm font-semibold mb-2 text-base-content/70">Aktivität</div>
              <div className="space-y-2">
                {activities.map((item) => {
                  const ts = item.ts;
                  const relativeTime = formatRelativeTime(ts);
                  const exactTime = new Date(ts).toLocaleString();

                  if (item.kind === 'vote') {
                    const vote = item.vote;
                    const hasName = Boolean(vote.voterName);
                    return (
                      <div key={`vote-${vote.id}`} className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            vote.value === 'green'
                              ? 'text-success font-semibold'
                              : vote.value === 'yellow'
                                ? 'text-warning font-semibold'
                                : 'text-error font-semibold'
                          }
                        >
                          {vote.value === 'green' ? '🟢' : vote.value === 'yellow' ? '🟡' : '🔴'}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold">
                            {hasName ? vote.voterName : vote.voterDid}
                          </span>
                          {hasName && (
                            <span className="text-xs text-base-content/60 break-all">{vote.voterDid}</span>
                          )}
                        </div>
                        <span className="text-xs text-base-content/60" title={exactTime}>
                          {relativeTime}
                        </span>
                      </div>
                    );
                  }

                  const edit = item.edit;
                  const name = resolveName(edit.editorDid, edit.editorName);
                  const tagsChanged =
                    (edit.previousTags && edit.previousTags.join('|')) !==
                    (edit.newTags && edit.newTags.join('|'));
                  return (
                    <div key={`edit-${edit.id}`} className="flex flex-col gap-1 text-sm border border-base-200 rounded-lg p-2">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span className={edit.type === 'create' ? 'text-success font-semibold' : 'text-info font-semibold'}>
                            {edit.type === 'create' ? '＋' : '✎'}
                          </span>
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold">{name}</span>
                            <span className="text-xs text-base-content/60 break-all">
                              {edit.editorDid}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-base-content/60" title={exactTime}>
                          {relativeTime}
                        </span>
                      </div>
                      <div className="text-xs text-base-content/70 space-y-1">
                        {edit.type === 'edit' && edit.previousSentence && edit.previousSentence !== edit.newSentence && (
                          <span className="line-through block">{edit.previousSentence}</span>
                        )}
                        {edit.newSentence && edit.previousSentence !== edit.newSentence && (
                          <span className="block">{edit.newSentence}</span>
                        )}
                        {tagsChanged && (
                          <div className="mt-1 flex gap-1 flex-wrap items-center">
                            <span className="text-[11px] text-base-content/60">Tags:</span>
                            <span className="text-[11px] line-through text-error/80">
                              {(edit.previousTags ?? []).join(', ')}
                            </span>
                            <span className="text-[11px] text-success/80">
                              {(edit.newTags ?? []).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
             </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <CreateAssumptionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={(sentence, tags) => {
            handleSaveEdit(sentence, tags);
          }}
          initialSentence={assumption.sentence}
          initialTags={tags.map((t) => t.name)}
          submitLabel="Speichern"
          availableTags={availableTags}
        />
      )}
    </div>
  );
}
