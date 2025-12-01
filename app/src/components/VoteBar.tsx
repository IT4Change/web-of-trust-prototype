import { Vote, VoteSummary } from 'narri-ui';

interface VoteBarProps {
  summary: VoteSummary;
  votes: Vote[];
}

/**
 * Visual representation of vote distribution
 * Shows a horizontal bar with green/yellow/red sections
 */
export function VoteBar({ summary, votes }: VoteBarProps) {
  const { green, yellow, red, total } = summary;

  if (total === 0) {
    return (
      <div className="w-full h-8 bg-base-300 rounded-lg flex items-center justify-center">
        <span className="text-sm text-base-content opacity-50">No votes yet</span>
      </div>
    );
  }

  const greenPercent = (green / total) * 100;
  const yellowPercent = (yellow / total) * 100;
  const redPercent = (red / total) * 100;

  const tooltip = (value: Vote['value']) => {
    const matching = votes.filter((v) => v.value === value);
    if (matching.length === 0) return 'Keine Stimmen';

    const label =
      value === 'green' ? 'Zustimmung' : value === 'yellow' ? 'Neutral' : 'Ablehnung';

    return [
      label,
      ...matching.map((v) => `${v.voterName ?? v.voterDid} (${v.voterDid})`),
    ].join('\n');
  };

  return (
    <div className="w-full">
      <div className="relative flex h-8 rounded-lg border border-base-300 overflow-visible">
        {green > 0 && (
          <div
            className="tooltip tooltip-bottom w-full h-full first:rounded-l-lg last:rounded-r-lg"
            data-tip={tooltip('green')}
            style={{ width: `${greenPercent}%` }}
            tabIndex={0}
          >
            <div className="bg-success flex items-center justify-center text-success-content font-semibold text-sm h-full w-full rounded-lg">
              {green}
            </div>
          </div>
        )}
        {yellow > 0 && (
          <div
            className="tooltip tooltip-bottom w-full h-full first:rounded-l-lg last:rounded-r-lg"
            data-tip={tooltip('yellow')}
            style={{ width: `${yellowPercent}%` }}
            tabIndex={0}
          >
            <div className="bg-warning flex items-center justify-center text-warning-content font-semibold text-sm h-full w-full rounded-lg">
              {yellow}
            </div>
          </div>
        )}
        {red > 0 && (
          <div
            className="tooltip tooltip-bottom w-full h-full first:rounded-l-lg last:rounded-r-lg"
            data-tip={tooltip('red')}
            style={{ width: `${redPercent}%` }}
            tabIndex={0}
          >
            <div className="bg-error flex items-center justify-center text-error-content font-semibold text-sm h-full w-full rounded-lg">
              {red}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-base-content opacity-60 mt-1">
        <span>🟢 {greenPercent.toFixed(0)}%</span>
        <span>🟡 {yellowPercent.toFixed(0)}%</span>
        <span>🔴 {redPercent.toFixed(0)}%</span>
      </div>
    </div>
  );
}
