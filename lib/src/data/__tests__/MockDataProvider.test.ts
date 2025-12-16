/**
 * Tests for MockDataProvider
 *
 * Validates the data layer abstraction using the mock adapter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockDataProvider,
  MockItemStore,
  MockRelationStore,
  MockIdentityProvider,
  MockTrustService,
  createMockDataProvider,
} from '../adapters/mock';
import type { Item, Relation } from '../types';

// =============================================================================
// ItemStore Tests
// =============================================================================

describe('MockItemStore', () => {
  let store: MockItemStore;

  beforeEach(() => {
    store = new MockItemStore();
  });

  describe('create', () => {
    it('should create an item with generated id and timestamps', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        title: 'Test Item',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(item.id).toBeDefined();
      expect(item.id).toMatch(/^item-/);
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
      expect(item.type).toBe('test');
      expect(item.title).toBe('Test Item');
    });

    it('should add item to the store', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(store.list()).toContainEqual(item);
      expect(store.get(item.id)).toEqual(item);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.create({
        type: 'assumption',
        createdBy: 'user-1',
        title: 'Assumption 1',
        tags: ['tag1'],
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
      await store.create({
        type: 'assumption',
        createdBy: 'user-2',
        title: 'Assumption 2',
        tags: ['tag2'],
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
      await store.create({
        type: 'offer',
        createdBy: 'user-1',
        title: 'Offer 1',
        geo: { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });
    });

    it('should list all items without filter', () => {
      expect(store.list()).toHaveLength(3);
    });

    it('should filter by type (single)', () => {
      const assumptions = store.list({ type: 'assumption' });
      expect(assumptions).toHaveLength(2);
      expect(assumptions.every((i) => i.type === 'assumption')).toBe(true);
    });

    it('should filter by type (array)', () => {
      const items = store.list({ type: ['assumption', 'offer'] });
      expect(items).toHaveLength(3);
    });

    it('should filter by createdBy', () => {
      const items = store.list({ createdBy: 'user-1' });
      expect(items).toHaveLength(2);
    });

    it('should filter by tags', () => {
      const items = store.list({ tags: ['tag1'] });
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Assumption 1');
    });

    it('should filter by geo presence', () => {
      const items = store.list({ geo: true });
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('offer');
    });
  });

  describe('update', () => {
    it('should update item and set updatedAt', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        title: 'Original',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      const originalUpdatedAt = item.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await store.update(item.id, { title: 'Updated' });

      const updated = store.get(item.id);
      expect(updated?.title).toBe('Updated');
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(updated?.createdAt).toBe(item.createdAt); // Should not change
    });

    it('should throw on non-existent item', async () => {
      await expect(store.update('non-existent', { title: 'x' })).rejects.toThrow(
        'Item not found'
      );
    });

    it('should not allow changing id or createdAt', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      await store.update(item.id, {
        id: 'hacked-id',
        createdAt: 0,
      } as Partial<Item>);

      const updated = store.get(item.id);
      expect(updated?.id).toBe(item.id);
      expect(updated?.createdAt).toBe(item.createdAt);
    });
  });

  describe('delete', () => {
    it('should remove item from store', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      await store.delete(item.id);

      expect(store.get(item.id)).toBeNull();
      expect(store.list()).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should notify on create', async () => {
      const callback = vi.fn();
      store.subscribe(callback);

      await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ type: 'test' }),
      ]));
    });

    it('should notify on update', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      const callback = vi.fn();
      store.subscribe(callback);

      await store.update(item.id, { title: 'Updated' });

      expect(callback).toHaveBeenCalled();
    });

    it('should notify on delete', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      const callback = vi.fn();
      store.subscribe(callback);

      await store.delete(item.id);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should unsubscribe correctly', async () => {
      const callback = vi.fn();
      const unsubscribe = store.subscribe(callback);

      unsubscribe();

      await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// RelationStore Tests
// =============================================================================

describe('MockRelationStore', () => {
  let store: MockRelationStore;

  beforeEach(() => {
    store = new MockRelationStore();
  });

  describe('create', () => {
    it('should create a relation with generated id and timestamp', async () => {
      const relation = await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
        metadata: { value: 'green' },
      });

      expect(relation.id).toBeDefined();
      expect(relation.id).toMatch(/^rel-/);
      expect(relation.createdAt).toBeDefined();
      expect(relation.predicate).toBe('votes_on');
      expect(relation.metadata).toEqual({ value: 'green' });
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-2',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-2',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-2',
      });
      await store.create({
        subject: 'item-1',
        predicate: 'parent_of',
        object: 'item-3',
        createdBy: 'user-1',
      });
    });

    it('should filter by subject', () => {
      const relations = store.list({ subject: 'user-1' });
      expect(relations).toHaveLength(2);
    });

    it('should filter by object', () => {
      const relations = store.list({ object: 'item-1' });
      expect(relations).toHaveLength(2);
    });

    it('should filter by predicate', () => {
      const relations = store.list({ predicate: 'votes_on' });
      expect(relations).toHaveLength(3);
    });

    it('should filter by multiple predicates', () => {
      const relations = store.list({ predicate: ['votes_on', 'parent_of'] });
      expect(relations).toHaveLength(4);
    });

    it('should combine filters', () => {
      const relations = store.list({ subject: 'user-1', predicate: 'votes_on' });
      expect(relations).toHaveLength(2);
    });

    it('getBySubject should work', () => {
      const relations = store.getBySubject('user-1', 'votes_on');
      expect(relations).toHaveLength(2);
    });

    it('getByObject should work', () => {
      const relations = store.getByObject('item-1');
      expect(relations).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should remove relation', async () => {
      const relation = await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });

      await store.delete(relation.id);

      expect(store.list()).toHaveLength(0);
    });
  });
});

// =============================================================================
// IdentityProvider Tests
// =============================================================================

describe('MockIdentityProvider', () => {
  let provider: MockIdentityProvider;

  beforeEach(() => {
    provider = new MockIdentityProvider();
  });

  it('should start unauthenticated', () => {
    expect(provider.isAuthenticated()).toBe(false);
    expect(provider.getCurrentIdentity()).toBeNull();
  });

  it('should sign up with generated id', async () => {
    const identity = await provider.signUp({ displayName: 'Test User' });

    expect(identity.id).toMatch(/^mock:/);
    expect(identity.displayName).toBe('Test User');
    expect(provider.isAuthenticated()).toBe(true);
  });

  it('should sign up with default name if not provided', async () => {
    const identity = await provider.signUp();

    expect(identity.displayName).toMatch(/^User-/);
  });

  it('should sign out', async () => {
    await provider.signUp();
    await provider.signOut();

    expect(provider.isAuthenticated()).toBe(false);
    expect(provider.getCurrentIdentity()).toBeNull();
  });

  it('should update profile', async () => {
    await provider.signUp({ displayName: 'Original' });
    await provider.updateProfile({ displayName: 'Updated', avatarUrl: 'http://example.com/avatar.png' });

    const identity = provider.getCurrentIdentity();
    expect(identity?.displayName).toBe('Updated');
    expect(identity?.avatarUrl).toBe('http://example.com/avatar.png');
  });

  it('should notify subscribers on changes', async () => {
    const callback = vi.fn();
    provider.subscribe(callback);

    await provider.signUp();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String),
    }));
  });

  it('should report capabilities', () => {
    expect(provider.capabilities.canExportMnemonic).toBe(false);
    expect(provider.capabilities.canExportKeyFile).toBe(true);
    expect(provider.capabilities.signInMethods).toContain('keyFile');
  });
});

// =============================================================================
// TrustService Tests
// =============================================================================

describe('MockTrustService', () => {
  let service: MockTrustService;

  beforeEach(() => {
    service = new MockTrustService('user-1');
  });

  it('should start with no trust', () => {
    expect(service.getTrustGiven()).toHaveLength(0);
    expect(service.getTrustReceived()).toHaveLength(0);
    expect(service.getTrustLevel('user-2')).toBeNull();
  });

  it('should set trust', async () => {
    await service.setTrust('user-2', 'full');

    expect(service.getTrustLevel('user-2')).toBe('full');
    expect(service.getTrustGiven()).toHaveLength(1);
  });

  it('should update trust level', async () => {
    await service.setTrust('user-2', 'full');
    await service.setTrust('user-2', 'limited');

    expect(service.getTrustLevel('user-2')).toBe('limited');
    expect(service.getTrustGiven()).toHaveLength(1);
  });

  it('should revoke trust', async () => {
    await service.setTrust('user-2', 'full');
    await service.revokeTrust('user-2');

    expect(service.getTrustLevel('user-2')).toBeNull();
    expect(service.getTrustGiven()).toHaveLength(0);
  });

  it('should track received trust', () => {
    service._addReceivedTrust({
      id: 'trust-1',
      trustorId: 'user-2',
      trusteeId: 'user-1',
      level: 'full',
      createdAt: Date.now(),
    });

    expect(service.getTrustReceived()).toHaveLength(1);
  });
});

// =============================================================================
// DataProvider Integration Tests
// =============================================================================

describe('MockDataProvider', () => {
  it('should create with default options', () => {
    const provider = createMockDataProvider();

    expect(provider.items).toBeDefined();
    expect(provider.relations).toBeDefined();
    expect(provider.identity).toBeDefined();
    expect(provider.trust).toBeDefined();
    expect(provider.userDoc).toBeDefined();
    expect(provider.workspace).toBeDefined();
  });

  it('should create with initial identity', () => {
    const provider = createMockDataProvider({
      initialIdentity: { id: 'test-user', displayName: 'Test User' },
    });

    expect(provider.identity.isAuthenticated()).toBe(true);
  });

  it('should report capabilities', () => {
    const provider = createMockDataProvider();

    expect(provider.capabilities.offline).toBe(true);
    expect(provider.capabilities.realtime).toBe(false);
    expect(provider.syncStatus).toBe('synced');
  });

  it('should allow full item lifecycle', async () => {
    const provider = createMockDataProvider({
      initialIdentity: { id: 'user-1', displayName: 'User 1' },
    });

    // Create item
    const item = await provider.items.create({
      type: 'assumption',
      createdBy: 'user-1',
      title: 'Test assumption',
      sharing: { visibility: 'shared', sharedWith: [] },
      extensions: { narrative: { sentiment: 'positive' } },
    });

    // Create relation (vote)
    const vote = await provider.relations.create({
      subject: 'user-1',
      predicate: 'votes_on',
      object: item.id,
      createdBy: 'user-1',
      metadata: { value: 'green' },
    });

    // Query
    expect(provider.items.list({ type: 'assumption' })).toHaveLength(1);
    expect(provider.relations.getByObject(item.id)).toHaveLength(1);

    // Update
    await provider.items.update(item.id, { title: 'Updated assumption' });
    expect(provider.items.get(item.id)?.title).toBe('Updated assumption');

    // Delete
    await provider.relations.delete(vote.id);
    await provider.items.delete(item.id);

    expect(provider.items.list()).toHaveLength(0);
    expect(provider.relations.list()).toHaveLength(0);
  });
});
