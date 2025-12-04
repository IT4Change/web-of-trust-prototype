/**
 * MarketModuleWrapper - Connects MarketModule to Automerge document
 *
 * This wrapper handles:
 * - Converting UnifiedDocument to MarketModule props
 * - Providing mutation callbacks that update the Automerge doc
 * - Managing the module-specific data within the unified document
 */

import { useCallback, useMemo } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { MarketModule } from 'market-app/modules';
import type { UserIdentity } from 'narrative-ui';
import { generateId } from 'narrative-ui';
import type { UnifiedDocument } from '../types';
import type {
  Listing,
  ListingType,
  ListingStatus,
  CategoryId,
  Reaction,
  MarketAppData,
} from 'market-app/schema';

interface MarketModuleWrapperProps {
  doc: UnifiedDocument;
  docHandle: DocHandle<UnifiedDocument>;
  identity: UserIdentity;
  hiddenUserDids: Set<string>;
}

export function MarketModuleWrapper({
  doc,
  docHandle,
  identity,
  hiddenUserDids,
}: MarketModuleWrapperProps) {
  // Initialize market data if missing (for existing documents)
  if (!doc.data.market && docHandle) {
    docHandle.change((d) => {
      if (!d.data.market) {
        d.data.market = {
          listings: {},
          reactions: {},
        };
        d.lastModified = Date.now();
      }
    });
  }

  const marketData = doc.data.market;

  // Get all listings as array, sorted by newest first
  const listings = useMemo((): Listing[] => {
    if (!marketData) return [];
    return (Object.values(marketData.listings) as Listing[]).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }, [marketData]);

  // Create new listing
  const handleCreateListing = useCallback(
    (data: {
      type: ListingType;
      title: string;
      description: string;
      categoryId: CategoryId;
      location?: string;
    }) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.market) return;
        const mkt = d.data.market as MarketAppData;

        const now = Date.now();
        const id = generateId();

        // Create listing with only defined values (Automerge doesn't allow undefined)
        const listing: Listing = {
          id,
          type: data.type,
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          status: 'active',
          createdBy: identity.did,
          createdAt: now,
          updatedAt: now,
          reactionIds: [],
        };

        // Only add optional fields if they have values
        if (data.location) {
          listing.location = data.location;
        }

        mkt.listings[id] = listing;
        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Set listing status
  const handleSetListingStatus = useCallback(
    (id: string, status: ListingStatus) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.market) return;
        const mkt = d.data.market as MarketAppData;

        const listing = mkt.listings[id];
        if (!listing) return;

        listing.status = status;
        listing.updatedAt = Date.now();
        d.lastModified = Date.now();
      });
    },
    [docHandle]
  );

  // Add reaction
  const handleAddReaction = useCallback(
    (listingId: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.market) return;
        const mkt = d.data.market as MarketAppData;

        const listing = mkt.listings[listingId];
        if (!listing) return;

        const now = Date.now();
        const id = generateId();

        // Add reaction
        mkt.reactions[id] = {
          id,
          listingId,
          reactorDid: identity.did,
          createdAt: now,
        };

        // Add to listing's reactionIds
        listing.reactionIds.push(id);
        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Remove reaction
  const handleRemoveReaction = useCallback(
    (listingId: string) => {
      if (!docHandle || !marketData) return;

      // Find user's reaction
      const reactions = Object.values(marketData.reactions) as Reaction[];
      const myReaction = reactions.find(
        (r) => r.listingId === listingId && r.reactorDid === identity.did
      );

      if (!myReaction) return;

      docHandle.change((d) => {
        if (!d.data.market) return;
        const mkt = d.data.market as MarketAppData;

        const listing = mkt.listings[listingId];
        if (!listing) return;

        // Remove from listing's reactionIds
        const idx = listing.reactionIds.indexOf(myReaction.id);
        if (idx !== -1) {
          listing.reactionIds.splice(idx, 1);
        }

        // Remove reaction
        delete mkt.reactions[myReaction.id];
        d.lastModified = Date.now();
      });
    },
    [docHandle, marketData, identity.did]
  );

  // Get reaction count for a listing
  const getReactionCount = useCallback(
    (listingId: string): number => {
      if (!marketData) return 0;
      return (Object.values(marketData.reactions) as Reaction[]).filter(
        (r) => r.listingId === listingId
      ).length;
    },
    [marketData]
  );

  // Check if user has reacted to a listing
  const hasUserReacted = useCallback(
    (listingId: string): boolean => {
      if (!marketData) return false;
      return (Object.values(marketData.reactions) as Reaction[]).some(
        (r) => r.listingId === listingId && r.reactorDid === identity.did
      );
    },
    [marketData, identity.did]
  );

  // Get reactions for a listing
  const getReactionsForListing = useCallback(
    (listingId: string): Reaction[] => {
      if (!marketData) return [];
      return (Object.values(marketData.reactions) as Reaction[]).filter(
        (r) => r.listingId === listingId
      );
    },
    [marketData]
  );

  if (!marketData) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Market Module</h2>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <MarketModule
      data={marketData}
      onChange={() => {}} // Reserved for future direct data mutations
      context={{
        currentUserDid: identity.did,
        identities: doc.identities,
        trustAttestations: doc.trustAttestations,
      }}
      onCreateListing={handleCreateListing}
      onSetListingStatus={handleSetListingStatus}
      onAddReaction={handleAddReaction}
      onRemoveReaction={handleRemoveReaction}
      getReactionCount={getReactionCount}
      hasUserReacted={hasUserReacted}
      getReactionsForListing={getReactionsForListing}
      listings={listings}
      hiddenUserDids={hiddenUserDids}
      doc={{
        identities: doc.identities,
        trustAttestations: doc.trustAttestations,
      }}
    />
  );
}
