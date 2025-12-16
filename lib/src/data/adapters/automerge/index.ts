/**
 * Automerge Adapter
 *
 * DataProvider-Implementierung für Automerge CRDTs.
 * Unterstützt offline-first, real-time Sync und Ed25519 Signaturen.
 */

// Main DataProvider
export {
  AutomergeDataProvider,
  createAutomergeDataProvider,
  type AutomergeDataProviderOptions,
  type AutomergeWorkspaceDataDoc,
} from './AutomergeDataProvider';

// Individual Services
export {
  AutomergeItemStore,
  type AutomergeItemsDoc,
} from './AutomergeItemStore';

export {
  AutomergeRelationStore,
  type AutomergeRelationsDoc,
} from './AutomergeRelationStore';

export {
  AutomergeIdentityProvider,
} from './AutomergeIdentityProvider';

export {
  AutomergeTrustService,
} from './AutomergeTrustService';

export {
  AutomergeUserDocService,
} from './AutomergeUserDocService';

export {
  AutomergeWorkspaceService,
  type AutomergeWorkspaceDoc,
} from './AutomergeWorkspaceService';
