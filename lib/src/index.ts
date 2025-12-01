// Schema exports
export {
  type Assumption,
  type Vote,
  type Tag,
  type UserIdentity,
  type IdentityProfile,
  type OpinionGraphDoc,
  type VoteValue,
  type VoteSummary,
  type EditEntry,
  computeVoteSummary,
  createEmptyDoc,
  generateId,
} from './schema';

// Hooks exports
export { useOpinionGraph, type OpinionGraphHook } from './hooks/useOpinionGraph';
