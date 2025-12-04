import { UserAvatar } from 'narrative-ui';
import type { Listing, MarketAppDoc } from '../schema';
import { getCategory } from '../schema';

interface ListingCardProps {
  listing: Listing;
  doc: MarketAppDoc;
  currentUserDid: string;
  reactionCount: number;
  hasReacted: boolean;
  onReact: () => void;
  onRemoveReaction: () => void;
  onStatusChange: (status: 'completed' | 'archived') => void;
}

export function ListingCard({
  listing,
  doc,
  currentUserDid,
  reactionCount,
  hasReacted,
  onReact,
  onRemoveReaction,
  onStatusChange,
}: ListingCardProps) {
  const category = getCategory(listing.categoryId);
  const isOwner = listing.createdBy === currentUserDid;
  const creatorProfile = doc.identities[listing.createdBy];
  const creatorName = creatorProfile?.displayName || listing.createdBy.slice(0, 12) + '...';

  const typeLabel = listing.type === 'offer' ? 'Biete' : 'Suche';
  const typeBadgeClass = listing.type === 'offer'
    ? 'badge-success'
    : 'badge-warning';

  const statusBadge = () => {
    switch (listing.status) {
      case 'reserved':
        return <span className="badge badge-info badge-sm">Reserviert</span>;
      case 'completed':
        return <span className="badge badge-neutral badge-sm">Erledigt</span>;
      case 'archived':
        return <span className="badge badge-ghost badge-sm">Archiviert</span>;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  return (
    <div className={`card bg-base-100 shadow-md ${listing.status !== 'active' ? 'opacity-60' : ''}`}>
      <div className="card-body p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`badge ${typeBadgeClass} badge-sm shrink-0`}>
              {typeLabel}
            </span>
            <span className="badge badge-outline badge-sm shrink-0">
              {category?.icon} {category?.name}
            </span>
            {statusBadge()}
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="card-title text-base mt-1">{listing.title}</h3>
        <p className="text-sm text-base-content/70 line-clamp-2">
          {listing.description}
        </p>

        {/* Location */}
        {listing.location && (
          <p className="text-xs text-base-content/50">
            📍 {listing.location}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-200">
          {/* Creator */}
          <div className="flex items-center gap-2">
            <UserAvatar
              did={listing.createdBy}
              avatarUrl={creatorProfile?.avatarUrl}
              size={24}
            />
            <div className="text-xs">
              <span className="font-medium">{creatorName}</span>
              <span className="text-base-content/50 ml-2">
                {formatDate(listing.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Reaction count */}
            <span className="text-xs text-base-content/50">
              {reactionCount} {reactionCount === 1 ? 'Interesse' : 'Interessen'}
            </span>

            {listing.status === 'active' && !isOwner && (
              <button
                className={`btn btn-xs ${hasReacted ? 'btn-primary' : 'btn-outline'}`}
                onClick={hasReacted ? onRemoveReaction : onReact}
              >
                {hasReacted ? '✓ Interessiert' : 'Interesse'}
              </button>
            )}

            {isOwner && listing.status === 'active' && (
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-xs btn-ghost">
                  ⋮
                </label>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40"
                >
                  <li>
                    <button onClick={() => onStatusChange('completed')}>
                      ✓ Als erledigt markieren
                    </button>
                  </li>
                  <li>
                    <button onClick={() => onStatusChange('archived')}>
                      📁 Archivieren
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
