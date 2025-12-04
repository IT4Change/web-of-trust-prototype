/**
 * MarketModule - Reusable module component for marketplace
 *
 * This is a pure UI component that receives data and callbacks via props.
 * It can be used standalone or integrated into a unified multi-module app.
 */

import { useMemo, useState } from 'react';
import type { ModuleProps } from 'narrative-ui';
import type {
  MarketAppData,
  Listing,
  ListingType,
  ListingStatus,
  CategoryId,
  Reaction,
} from '../schema';
import { CATEGORIES } from '../schema';
import { ListingCard } from '../components/ListingCard';
import { CreateListingModal } from '../components/CreateListingModal';

/**
 * Extended props for MarketModule
 * Includes module-specific callbacks beyond the standard ModuleProps
 */
export interface MarketModuleProps extends ModuleProps<MarketAppData> {
  /** Callback to create a new listing */
  onCreateListing: (data: {
    type: ListingType;
    title: string;
    description: string;
    categoryId: CategoryId;
    location?: string;
  }) => void;
  /** Callback to set listing status */
  onSetListingStatus: (id: string, status: ListingStatus) => void;
  /** Callback to add a reaction */
  onAddReaction: (listingId: string) => void;
  /** Callback to remove a reaction */
  onRemoveReaction: (listingId: string) => void;
  /** Get reaction count for a listing */
  getReactionCount: (listingId: string) => number;
  /** Check if user has reacted to a listing */
  hasUserReacted: (listingId: string) => boolean;
  /** Get reactions for a listing */
  getReactionsForListing: (listingId: string) => Reaction[];
  /** All listings (already sorted) */
  listings: Listing[];
  /** Hidden user DIDs for filtering */
  hiddenUserDids?: Set<string>;
  /** Full document for ListingCard (identities, trustAttestations) */
  doc: {
    identities: Record<string, { displayName?: string; avatarUrl?: string }>;
    trustAttestations: Record<string, unknown>;
  };
}

type FilterType = 'all' | 'offer' | 'need';
type FilterStatus = 'active' | 'all';

/**
 * MarketModule Component
 *
 * Displays the marketplace with listings, filtering, and creation capabilities.
 * This component is designed to work both standalone and within a unified app.
 */
export function MarketModule({
  data: _data, // Reserved for future direct data mutations
  context,
  onCreateListing,
  onSetListingStatus,
  onAddReaction,
  onRemoveReaction,
  getReactionCount,
  hasUserReacted,
  listings,
  hiddenUserDids = new Set(),
  doc,
}: MarketModuleProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryId | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

  const { currentUserDid } = context;

  // Filtered listings
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      // Type filter
      if (filterType !== 'all' && listing.type !== filterType) return false;

      // Category filter
      if (filterCategory !== 'all' && listing.categoryId !== filterCategory) return false;

      // Status filter
      if (filterStatus === 'active' && listing.status !== 'active') return false;

      // Hidden users filter
      if (hiddenUserDids.has(listing.createdBy)) return false;

      return true;
    });
  }, [listings, filterType, filterCategory, filterStatus, hiddenUserDids]);

  // Counts
  const offerCount = listings.filter(l => l.type === 'offer' && l.status === 'active').length;
  const needCount = listings.filter(l => l.type === 'need' && l.status === 'active').length;

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="stats shadow mb-4 w-full">
        <div className="stat">
          <div className="stat-title">Angebote</div>
          <div className="stat-value text-success">{offerCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Gesuche</div>
          <div className="stat-value text-warning">{needCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body p-4">
          <div className="flex flex-wrap gap-4">
            {/* Type Filter */}
            <div className="join">
              <button
                className={`join-item btn btn-sm ${filterType === 'all' ? 'btn-active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Alle
              </button>
              <button
                className={`join-item btn btn-sm ${filterType === 'offer' ? 'btn-success' : ''}`}
                onClick={() => setFilterType('offer')}
              >
                Angebote
              </button>
              <button
                className={`join-item btn btn-sm ${filterType === 'need' ? 'btn-warning' : ''}`}
                onClick={() => setFilterType('need')}
              >
                Gesuche
              </button>
            </div>

            {/* Category Filter */}
            <select
              className="select select-sm select-bordered"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as CategoryId | 'all')}
            >
              <option value="all">Alle Kategorien</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <label className="label cursor-pointer gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={filterStatus === 'all'}
                onChange={(e) => setFilterStatus(e.target.checked ? 'all' : 'active')}
              />
              <span className="label-text text-sm">Archivierte zeigen</span>
            </label>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="flex-1 space-y-3">
        {filteredListings.length === 0 ? (
          <div className="card bg-base-100 shadow">
            <div className="card-body text-center text-base-content/50">
              <p>Keine Inserate gefunden.</p>
              <p className="text-sm">Erstelle das erste Inserat!</p>
            </div>
          </div>
        ) : (
          filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              doc={doc as any}
              currentUserDid={currentUserDid}
              reactionCount={getReactionCount(listing.id)}
              hasReacted={hasUserReacted(listing.id)}
              onReact={() => onAddReaction(listing.id)}
              onRemoveReaction={() => onRemoveReaction(listing.id)}
              onStatusChange={(status) => onSetListingStatus(listing.id, status)}
            />
          ))
        )}
      </div>

      {/* Floating Create Button */}
      <button
        className="btn btn-primary gap-2 fixed bottom-6 right-6 shadow-lg shadow-black/30 z-10"
        onClick={() => setIsCreateModalOpen(true)}
        title="Neues Inserat"
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
        <span>Neues Inserat</span>
      </button>

      {/* Create Modal */}
      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={onCreateListing}
      />
    </div>
  );
}
