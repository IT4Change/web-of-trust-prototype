/**
 * Market App - Debug Extensions
 *
 * App-specific debug tools that extend the central __narrative namespace.
 * These tools work with the automatically populated __doc (workspace document).
 *
 * Usage:
 *   __narrative.listings()      - List all listings
 *   __narrative.offers()        - List all offers
 *   __narrative.needs()         - List all needs
 *   __narrative.reactions()     - Show all reactions
 */

import type { MarketAppDoc } from './schema';
import type { NarrativeDebug } from 'narrative-ui';

// Market-specific debug extensions
interface MarketAppDebug extends NarrativeDebug {
  listings: () => void;
  offers: () => void;
  needs: () => void;
  reactions: () => void;
}

// Extend the global window type
declare global {
  interface Window {
    __narrative: MarketAppDebug;
    __doc: MarketAppDoc | null;
  }
}

/**
 * Helper to resolve DID to display name
 */
function resolveName(doc: MarketAppDoc, did: string): string {
  return doc.identities?.[did]?.displayName || did.substring(0, 20) + '...';
}

/**
 * Get the current workspace document as MarketAppDoc
 */
function getDoc(): MarketAppDoc | null {
  return window.__doc as MarketAppDoc | null;
}

/**
 * List all listings with their stats
 */
function listListings(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  console.group(`📦 Listings (${Object.keys(doc.data.listings).length})`);

  const listings = Object.entries(doc.data.listings).map(([id, l]) => ({
    id: id.substring(0, 8) + '...',
    type: l.type === 'offer' ? '🤲 Offer' : '🙋 Need',
    title: l.title.length > 40 ? l.title.substring(0, 40) + '...' : l.title,
    author: resolveName(doc, l.createdBy),
    status: l.status,
    reactions: l.reactionIds.length,
  }));

  console.table(listings);
  console.groupEnd();
}

/**
 * List all offers
 */
function listOffers(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  const offers = Object.values(doc.data.listings).filter((l) => l.type === 'offer');
  console.group(`🤲 Offers (${offers.length})`);

  console.table(
    offers.map((l) => ({
      title: l.title,
      author: resolveName(doc, l.createdBy),
      status: l.status,
      reactions: l.reactionIds.length,
    }))
  );

  console.groupEnd();
}

/**
 * List all needs
 */
function listNeeds(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  const needs = Object.values(doc.data.listings).filter((l) => l.type === 'need');
  console.group(`🙋 Needs (${needs.length})`);

  console.table(
    needs.map((l) => ({
      title: l.title,
      author: resolveName(doc, l.createdBy),
      status: l.status,
      reactions: l.reactionIds.length,
    }))
  );

  console.groupEnd();
}

/**
 * Show all reactions
 */
function listReactions(): void {
  const doc = getDoc();
  if (!doc) {
    console.log('❌ No workspace document loaded');
    return;
  }

  console.group(`💬 Reactions (${Object.keys(doc.data.reactions).length})`);

  const reactions = Object.values(doc.data.reactions).map((r) => {
    const listing = doc.data.listings[r.listingId];
    return {
      from: resolveName(doc, r.reactorDid),
      listing: listing?.title || 'Unknown',
      message: r.message?.substring(0, 30) || '-',
    };
  });

  console.table(reactions);
  console.groupEnd();
}

/**
 * Initialize Market-specific debug extensions
 */
export function initMarketDebug(): void {
  if (typeof window === 'undefined') return;

  const extend = () => {
    if (!window.__narrative) {
      setTimeout(extend, 100);
      return;
    }

    // Extend __narrative with app-specific functions
    window.__narrative.listings = listListings;
    window.__narrative.offers = listOffers;
    window.__narrative.needs = listNeeds;
    window.__narrative.reactions = listReactions;

    console.log('🏪 Market App debug extensions loaded:');
    console.log('  __narrative.listings()   - List all listings');
    console.log('  __narrative.offers()     - List all offers');
    console.log('  __narrative.needs()      - List all needs');
    console.log('  __narrative.reactions()  - Show all reactions');
  };

  extend();
}

// Auto-initialize when imported
initMarketDebug();
