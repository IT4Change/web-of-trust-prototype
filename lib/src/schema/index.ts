/**
 * Narri data schema for Automerge.
 *
 * Defines the TypeScript types for the CRDT document structure.
 * Automerge automatically handles conflict resolution and syncing.
 */

/**
 * Vote value type: green (agree), yellow (neutral), red (disagree)
 */
export type VoteValue = 'green' | 'yellow' | 'red';

/**
 * User identity (DID-based)
 * For now, we use simple string IDs
 * TODO: Implement proper DID generation
 */
export interface UserIdentity {
  did: string;
  displayName?: string;
  avatarUrl?: string;
  publicKey?: string;
}

/**
 * Optional identity metadata by DID
 */
export interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Tag for categorizing assumptions
 */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdBy: string; // DID
  createdAt: number;
}

/**
 * Single vote on an assumption by a user
 */
export interface Vote {
  id: string;
  assumptionId: string;
  voterDid: string;
  voterName?: string;
  value: VoteValue;
  createdAt: number;
  updatedAt: number;
}

/**
 * Core Assumption entity
 * Represents a statement (single sentence) that can be voted on
 */
export interface Assumption {
  id: string;
  sentence: string;
  createdBy: string; // DID
  createdAt: number;
  updatedAt: number;
  tagIds: string[];
  voteIds: string[];
}

/**
 * Root document structure for Automerge
 * This is the top-level CRDT document
 */
export interface OpinionGraphDoc {
  // User identity
  identity: UserIdentity;
  identities: Record<string, IdentityProfile>;

  // Collections (normalized by ID)
  assumptions: Record<string, Assumption>;
  votes: Record<string, Vote>;
  tags: Record<string, Tag>;

  // Metadata
  version: string;
  lastModified: number;
}

/**
 * Helper type for vote aggregation (computed client-side)
 */
export interface VoteSummary {
  green: number;
  yellow: number;
  red: number;
  total: number;
  userVote?: VoteValue;
}

/**
 * Compute vote summary for an assumption
 */
export function computeVoteSummary(
  assumption: Assumption,
  allVotes: Record<string, Vote>,
  currentUserDid?: string
): VoteSummary {
  const summary: VoteSummary = {
    green: 0,
    yellow: 0,
    red: 0,
    total: 0,
  };

  // Get all votes for this assumption
  const assumptionVotes = assumption.voteIds
    .map((id) => allVotes[id])
    .filter((v): v is Vote => v !== undefined);

  for (const vote of assumptionVotes) {
    if (vote.value === 'green') summary.green++;
    else if (vote.value === 'yellow') summary.yellow++;
    else if (vote.value === 'red') summary.red++;

    summary.total++;

    // Track current user's vote
    if (currentUserDid && vote.voterDid === currentUserDid) {
      summary.userVote = vote.value;
    }
  }

  return summary;
}

/**
 * Create an empty Narri document
 */
export function createEmptyDoc(identity: UserIdentity): OpinionGraphDoc {
  return {
    identity,
    identities: {},
    assumptions: {},
    votes: {},
    tags: {},
    version: '0.1.0',
    lastModified: Date.now(),
  };
}

/**
 * Generate a simple unique ID
 * TODO: Replace with proper UUID or content-addressed ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
