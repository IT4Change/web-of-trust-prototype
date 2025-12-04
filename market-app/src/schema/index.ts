import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

// ============================================================================
// Listing Types
// ============================================================================

/**
 * Type of listing: offer (I'm giving) or need (I'm looking for)
 */
export type ListingType = 'offer' | 'need';

/**
 * Status of a listing
 */
export type ListingStatus = 'active' | 'reserved' | 'completed' | 'archived';

/**
 * Predefined categories for listings
 */
export type CategoryId =
  | 'tools'        // Werkzeuge
  | 'food'         // Lebensmittel
  | 'services'     // Dienstleistungen
  | 'spaces'       // Räume
  | 'transport'    // Transport/Fahrzeuge
  | 'materials'    // Materialien
  | 'knowledge'    // Wissen/Beratung
  | 'other';       // Sonstiges

/**
 * Category metadata
 */
export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
}

/**
 * All available categories
 */
export const CATEGORIES: Category[] = [
  { id: 'tools', name: 'Werkzeuge', icon: '🔧' },
  { id: 'food', name: 'Lebensmittel', icon: '🥕' },
  { id: 'services', name: 'Dienstleistungen', icon: '🤝' },
  { id: 'spaces', name: 'Räume', icon: '🏠' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'materials', name: 'Materialien', icon: '📦' },
  { id: 'knowledge', name: 'Wissen', icon: '📚' },
  { id: 'other', name: 'Sonstiges', icon: '✨' },
];

/**
 * A listing (offer or need) on the marketplace
 */
export interface Listing {
  id: string;
  type: ListingType;
  title: string;
  description: string;
  categoryId: CategoryId;
  status: ListingStatus;

  // Creator info
  createdBy: string;  // DID
  createdAt: number;
  updatedAt: number;

  // Optional fields
  location?: string;
  availableFrom?: number;  // timestamp
  availableUntil?: number; // timestamp

  // Reactions (interests)
  reactionIds: string[];
}

/**
 * A reaction/interest on a listing
 */
export interface Reaction {
  id: string;
  listingId: string;
  reactorDid: string;
  message?: string;
  createdAt: number;
}

// ============================================================================
// Document Structure
// ============================================================================

/**
 * Marktplatz app-specific data
 */
export interface MarketAppData {
  listings: Record<string, Listing>;
  reactions: Record<string, Reaction>;
}

/**
 * Full Marktplatz Document
 */
export type MarketAppDoc = BaseDocument<MarketAppData>;

/**
 * Creates an empty Marktplatz document
 */
export function createEmptyMarketAppDoc(
  creatorIdentity: UserIdentity
): MarketAppDoc {
  return createBaseDocument<MarketAppData>(
    {
      listings: {},
      reactions: {},
    },
    creatorIdentity
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get category by ID
 */
export function getCategory(id: CategoryId): Category | undefined {
  return CATEGORIES.find(c => c.id === id);
}

/**
 * Count reactions for a listing
 */
export function countReactions(
  reactions: Record<string, Reaction>,
  listingId: string
): number {
  return Object.values(reactions).filter(r => r.listingId === listingId).length;
}
