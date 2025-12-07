/**
 * useDocumentChanges Hook
 *
 * Tracks LIVE document changes during the session only.
 * Does NOT reconstruct history from Automerge (too expensive).
 *
 * @example
 * ```tsx
 * const { changes, latestChange, hasNewChanges } = useDocumentChanges(docHandle, {
 *   currentUserDid,
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';

/** Entity types that can be tracked */
export type EntityType =
  | 'assumption'
  | 'vote'
  | 'tag'
  | 'identity'
  | 'trust'
  | 'voucher'
  | 'listing'
  | 'location'
  | 'reaction'
  | 'workspace'
  | 'profile'
  | 'other';

/** Change types */
export type ChangeType = 'create' | 'update' | 'delete';

/** Priority levels for notifications */
export type ChangePriority = 'low' | 'medium' | 'high';

/**
 * A human-readable change entry
 */
export interface ChangeEntry {
  /** Unique ID */
  id: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Type of entity that was changed */
  entityType: EntityType;
  /** Human-readable summary */
  summary: string;
  /** The affected object (for JSON display) */
  affectedObject?: unknown;
  /** Path to the changed data */
  path: string;
  /** Priority for notifications */
  priority: ChangePriority;
  /** Whether this is from a remote peer */
  isRemote: boolean;
}

export interface UseDocumentChangesOptions {
  /** Maximum number of changes to keep (default: 50) */
  limit?: number;
  /** Current user's DID (for detecting own vs remote changes) */
  currentUserDid?: string;
  /** Identities map for actor names */
  identities?: Record<string, { displayName?: string }>;
}

export interface UseDocumentChangesResult {
  /** List of change entries (most recent first) */
  changes: ChangeEntry[];
  /** The most recent change */
  latestChange: ChangeEntry | null;
  /** Whether there are new changes since last clear */
  hasNewChanges: boolean;
  /** Clear the "new changes" flag */
  clearNewChanges: () => void;
  /** Clear all changes */
  clearAll: () => void;
}

/**
 * Map path segments to entity types
 */
function getEntityTypeFromPath(path: string): EntityType {
  if (path.includes('assumptions')) return 'assumption';
  if (path.includes('votes')) return 'vote';
  if (path.includes('tags')) return 'tag';
  if (path.includes('identities')) return 'identity';
  if (path.includes('trustGiven') || path.includes('trustReceived')) return 'trust';
  if (path.includes('vouchers')) return 'voucher';
  if (path.includes('listings')) return 'listing';
  if (path.includes('locations')) return 'location';
  if (path.includes('reactions')) return 'reaction';
  if (path.includes('workspaces')) return 'workspace';
  if (path.includes('profile')) return 'profile';
  return 'other';
}

/**
 * Get human-readable name for entity type
 */
function getEntityTypeName(entityType: EntityType): string {
  const names: Record<EntityType, string> = {
    assumption: 'Annahme',
    vote: 'Bewertung',
    tag: 'Tag',
    identity: 'Identität',
    trust: 'Vertrauen',
    voucher: 'Gutschein',
    listing: 'Inserat',
    location: 'Standort',
    reaction: 'Reaktion',
    workspace: 'Workspace',
    profile: 'Profil',
    other: 'Dokument',
  };
  return names[entityType];
}

/**
 * Determine priority based on entity type
 */
function getPriority(entityType: EntityType): ChangePriority {
  if (entityType === 'trust') return 'high';
  if (entityType === 'vote') return 'medium';
  if (['assumption', 'listing', 'voucher'].includes(entityType)) return 'medium';
  return 'low';
}

/**
 * Extract object at path from document
 */
function getObjectAtPath(doc: unknown, pathParts: string[]): unknown {
  let obj: unknown = doc;
  for (const part of pathParts) {
    if (obj === null || obj === undefined) return undefined;
    obj = (obj as Record<string, unknown>)[part];
  }
  return obj;
}

let changeIdCounter = 0;

/**
 * Hook to track LIVE document changes during the session.
 * Does not reconstruct history - only captures changes as they happen.
 */
export function useDocumentChanges(
  docHandle: DocHandle<unknown> | undefined,
  options: UseDocumentChangesOptions = {}
): UseDocumentChangesResult {
  const { limit = 50 } = options;

  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const isFirstRenderRef = useRef(true);

  /**
   * Handle document change events
   */
  const handleChange = useCallback((event: { patches: Array<{ path: (string | number)[]; action: string }> }) => {
    if (!docHandle) return;

    // Skip the first render (initial document load)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const doc = docHandle.doc();
    if (!doc) return;

    const { patches } = event;
    if (!patches || patches.length === 0) return;

    // Group patches by their root path (e.g., data.assumptions.id)
    const pathGroups = new Map<string, typeof patches>();

    for (const patch of patches) {
      const pathParts = patch.path.map(String);
      // Get meaningful path depth (usually 3 for data.xxx.id)
      const depth = pathParts[0] === 'data' ? 3 : 2;
      const rootPath = pathParts.slice(0, Math.min(depth, pathParts.length)).join('.');

      if (!pathGroups.has(rootPath)) {
        pathGroups.set(rootPath, []);
      }
      pathGroups.get(rootPath)!.push(patch);
    }

    // Create change entries for each group
    const newEntries: ChangeEntry[] = [];
    const timestamp = Date.now();

    for (const [path, groupPatches] of pathGroups) {
      const entityType = getEntityTypeFromPath(path);
      const entityName = getEntityTypeName(entityType);

      // Determine if it's create, update, or delete
      const hasDelete = groupPatches.some(p => p.action === 'del');
      const hasPut = groupPatches.some(p => p.action === 'put');

      let action = 'aktualisiert';
      if (hasDelete && !hasPut) {
        action = 'entfernt';
      } else if (groupPatches.length > 5) {
        action = 'erstellt'; // Many patches usually means new object
      }

      // Get the affected object
      const pathParts = path.split('.');
      const affectedObject = getObjectAtPath(doc, pathParts);

      // Generate summary
      let summary = `${entityName} ${action}`;
      if (affectedObject && typeof affectedObject === 'object') {
        const obj = affectedObject as Record<string, unknown>;
        if (typeof obj.sentence === 'string') {
          const text = obj.sentence.length > 30 ? obj.sentence.substring(0, 30) + '...' : obj.sentence;
          summary = `${entityName}: "${text}"`;
        } else if (typeof obj.title === 'string') {
          const text = obj.title.length > 30 ? obj.title.substring(0, 30) + '...' : obj.title;
          summary = `${entityName}: "${text}"`;
        } else if (typeof obj.displayName === 'string') {
          summary = `${entityName}: ${obj.displayName}`;
        }
      }

      newEntries.push({
        id: `change-${++changeIdCounter}`,
        timestamp,
        entityType,
        summary,
        affectedObject,
        path,
        priority: getPriority(entityType),
        isRemote: false, // We can't easily detect this without actor info
      });
    }

    if (newEntries.length > 0) {
      setChanges(prev => [...newEntries, ...prev].slice(0, limit));
      setHasNewChanges(true);
    }
  }, [docHandle, limit]);

  // Subscribe to document changes
  useEffect(() => {
    if (!docHandle) return;

    isFirstRenderRef.current = true;

    // Type assertion for the event handler
    const handler = handleChange as (event: unknown) => void;
    docHandle.on('change', handler);

    return () => {
      docHandle.off('change', handler);
    };
  }, [docHandle, handleChange]);

  const latestChange = useMemo(() => changes[0] || null, [changes]);

  const clearNewChanges = useCallback(() => {
    setHasNewChanges(false);
  }, []);

  const clearAll = useCallback(() => {
    setChanges([]);
    setHasNewChanges(false);
  }, []);

  return {
    changes,
    latestChange,
    hasNewChanges,
    clearNewChanges,
    clearAll,
  };
}
