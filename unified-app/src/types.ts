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
 * Signature matches AppShell's createEmptyDocument requirements
 */
export function createEmptyUnifiedDoc(
  creatorIdentity: UserIdentity,
  workspaceName?: string,
  workspaceAvatar?: string
): UnifiedDocument {
  // Build identity profile, only including defined values (Automerge doesn't allow undefined)
  const identityProfile: Record<string, string> = {};
  if (creatorIdentity.displayName !== undefined) {
    identityProfile.displayName = creatorIdentity.displayName;
  }
  if (creatorIdentity.publicKey !== undefined) {
    identityProfile.publicKey = creatorIdentity.publicKey;
  }

  // Build context with optional name and avatar
  const context: { name: string; avatar?: string } = {
    name: workspaceName || 'New Workspace',
  };
  if (workspaceAvatar) {
    context.avatar = workspaceAvatar;
  }

  return {
    version: '1.0.0',
    lastModified: Date.now(),
    context,
    enabledModules: {
      narrative: true,
      market: true,
      map: true,
    },
    identities: {
      [creatorIdentity.did]: identityProfile,
    },
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