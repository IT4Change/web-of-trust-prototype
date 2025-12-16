/**
 * Data Hooks
 *
 * React Hooks für den Zugriff auf die verschiedenen Services des DataProviders.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataProvider } from './DataProvider';
import type {
  Item,
  ItemFilter,
  Relation,
  RelationFilter,
  Identity,
  TrustAttestation,
  TrustLevel,
  UserDocument,
  Workspace,
  SyncStatus,
} from './types';

// =============================================================================
// Items
// =============================================================================

export interface UseItemsResult {
  items: Item[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook für den Zugriff auf Items
 */
export function useItems(filter?: ItemFilter): UseItemsResult {
  const { items: itemStore } = useDataProvider();
  const [itemList, setItemList] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const initialItems = itemStore.list(filter);
      setItemList(initialItems);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }

    const unsubscribe = itemStore.subscribe((allItems) => {
      // Filter anwenden wenn vorhanden
      // TODO: Optimierung - Filter sollte im Store passieren
      setItemList(filter ? itemStore.list(filter) : allItems);
    });

    return unsubscribe;
  }, [itemStore, JSON.stringify(filter)]);

  return { items: itemList, isLoading, error };
}

export interface UseItemResult {
  item: Item | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook für den Zugriff auf ein einzelnes Item
 */
export function useItem(id: string): UseItemResult {
  const { items: itemStore } = useDataProvider();
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const initialItem = itemStore.get(id);
      setItem(initialItem);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }

    const unsubscribe = itemStore.subscribe(() => {
      setItem(itemStore.get(id));
    });

    return unsubscribe;
  }, [itemStore, id]);

  return { item, isLoading, error };
}

export interface UseItemMutationsResult {
  create: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Item>;
  update: (id: string, changes: Partial<Item>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook für Item-Mutationen
 */
export function useItemMutations(): UseItemMutationsResult {
  const { items: itemStore } = useDataProvider();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
      setIsPending(true);
      setError(null);
      try {
        const created = await itemStore.create(item);
        return created;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [itemStore]
  );

  const update = useCallback(
    async (id: string, changes: Partial<Item>) => {
      setIsPending(true);
      setError(null);
      try {
        await itemStore.update(id, changes);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [itemStore]
  );

  const remove = useCallback(
    async (id: string) => {
      setIsPending(true);
      setError(null);
      try {
        await itemStore.delete(id);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [itemStore]
  );

  return { create, update, remove, isPending, error };
}

// =============================================================================
// Relations
// =============================================================================

export interface UseRelationsResult {
  relations: Relation[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook für den Zugriff auf Relations
 */
export function useRelations(filter?: RelationFilter): UseRelationsResult {
  const { relations: relationStore } = useDataProvider();
  const [relationList, setRelationList] = useState<Relation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const initialRelations = relationStore.list(filter);
      setRelationList(initialRelations);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }

    const unsubscribe = relationStore.subscribe((allRelations) => {
      setRelationList(filter ? relationStore.list(filter) : allRelations);
    });

    return unsubscribe;
  }, [relationStore, JSON.stringify(filter)]);

  return { relations: relationList, isLoading, error };
}

/**
 * Hook für Relations eines bestimmten Subjects
 */
export function useRelationsBySubject(
  subjectId: string,
  predicate?: string
): UseRelationsResult {
  const { relations: relationStore } = useDataProvider();
  const [relationList, setRelationList] = useState<Relation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const initialRelations = relationStore.getBySubject(subjectId, predicate);
      setRelationList(initialRelations);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }

    const unsubscribe = relationStore.subscribe(() => {
      setRelationList(relationStore.getBySubject(subjectId, predicate));
    });

    return unsubscribe;
  }, [relationStore, subjectId, predicate]);

  return { relations: relationList, isLoading, error };
}

/**
 * Hook für Relations eines bestimmten Objects
 */
export function useRelationsByObject(
  objectId: string,
  predicate?: string
): UseRelationsResult {
  const { relations: relationStore } = useDataProvider();
  const [relationList, setRelationList] = useState<Relation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const initialRelations = relationStore.getByObject(objectId, predicate);
      setRelationList(initialRelations);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }

    const unsubscribe = relationStore.subscribe(() => {
      setRelationList(relationStore.getByObject(objectId, predicate));
    });

    return unsubscribe;
  }, [relationStore, objectId, predicate]);

  return { relations: relationList, isLoading, error };
}

export interface UseRelationMutationsResult {
  create: (
    relation: Omit<Relation, 'id' | 'createdAt'>
  ) => Promise<Relation>;
  remove: (id: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook für Relation-Mutationen
 */
export function useRelationMutations(): UseRelationMutationsResult {
  const { relations: relationStore } = useDataProvider();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (relation: Omit<Relation, 'id' | 'createdAt'>) => {
      setIsPending(true);
      setError(null);
      try {
        const created = await relationStore.create(relation);
        return created;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [relationStore]
  );

  const remove = useCallback(
    async (id: string) => {
      setIsPending(true);
      setError(null);
      try {
        await relationStore.delete(id);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [relationStore]
  );

  return { create, remove, isPending, error };
}

// =============================================================================
// Identity
// =============================================================================

export interface UseIdentityResult {
  identity: Identity | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (params?: { displayName?: string }) => Promise<Identity>;
  signIn: (method: import('./types').SignInMethod) => Promise<Identity>;
  signOut: () => Promise<void>;
  updateProfile: (changes: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  capabilities: import('./types').IdentityProviderCapabilities;
}

/**
 * Hook für Identity-Management
 */
export function useIdentity(): UseIdentityResult {
  const { identity: identityProvider } = useDataProvider();
  const [identity, setIdentity] = useState<Identity | null>(
    identityProvider.getCurrentIdentity()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = identityProvider.subscribe(setIdentity);
    return unsubscribe;
  }, [identityProvider]);

  const signUp = useCallback(
    async (params?: { displayName?: string }) => {
      setIsLoading(true);
      try {
        return await identityProvider.signUp(params);
      } finally {
        setIsLoading(false);
      }
    },
    [identityProvider]
  );

  const signIn = useCallback(
    async (method: import('./types').SignInMethod) => {
      setIsLoading(true);
      try {
        return await identityProvider.signIn(method);
      } finally {
        setIsLoading(false);
      }
    },
    [identityProvider]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await identityProvider.signOut();
    } finally {
      setIsLoading(false);
    }
  }, [identityProvider]);

  const updateProfile = useCallback(
    async (changes: { displayName?: string; avatarUrl?: string }) => {
      await identityProvider.updateProfile(changes);
    },
    [identityProvider]
  );

  return {
    identity,
    isAuthenticated: identityProvider.isAuthenticated(),
    isLoading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    capabilities: identityProvider.capabilities,
  };
}

// =============================================================================
// Trust
// =============================================================================

export interface UseTrustResult {
  trustGiven: TrustAttestation[];
  trustReceived: TrustAttestation[];
  getTrustLevel: (identityId: string) => TrustLevel | null;
  setTrust: (trusteeId: string, level: TrustLevel) => Promise<void>;
  revokeTrust: (trusteeId: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook für Trust-Management
 */
export function useTrust(): UseTrustResult {
  const { trust: trustService } = useDataProvider();
  const [trustGiven, setTrustGiven] = useState<TrustAttestation[]>(
    trustService.getTrustGiven()
  );
  const [trustReceived, setTrustReceived] = useState<TrustAttestation[]>(
    trustService.getTrustReceived()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = trustService.subscribe(() => {
      setTrustGiven(trustService.getTrustGiven());
      setTrustReceived(trustService.getTrustReceived());
    });
    return unsubscribe;
  }, [trustService]);

  const getTrustLevel = useCallback(
    (identityId: string) => trustService.getTrustLevel(identityId),
    [trustService]
  );

  const setTrust = useCallback(
    async (trusteeId: string, level: TrustLevel) => {
      setIsLoading(true);
      try {
        await trustService.setTrust(trusteeId, level);
      } finally {
        setIsLoading(false);
      }
    },
    [trustService]
  );

  const revokeTrust = useCallback(
    async (trusteeId: string) => {
      setIsLoading(true);
      try {
        await trustService.revokeTrust(trusteeId);
      } finally {
        setIsLoading(false);
      }
    },
    [trustService]
  );

  return {
    trustGiven,
    trustReceived,
    getTrustLevel,
    setTrust,
    revokeTrust,
    isLoading,
  };
}

// =============================================================================
// UserDocument
// =============================================================================

export interface UseUserDocResult {
  userDoc: UserDocument | null;
  isLoaded: boolean;
  updateProfile: (
    changes: Partial<{ displayName: string; avatarUrl?: string }>
  ) => Promise<void>;
  addWorkspace: (ref: import('./types').WorkspaceRef) => Promise<void>;
  removeWorkspace: (workspaceId: string) => Promise<void>;
}

/**
 * Hook für UserDocument-Management
 */
export function useUserDoc(): UseUserDocResult {
  const { userDoc: userDocService } = useDataProvider();
  const [userDoc, setUserDoc] = useState<UserDocument | null>(
    userDocService.get()
  );

  useEffect(() => {
    const unsubscribe = userDocService.subscribe(setUserDoc);
    return unsubscribe;
  }, [userDocService]);

  const updateProfile = useCallback(
    async (changes: Partial<{ displayName: string; avatarUrl?: string }>) => {
      await userDocService.updateProfile(changes);
    },
    [userDocService]
  );

  const addWorkspace = useCallback(
    async (ref: import('./types').WorkspaceRef) => {
      await userDocService.addWorkspace(ref);
    },
    [userDocService]
  );

  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      await userDocService.removeWorkspace(workspaceId);
    },
    [userDocService]
  );

  return {
    userDoc,
    isLoaded: userDocService.isLoaded(),
    updateProfile,
    addWorkspace,
    removeWorkspace,
  };
}

// =============================================================================
// Workspace
// =============================================================================

export interface UseWorkspaceResult {
  workspace: Workspace | null;
  isLoaded: boolean;
  updateMetadata: (
    changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>
  ) => Promise<void>;
  setEnabledModules: (moduleIds: string[]) => Promise<void>;
  getMember: (identityId: string) => Workspace['members'][string] | null;
  updateMember: (
    identityId: string,
    changes: Partial<Workspace['members'][string]>
  ) => Promise<void>;
}

/**
 * Hook für Workspace-Management
 */
export function useWorkspace(): UseWorkspaceResult {
  const { workspace: workspaceService } = useDataProvider();
  const [workspace, setWorkspace] = useState<Workspace | null>(
    workspaceService.get()
  );

  useEffect(() => {
    const unsubscribe = workspaceService.subscribe(setWorkspace);
    return unsubscribe;
  }, [workspaceService]);

  const updateMetadata = useCallback(
    async (changes: Partial<Pick<Workspace, 'name' | 'avatarUrl'>>) => {
      await workspaceService.updateMetadata(changes);
    },
    [workspaceService]
  );

  const setEnabledModules = useCallback(
    async (moduleIds: string[]) => {
      await workspaceService.setEnabledModules(moduleIds);
    },
    [workspaceService]
  );

  const getMember = useCallback(
    (identityId: string) => workspaceService.getMember(identityId),
    [workspaceService]
  );

  const updateMember = useCallback(
    async (
      identityId: string,
      changes: Partial<Workspace['members'][string]>
    ) => {
      await workspaceService.updateMember(identityId, changes);
    },
    [workspaceService]
  );

  return {
    workspace,
    isLoaded: workspaceService.isLoaded(),
    updateMetadata,
    setEnabledModules,
    getMember,
    updateMember,
  };
}

// =============================================================================
// Sync Status
// =============================================================================

export interface UseSyncStatusResult {
  syncStatus: SyncStatus;
  capabilities: ReturnType<typeof useDataProvider>['capabilities'];
}

/**
 * Hook für Sync-Status und Capabilities
 */
export function useSyncStatus(): UseSyncStatusResult {
  const provider = useDataProvider();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(provider.syncStatus);

  useEffect(() => {
    const unsubscribe = provider.onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, [provider]);

  return {
    syncStatus,
    capabilities: provider.capabilities,
  };
}
