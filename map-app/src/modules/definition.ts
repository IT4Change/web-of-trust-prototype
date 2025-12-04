/**
 * Map Module Definition
 *
 * Provides module metadata and factory functions for the Map module.
 */

import type { ModuleDefinition } from 'narrative-ui';
import type { MapData } from '../schema/map-data';
import { MapModule } from './MapModule';

/**
 * Create empty map data structure
 */
export function createEmptyMapData(): MapData {
  return {
    locations: {},
  };
}

/**
 * Map module definition for registration with unified apps
 */
export const mapModule: ModuleDefinition<MapData> = {
  id: 'map',
  name: 'Karte',
  icon: '🗺️',
  description: 'Collaborative map for sharing locations',
  version: '1.0.0',
  createEmptyData: createEmptyMapData,
  component: MapModule as any,
};
