/**
 * Market Module Definition
 *
 * Metadata and factory function for the Market module.
 */

import type { ModuleDefinition } from 'narrative-ui';
import type { MarketAppData } from '../schema';
import { MarketModule } from './MarketModule';

/**
 * Create empty market data
 */
export function createEmptyMarketData(): MarketAppData {
  return {
    listings: {},
    reactions: {},
  };
}

/**
 * Market module definition
 */
export const marketModule: ModuleDefinition<MarketAppData> = {
  id: 'market',
  name: 'Marktplatz',
  icon: '🛒',
  description: 'Collaborative marketplace for offers and needs',
  version: '1.0.0',
  createEmptyData: createEmptyMarketData,
  component: MarketModule as any, // Type cast needed due to extended props
};
