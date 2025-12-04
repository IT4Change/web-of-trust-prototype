import { useDocument } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import type {
  MarketAppDoc,
  Listing,
  ListingType,
  ListingStatus,
  CategoryId,
  Reaction,
} from '../schema';
import { generateId, countReactions } from '../schema';

interface CreateListingInput {
  type: ListingType;
  title: string;
  description: string;
  categoryId: CategoryId;
  location?: string;
  availableFrom?: number;
  availableUntil?: number;
}

interface UseMarketReturn {
  doc: MarketAppDoc | undefined;
  isLoading: boolean;

  // Listings
  listings: Listing[];
  getListingsByType: (type: ListingType) => Listing[];
  getListingsByCategory: (categoryId: CategoryId) => Listing[];
  getListingsByStatus: (status: ListingStatus) => Listing[];
  getMyListings: (did: string) => Listing[];

  // Mutations
  createListing: (input: CreateListingInput, creatorDid: string) => string;
  updateListing: (id: string, updates: Partial<Listing>) => void;
  setListingStatus: (id: string, status: ListingStatus) => void;
  deleteListing: (id: string) => void;

  // Reactions
  addReaction: (listingId: string, reactorDid: string, message?: string) => string;
  removeReaction: (reactionId: string, listingId: string) => void;
  getReactionsForListing: (listingId: string) => Reaction[];
  getReactionCount: (listingId: string) => number;
  hasUserReacted: (listingId: string, userDid: string) => boolean;

  // Identity
  updateIdentity: (did: string, updates: { displayName?: string; avatarUrl?: string }) => void;
}

export function useMarket(documentId: DocumentId): UseMarketReturn {
  const repo = useRepo();
  const [doc] = useDocument<MarketAppDoc>(documentId);

  const docHandle = repo.find<MarketAppDoc>(documentId);

  // Computed values
  const listings = doc?.data?.listings
    ? Object.values(doc.data.listings).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const reactions = doc?.data?.reactions ?? {};

  // Query functions
  const getListingsByType = (type: ListingType): Listing[] => {
    return listings.filter(l => l.type === type);
  };

  const getListingsByCategory = (categoryId: CategoryId): Listing[] => {
    return listings.filter(l => l.categoryId === categoryId);
  };

  const getListingsByStatus = (status: ListingStatus): Listing[] => {
    return listings.filter(l => l.status === status);
  };

  const getMyListings = (did: string): Listing[] => {
    return listings.filter(l => l.createdBy === did);
  };

  const getReactionsForListing = (listingId: string): Reaction[] => {
    return Object.values(reactions).filter(r => r.listingId === listingId);
  };

  const getReactionCount = (listingId: string): number => {
    return countReactions(reactions, listingId);
  };

  const hasUserReacted = (listingId: string, userDid: string): boolean => {
    return Object.values(reactions).some(
      r => r.listingId === listingId && r.reactorDid === userDid
    );
  };

  // Mutations
  const createListing = (input: CreateListingInput, creatorDid: string): string => {
    const id = generateId();
    const now = Date.now();

    console.log('[createListing] START', { id, input, creatorDid });
    console.log('[createListing] docHandle:', docHandle);
    console.log('[createListing] doc before change:', doc);

    docHandle.change((d) => {
      console.log('[createListing] Inside change callback, d:', d);
      console.log('[createListing] d.data:', d.data);

      // Ensure data structure exists (for documents created before schema update)
      if (!d.data) {
        console.log('[createListing] d.data is missing, creating...');
        (d as any).data = { listings: {}, reactions: {} };
      }
      if (!d.data.listings) {
        console.log('[createListing] d.data.listings is missing, creating...');
        d.data.listings = {};
      }
      if (!d.data.reactions) {
        console.log('[createListing] d.data.reactions is missing, creating...');
        d.data.reactions = {};
      }

      console.log('[createListing] About to add listing with id:', id);

      // Create listing with only defined values (Automerge doesn't allow undefined)
      const listing: any = {
        id,
        type: input.type,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        status: 'active',
        createdBy: creatorDid,
        createdAt: now,
        updatedAt: now,
        reactionIds: [],
      };

      // Only add optional fields if they have values
      if (input.location !== undefined) {
        listing.location = input.location;
      }
      if (input.availableFrom !== undefined) {
        listing.availableFrom = input.availableFrom;
      }
      if (input.availableUntil !== undefined) {
        listing.availableUntil = input.availableUntil;
      }

      d.data.listings[id] = listing;
      d.lastModified = now;

      console.log('[createListing] DONE - listing added:', d.data.listings[id]);
    });

    return id;
  };

  const updateListing = (id: string, updates: Partial<Listing>): void => {
    docHandle.change((d) => {
      const listing = d.data.listings[id];
      if (!listing) return;

      // Update individual fields (CRDT-safe)
      if (updates.title !== undefined) listing.title = updates.title;
      if (updates.description !== undefined) listing.description = updates.description;
      if (updates.categoryId !== undefined) listing.categoryId = updates.categoryId;
      if (updates.location !== undefined) listing.location = updates.location;
      if (updates.availableFrom !== undefined) listing.availableFrom = updates.availableFrom;
      if (updates.availableUntil !== undefined) listing.availableUntil = updates.availableUntil;

      listing.updatedAt = Date.now();
      d.lastModified = Date.now();
    });
  };

  const setListingStatus = (id: string, status: ListingStatus): void => {
    docHandle.change((d) => {
      const listing = d.data.listings[id];
      if (!listing) return;

      listing.status = status;
      listing.updatedAt = Date.now();
      d.lastModified = Date.now();
    });
  };

  const deleteListing = (id: string): void => {
    docHandle.change((d) => {
      // Remove all reactions for this listing
      const reactionIds = d.data.listings[id]?.reactionIds ?? [];
      for (const reactionId of reactionIds) {
        delete d.data.reactions[reactionId];
      }

      // Remove the listing
      delete d.data.listings[id];
      d.lastModified = Date.now();
    });
  };

  const addReaction = (
    listingId: string,
    reactorDid: string,
    message?: string
  ): string => {
    const id = generateId();
    const now = Date.now();

    docHandle.change((d) => {
      const listing = d.data.listings[listingId];
      if (!listing) return;

      // Add reaction
      d.data.reactions[id] = {
        id,
        listingId,
        reactorDid,
        message,
        createdAt: now,
      };

      // Add to listing's reactionIds
      listing.reactionIds.push(id);
      d.lastModified = now;
    });

    return id;
  };

  const removeReaction = (reactionId: string, listingId: string): void => {
    docHandle.change((d) => {
      const listing = d.data.listings[listingId];
      if (!listing) return;

      // Remove from listing's reactionIds
      const idx = listing.reactionIds.indexOf(reactionId);
      if (idx !== -1) {
        listing.reactionIds.splice(idx, 1);
      }

      // Remove reaction
      delete d.data.reactions[reactionId];
      d.lastModified = Date.now();
    });
  };

  // Identity
  const updateIdentity = (
    did: string,
    updates: { displayName?: string; avatarUrl?: string }
  ): void => {
    docHandle.change((d) => {
      if (!d.identities[did]) {
        d.identities[did] = {};
      }
      if (updates.displayName !== undefined) {
        d.identities[did].displayName = updates.displayName;
      }
      if (updates.avatarUrl !== undefined) {
        d.identities[did].avatarUrl = updates.avatarUrl;
      }
      d.lastModified = Date.now();
    });
  };

  return {
    doc,
    isLoading: !doc,
    listings,
    getListingsByType,
    getListingsByCategory,
    getListingsByStatus,
    getMyListings,
    createListing,
    updateListing,
    setListingStatus,
    deleteListing,
    addReaction,
    removeReaction,
    getReactionsForListing,
    getReactionCount,
    hasUserReacted,
    updateIdentity,
  };
}
