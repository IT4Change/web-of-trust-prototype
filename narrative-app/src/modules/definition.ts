/**
 * Narrative Module Definition
 *
 * Defines the module metadata and configuration for the Narrative module.
 * This can be used to register the module in the unified app's module registry.
 */

import type { ModuleDefinition } from 'narrative-ui';
import type { OpinionGraphData } from '../schema/opinion-graph';
import { NarrativeModule } from './NarrativeModule';

/**
 * Create empty Narrative module data
 */
export function createEmptyNarrativeData(): OpinionGraphData {
  return {
    assumptions: {},
    votes: {},
    tags: {},
    edits: {},
  };
}

/**
 * Narrative module definition
 */
export const narrativeModule: ModuleDefinition<OpinionGraphData> = {
  id: 'narrative',
  name: 'Narrative',
  icon: '💭',
  description: 'Collaborative assumption tracking and voting',
  version: '1.0.0',
  createEmptyData: createEmptyNarrativeData,
  // Note: The component needs additional props beyond ModuleProps
  // In practice, the unified app will wrap this with the necessary callbacks
  component: NarrativeModule as any,
};
