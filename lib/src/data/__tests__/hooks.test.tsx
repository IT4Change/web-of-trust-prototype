/**
 * Tests for Data Layer React Hooks
 *
 * Tests the React hooks with the MockDataProvider.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import {
  DataProviderProvider,
  useDataProvider,
  useItems,
  useItem,
  useItemMutations,
  useRelations,
  useRelationMutations,
  useIdentity,
  useTrust,
  useWorkspace,
  useSyncStatus,
} from '..';
import { createMockDataProvider } from '../adapters/mock';
import type { DataProvider } from '../types';

// =============================================================================
// Test Setup
// =============================================================================

function createWrapper(provider: DataProvider) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DataProviderProvider provider={provider}>{children}</DataProviderProvider>
    );
  };
}

// =============================================================================
// useDataProvider Tests
// =============================================================================

describe('useDataProvider', () => {
  it('should return the provider from context', () => {
    const provider = createMockDataProvider();
    const { result } = renderHook(() => useDataProvider(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current).toBe(provider);
  });

  it('should throw when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDataProvider());
    }).toThrow('useDataProvider must be used within a DataProviderProvider');

    consoleSpy.mockRestore();
  });
});

// =============================================================================
// useItems Tests
// =============================================================================

describe('useItems', () => {
  let provider: DataProvider;

  beforeEach(async () => {
    provider = createMockDataProvider({
      initialIdentity: { id: 'user-1', displayName: 'Test User' },
    });

    // Seed some data
    await provider.items.create({
      type: 'assumption',
      createdBy: 'user-1',
      title: 'Assumption 1',
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });
    await provider.items.create({
      type: 'offer',
      createdBy: 'user-1',
      title: 'Offer 1',
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });
  });

  it('should return all items', () => {
    const { result } = renderHook(() => useItems(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should filter items by type', () => {
    const { result } = renderHook(() => useItems({ type: 'assumption' }), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].type).toBe('assumption');
  });

  it('should update when items change', async () => {
    const { result } = renderHook(() => useItems(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.items).toHaveLength(2);

    await act(async () => {
      await provider.items.create({
        type: 'event',
        createdBy: 'user-1',
        title: 'Event 1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
    });

    expect(result.current.items).toHaveLength(3);
  });
});

// =============================================================================
// useItem Tests
// =============================================================================

describe('useItem', () => {
  let provider: DataProvider;
  let itemId: string;

  beforeEach(async () => {
    provider = createMockDataProvider();
    const item = await provider.items.create({
      type: 'test',
      createdBy: 'user-1',
      title: 'Test Item',
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });
    itemId = item.id;
  });

  it('should return single item by id', () => {
    const { result } = renderHook(() => useItem(itemId), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.item).not.toBeNull();
    expect(result.current.item?.title).toBe('Test Item');
  });

  it('should return null for non-existent id', () => {
    const { result } = renderHook(() => useItem('non-existent'), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.item).toBeNull();
  });

  it('should update when item changes', async () => {
    const { result } = renderHook(() => useItem(itemId), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.item?.title).toBe('Test Item');

    await act(async () => {
      await provider.items.update(itemId, { title: 'Updated Title' });
    });

    expect(result.current.item?.title).toBe('Updated Title');
  });
});

// =============================================================================
// useItemMutations Tests
// =============================================================================

describe('useItemMutations', () => {
  let provider: DataProvider;

  beforeEach(() => {
    provider = createMockDataProvider();
  });

  it('should create items', async () => {
    const { result } = renderHook(() => useItemMutations(), {
      wrapper: createWrapper(provider),
    });

    let createdItem: Awaited<ReturnType<typeof result.current.create>>;

    await act(async () => {
      createdItem = await result.current.create({
        type: 'test',
        createdBy: 'user-1',
        title: 'New Item',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
    });

    expect(createdItem!.id).toBeDefined();
    expect(provider.items.list()).toHaveLength(1);
  });

  it('should update items', async () => {
    const item = await provider.items.create({
      type: 'test',
      createdBy: 'user-1',
      title: 'Original',
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });

    const { result } = renderHook(() => useItemMutations(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.update(item.id, { title: 'Updated' });
    });

    expect(provider.items.get(item.id)?.title).toBe('Updated');
  });

  it('should delete items', async () => {
    const item = await provider.items.create({
      type: 'test',
      createdBy: 'user-1',
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });

    const { result } = renderHook(() => useItemMutations(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.remove(item.id);
    });

    expect(provider.items.list()).toHaveLength(0);
  });

  it('should track pending state', async () => {
    const { result } = renderHook(() => useItemMutations(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.isPending).toBe(false);

    const createPromise = act(async () => {
      await result.current.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
    });

    await createPromise;
    expect(result.current.isPending).toBe(false);
  });
});

// =============================================================================
// useRelations Tests
// =============================================================================

describe('useRelations', () => {
  let provider: DataProvider;

  beforeEach(async () => {
    provider = createMockDataProvider();
    await provider.relations.create({
      subject: 'user-1',
      predicate: 'votes_on',
      object: 'item-1',
      createdBy: 'user-1',
    });
    await provider.relations.create({
      subject: 'user-1',
      predicate: 'likes',
      object: 'item-2',
      createdBy: 'user-1',
    });
  });

  it('should return all relations', () => {
    const { result } = renderHook(() => useRelations(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.relations).toHaveLength(2);
  });

  it('should filter relations', () => {
    const { result } = renderHook(() => useRelations({ predicate: 'votes_on' }), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.relations).toHaveLength(1);
  });
});

// =============================================================================
// useIdentity Tests
// =============================================================================

describe('useIdentity', () => {
  let provider: DataProvider;

  beforeEach(() => {
    provider = createMockDataProvider();
  });

  it('should start unauthenticated', () => {
    const { result } = renderHook(() => useIdentity(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.identity).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should sign up', async () => {
    const { result } = renderHook(() => useIdentity(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.signUp({ displayName: 'Test User' });
    });

    expect(result.current.identity).not.toBeNull();
    expect(result.current.identity?.displayName).toBe('Test User');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should sign out', async () => {
    const { result } = renderHook(() => useIdentity(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.signUp();
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.identity).toBeNull();
  });

  it('should update profile', async () => {
    const { result } = renderHook(() => useIdentity(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.signUp({ displayName: 'Original' });
    });

    await act(async () => {
      await result.current.updateProfile({ displayName: 'Updated' });
    });

    expect(result.current.identity?.displayName).toBe('Updated');
  });

  it('should expose capabilities', () => {
    const { result } = renderHook(() => useIdentity(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.capabilities).toBeDefined();
    expect(result.current.capabilities.signInMethods).toBeDefined();
  });
});

// =============================================================================
// useTrust Tests
// =============================================================================

describe('useTrust', () => {
  let provider: DataProvider;

  beforeEach(() => {
    provider = createMockDataProvider({
      initialIdentity: { id: 'user-1', displayName: 'User 1' },
    });
  });

  it('should start with no trust', () => {
    const { result } = renderHook(() => useTrust(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.trustGiven).toHaveLength(0);
    expect(result.current.trustReceived).toHaveLength(0);
  });

  it('should set trust', async () => {
    const { result } = renderHook(() => useTrust(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.setTrust('user-2', 'full');
    });

    expect(result.current.trustGiven).toHaveLength(1);
    expect(result.current.getTrustLevel('user-2')).toBe('full');
  });

  it('should revoke trust', async () => {
    const { result } = renderHook(() => useTrust(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.setTrust('user-2', 'full');
    });

    await act(async () => {
      await result.current.revokeTrust('user-2');
    });

    expect(result.current.trustGiven).toHaveLength(0);
    expect(result.current.getTrustLevel('user-2')).toBeNull();
  });
});

// =============================================================================
// useWorkspace Tests
// =============================================================================

describe('useWorkspace', () => {
  let provider: DataProvider;

  beforeEach(() => {
    provider = createMockDataProvider({
      initialIdentity: { id: 'user-1', displayName: 'User 1' },
      workspaceName: 'Test Workspace',
    });
  });

  it('should return workspace', () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.workspace).not.toBeNull();
    expect(result.current.workspace?.name).toBe('Test Workspace');
    expect(result.current.isLoaded).toBe(true);
  });

  it('should update metadata', async () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.updateMetadata({ name: 'Updated Workspace' });
    });

    expect(result.current.workspace?.name).toBe('Updated Workspace');
  });

  it('should manage enabled modules', async () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: createWrapper(provider),
    });

    await act(async () => {
      await result.current.setEnabledModules(['narrative', 'map']);
    });

    expect(result.current.workspace?.enabledModules).toEqual(['narrative', 'map']);
  });
});

// =============================================================================
// useSyncStatus Tests
// =============================================================================

describe('useSyncStatus', () => {
  it('should return sync status and capabilities', () => {
    const provider = createMockDataProvider();
    const { result } = renderHook(() => useSyncStatus(), {
      wrapper: createWrapper(provider),
    });

    expect(result.current.syncStatus).toBe('synced');
    expect(result.current.capabilities.offline).toBe(true);
    expect(result.current.capabilities.realtime).toBe(false);
  });
});
