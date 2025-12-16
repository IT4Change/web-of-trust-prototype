/**
 * Data Layer
 *
 * Backend-agnostische Daten-Abstraktion für Narrative.
 */

// Types
export type {
  // Item
  Item,
  ItemDateTime,
  ItemSharing,
  ShareTarget,
  Permission,
  ItemFilter,
  ItemStore,
  // Relations
  Relation,
  CommonPredicate,
  RelationFilter,
  RelationStore,
  // Identity
  Identity,
  SignInMethod,
  IdentityProvider,
  IdentityProviderCapabilities,
  // Trust
  TrustLevel,
  TrustAttestation,
  TrustService,
  // UserDocument
  WorkspaceRef,
  UserDocumentProfile,
  UserDocument,
  UserDocumentService,
  // Workspace
  WorkspaceMemberRole,
  WorkspaceMember,
  Workspace,
  WorkspaceService,
  // DataProvider
  SyncStatus,
  DataProviderCapabilities,
  DataProvider,
  // Adapter
  AdapterType,
  AdapterConfig,
  CreateDataProvider,
} from './types';

// Context & Provider
export {
  DataProviderProvider,
  useDataProvider,
  useDataProviderOptional,
} from './DataProvider';
export type { DataProviderProps } from './DataProvider';

// Hooks
export {
  // Items
  useItems,
  useItem,
  useItemMutations,
  // Relations
  useRelations,
  useRelationsBySubject,
  useRelationsByObject,
  useRelationMutations,
  // Identity
  useIdentity,
  // Trust
  useTrust,
  // UserDocument
  useUserDoc,
  // Workspace
  useWorkspace,
  // Sync
  useSyncStatus,
} from './hooks';
export type {
  UseItemsResult,
  UseItemResult,
  UseItemMutationsResult,
  UseRelationsResult,
  UseRelationMutationsResult,
  UseIdentityResult,
  UseTrustResult,
  UseUserDocResult,
  UseWorkspaceResult,
  UseSyncStatusResult,
} from './hooks';

// Adapters - Mock
export { createMockDataProvider, MockDataProvider } from './adapters/mock';
export type { MockDataProviderOptions } from './adapters/mock';

// Adapters - Automerge
export {
  AutomergeDataProvider,
  createAutomergeDataProvider,
  AutomergeItemStore,
  AutomergeRelationStore,
  AutomergeIdentityProvider,
  AutomergeTrustService,
  AutomergeUserDocService,
  AutomergeWorkspaceService,
} from './adapters/automerge';
export type {
  AutomergeDataProviderOptions,
  AutomergeWorkspaceDataDoc,
  AutomergeItemsDoc,
  AutomergeRelationsDoc,
  AutomergeWorkspaceDoc,
} from './adapters/automerge';

// Migration Helpers
export {
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
} from './migration';
export type {
  LegacyAssumption,
  LegacyVote,
  LegacyTag,
  LegacyEditEntry,
  LegacyOpinionGraphData,
  NarrativeExtension,
  VoteRelationMetadata,
} from './migration';
