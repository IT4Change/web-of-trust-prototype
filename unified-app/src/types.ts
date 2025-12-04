/**
 * Unified App Types
 *
 * Type definitions for multi-module documents.
 */

import type { BaseDocument, UserIdentity } from 'narrative-ui';
import type { OpinionGraphData } from 'narrative-app/schema';
import type { MarketAppData } from 'market-app/schema';
import type { MapData } from 'map-app/schema';

/**
 * Multi-module data structure
 * Each module has its own data namespace
 */
export interface UnifiedModuleData {
  narrative?: OpinionGraphData;
  market?: MarketAppData;
  map?: MapData;
}

/**
 * Unified document type
 */
export type UnifiedDocument = BaseDocument<UnifiedModuleData>;

/**
 * Create empty unified document
 */
export function createEmptyUnifiedDoc(creatorIdentity: UserIdentity): UnifiedDocument {
  return {
    version: '1.0.0',
    lastModified: Date.now(),
    context: {
      name: 'New Workspace',
    },
    enabledModules: {
      narrative: true,
      market: true,
      map: true,
    },
    identities: {
      [creatorIdentity.did]: {
        displayName: creatorIdentity.displayName,
        publicKey: creatorIdentity.publicKey,
      },
    },
    trustAttestations: {},
    data: {
      narrative: {
        assumptions: {},
        votes: {},
        tags: {},
        edits: {},
      },
      market: {
        listings: {},
        reactions: {},
      },
      map: {
        locations: {},
      },
    },
  };
}

/**
 * Available module IDs
 */
export type ModuleId = 'narrative' | 'map' | 'market';

/**
 * Module metadata for UI
 */
export interface ModuleInfo {
  id: ModuleId;
  name: string;
  icon: string;
  description: string;
  available: boolean;
}

/**
 * All available modules
 */
export const AVAILABLE_MODULES: ModuleInfo[] = [
  {
    id: 'narrative',
    name: 'Narrative',
    icon: '💭',
    description: 'Collaborative assumption tracking',
    available: true,
  },
  {
    id: 'map',
    name: 'Karte',
    icon: '🗺️',
    description: 'Collaborative mapping',
    available: true,
  },
  {
    id: 'market',
    name: 'Marktplatz',
    icon: '🛒',
    description: 'Marketplace for offers and needs',
    available: true,
  },
];