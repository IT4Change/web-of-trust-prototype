/**
 * Data Migration Helpers
 *
 * Exports for migrating between legacy and new data formats.
 */

export {
  // Types
  type LegacyAssumption,
  type LegacyVote,
  type LegacyTag,
  type LegacyEditEntry,
  type LegacyOpinionGraphData,
  type NarrativeExtension,
  type VoteRelationMetadata,
  // Legacy -> Items/Relations
  assumptionToItem,
  voteToRelation,
  migrateLegacyData,
  // Items/Relations -> Legacy
  itemToAssumption,
  relationToVote,
  // Helpers
  getVoteFromRelations,
  getVotesForAssumptionFromRelations,
  computeVoteSummaryFromRelations,
} from './assumptionMigration';
