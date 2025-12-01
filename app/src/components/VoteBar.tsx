import { VoteSummary } from 'narri-ui';

interface VoteBarProps {
  summary: VoteSummary;
}

/**
 * Visual representation of vote distribution
 * Shows a horizontal bar with green/yellow/red sections
 */
export function VoteBar({ summary }: VoteBarProps) {
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

  return (
    <div className="w-full">
      <div className="flex h-8 rounded-lg overflow-hidden border border-base-300">
        {green > 0 && (
          <div
            className="bg-success flex items-center justify-center text-success-content font-semibold text-sm"
            style={{ width: `${greenPercent}%` }}
          >
            {green}
          </div>
        )}
        {yellow > 0 && (
          <div
            className="bg-warning flex items-center justify-center text-warning-content font-semibold text-sm"
            style={{ width: `${yellowPercent}%` }}
          >
            {yellow}
          </div>
        )}
        {red > 0 && (
          <div
            className="bg-error flex items-center justify-center text-error-content font-semibold text-sm"
            style={{ width: `${redPercent}%` }}
          >
            {red}
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
