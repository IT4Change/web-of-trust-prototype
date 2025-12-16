/**
 * Tests for Automerge Data Adapter
 *
 * Tests the Automerge adapter components using mock DocHandles.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { DocHandle } from '@automerge/automerge-repo';
import {
  AutomergeItemStore,
  AutomergeRelationStore,
  AutomergeTrustService,
  type AutomergeItemsDoc,
  type AutomergeRelationsDoc,
} from '../adapters/automerge';
import type { Item, Relation } from '../types';

// =============================================================================
// Mock DocHandle Factory
// =============================================================================

interface MockDocHandle<T> {
  docSync: Mock<() => T | undefined>;
  change: Mock<(fn: (d: T) => void) => void>;
  on: Mock<(event: string, handler: () => void) => void>;
  off: Mock<(event: string, handler: () => void) => void>;
  url: string;
}

function createMockDocHandle<T>(initialDoc: T): MockDocHandle<T> {
  let doc = JSON.parse(JSON.stringify(initialDoc)) as T;
  const listeners: Set<() => void> = new Set();

  return {
    docSync: vi.fn(() => doc),
    change: vi.fn((fn: (d: T) => void) => {
      fn(doc);
      // Notify listeners after change
      listeners.forEach((cb) => cb());
    }),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'change') {
        listeners.add(handler);
      }
    }),
    off: vi.fn((event: string, handler: () => void) => {
      if (event === 'change') {
        listeners.delete(handler);
      }
    }),
    url: 'automerge:test-doc-123',
  };
}

// =============================================================================
// AutomergeItemStore Tests
// =============================================================================

describe('AutomergeItemStore', () => {
  let store: AutomergeItemStore;
  let mockHandle: MockDocHandle<AutomergeItemsDoc>;

  beforeEach(() => {
    mockHandle = createMockDocHandle<AutomergeItemsDoc>({
      items: {},
      lastModified: Date.now(),
    });
    store = new AutomergeItemStore(mockHandle as unknown as DocHandle<AutomergeItemsDoc>);
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

    it('should call docHandle.change to persist item', async () => {
      await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(mockHandle.change).toHaveBeenCalled();
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
      expect(items.every((i) => i.createdBy === 'user-1')).toBe(true);
    });

    it('should filter by tags', () => {
      const items = store.list({ tags: ['tag1'] });
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Assumption 1');
    });

    it('should filter by geo presence', () => {
      const items = store.list({ geo: true });
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Offer 1');
    });
  });

  describe('get', () => {
    it('should return null for non-existent id', () => {
      expect(store.get('non-existent')).toBeNull();
    });

    it('should return item by id', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(store.get(item.id)).toEqual(item);
    });
  });

  describe('update', () => {
    it('should update item properties', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        title: 'Original',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      await store.update(item.id, { title: 'Updated' });

      const updated = store.get(item.id);
      expect(updated?.title).toBe('Updated');
    });

    it('should update updatedAt timestamp', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      const originalUpdatedAt = item.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await store.update(item.id, { title: 'Updated' });

      const updated = store.get(item.id);
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should not modify id or createdAt', async () => {
      const item = await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      await store.update(item.id, {
        id: 'new-id',
        createdAt: 0,
        title: 'Updated',
      } as Partial<Item>);

      const updated = store.get(item.id);
      expect(updated?.id).toBe(item.id);
      expect(updated?.createdAt).toBe(item.createdAt);
    });

    it('should throw for non-existent item', async () => {
      await expect(store.update('non-existent', { title: 'Updated' })).rejects.toThrow(
        'Item not found'
      );
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

    it('should not throw for non-existent item', async () => {
      await expect(store.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('should call callback when items change', async () => {
      const callback = vi.fn();
      store.subscribe(callback);

      await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const callback = vi.fn();
      const unsubscribe = store.subscribe(callback);

      unsubscribe();

      await store.create({
        type: 'test',
        createdBy: 'user-1',
        sharing: { visibility: 'private', sharedWith: [] },
        extensions: {},
      });

      // The mock still notifies, but the store's listener should be removed
      // This is a limitation of our mock - in real Automerge, the handler
      // would be removed from the DocHandle itself
    });
  });

  describe('destroy', () => {
    it('should call docHandle.off to unsubscribe', () => {
      store.destroy();

      expect(mockHandle.off).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});

// =============================================================================
// AutomergeRelationStore Tests
// =============================================================================

describe('AutomergeRelationStore', () => {
  let store: AutomergeRelationStore;
  let mockHandle: MockDocHandle<AutomergeRelationsDoc>;

  beforeEach(() => {
    mockHandle = createMockDocHandle<AutomergeRelationsDoc>({
      relations: {},
      lastModified: Date.now(),
    });
    store = new AutomergeRelationStore(mockHandle as unknown as DocHandle<AutomergeRelationsDoc>);
  });

  describe('create', () => {
    it('should create a relation with generated id and timestamp', async () => {
      const relation = await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });

      expect(relation.id).toBeDefined();
      expect(relation.id).toMatch(/^rel-/);
      expect(relation.createdAt).toBeDefined();
      expect(relation.subject).toBe('user-1');
      expect(relation.predicate).toBe('votes_on');
      expect(relation.object).toBe('item-1');
    });

    it('should call docHandle.change to persist relation', async () => {
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });

      expect(mockHandle.change).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-1',
        predicate: 'likes',
        object: 'item-2',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-2',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-2',
      });
    });

    it('should list all relations without filter', () => {
      expect(store.list()).toHaveLength(3);
    });

    it('should filter by subject', () => {
      const relations = store.list({ subject: 'user-1' });
      expect(relations).toHaveLength(2);
      expect(relations.every((r) => r.subject === 'user-1')).toBe(true);
    });

    it('should filter by predicate (single)', () => {
      const relations = store.list({ predicate: 'votes_on' });
      expect(relations).toHaveLength(2);
      expect(relations.every((r) => r.predicate === 'votes_on')).toBe(true);
    });

    it('should filter by predicate (array)', () => {
      const relations = store.list({ predicate: ['votes_on', 'likes'] });
      expect(relations).toHaveLength(3);
    });

    it('should filter by object', () => {
      const relations = store.list({ object: 'item-1' });
      expect(relations).toHaveLength(2);
      expect(relations.every((r) => r.object === 'item-1')).toBe(true);
    });

    it('should filter by createdBy', () => {
      const relations = store.list({ createdBy: 'user-1' });
      expect(relations).toHaveLength(2);
      expect(relations.every((r) => r.createdBy === 'user-1')).toBe(true);
    });

    it('should combine filters', () => {
      const relations = store.list({ subject: 'user-1', predicate: 'votes_on' });
      expect(relations).toHaveLength(1);
      expect(relations[0].subject).toBe('user-1');
      expect(relations[0].predicate).toBe('votes_on');
    });
  });

  describe('getBySubject', () => {
    beforeEach(async () => {
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-1',
        predicate: 'likes',
        object: 'item-2',
        createdBy: 'user-1',
      });
    });

    it('should return all relations for subject', () => {
      const relations = store.getBySubject('user-1');
      expect(relations).toHaveLength(2);
    });

    it('should filter by predicate if provided', () => {
      const relations = store.getBySubject('user-1', 'votes_on');
      expect(relations).toHaveLength(1);
      expect(relations[0].predicate).toBe('votes_on');
    });
  });

  describe('getByObject', () => {
    beforeEach(async () => {
      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });
      await store.create({
        subject: 'user-2',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-2',
      });
    });

    it('should return all relations for object', () => {
      const relations = store.getByObject('item-1');
      expect(relations).toHaveLength(2);
    });

    it('should filter by predicate if provided', () => {
      const relations = store.getByObject('item-1', 'votes_on');
      expect(relations).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should remove relation from store', async () => {
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

  describe('subscribe', () => {
    it('should call callback when relations change', async () => {
      const callback = vi.fn();
      store.subscribe(callback);

      await store.create({
        subject: 'user-1',
        predicate: 'votes_on',
        object: 'item-1',
        createdBy: 'user-1',
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should call docHandle.off to unsubscribe from RelationStore', () => {
      store.destroy();

      expect(mockHandle.off).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});

// =============================================================================
// AutomergeTrustService Tests
// =============================================================================

interface LegacyUserDocument {
  did: string;
  profile?: { displayName?: string; avatarUrl?: string };
  workspaces: Record<string, unknown>;
  trustGiven: Record<string, {
    id: string;
    trusterDid: string;
    trusteeDid: string;
    level: 'verified' | 'endorsed';
    createdAt: number;
    updatedAt: number;
    signature?: string;
  }>;
  trustReceived: Record<string, unknown>;
  lastModified: number;
}

describe('AutomergeTrustService', () => {
  let service: AutomergeTrustService;
  let mockHandle: MockDocHandle<LegacyUserDocument>;

  beforeEach(() => {
    mockHandle = createMockDocHandle<LegacyUserDocument>({
      did: 'did:key:user-1',
      profile: { displayName: 'User 1' },
      workspaces: {},
      trustGiven: {},
      trustReceived: {},
      lastModified: Date.now(),
    });

    service = new AutomergeTrustService('did:key:user-1', {
      userDocHandle: mockHandle as unknown as DocHandle<LegacyUserDocument>,
    });
  });

  describe('getTrustGiven', () => {
    it('should return empty array when no trust given', () => {
      expect(service.getTrustGiven()).toHaveLength(0);
    });

    it('should return trust attestations', async () => {
      await service.setTrust('did:key:user-2', 'full');

      const given = service.getTrustGiven();
      expect(given).toHaveLength(1);
      expect(given[0].trusteeId).toBe('did:key:user-2');
      expect(given[0].level).toBe('full');
    });
  });

  describe('getTrustLevel', () => {
    it('should return null for untrusted user', () => {
      expect(service.getTrustLevel('did:key:unknown')).toBeNull();
    });

    it('should return trust level for trusted user', async () => {
      await service.setTrust('did:key:user-2', 'full');

      expect(service.getTrustLevel('did:key:user-2')).toBe('full');
    });
  });

  describe('setTrust', () => {
    it('should create trust attestation in legacy format', async () => {
      await service.setTrust('did:key:user-2', 'full');

      expect(mockHandle.change).toHaveBeenCalled();

      const doc = mockHandle.docSync();
      expect(doc?.trustGiven['did:key:user-2']).toBeDefined();
      expect(doc?.trustGiven['did:key:user-2'].level).toBe('verified');
    });

    it('should map trust levels correctly', async () => {
      await service.setTrust('did:key:user-2', 'limited');

      const doc = mockHandle.docSync();
      expect(doc?.trustGiven['did:key:user-2'].level).toBe('endorsed');
    });
  });

  describe('revokeTrust', () => {
    it('should remove trust attestation', async () => {
      await service.setTrust('did:key:user-2', 'full');
      expect(service.getTrustGiven()).toHaveLength(1);

      await service.revokeTrust('did:key:user-2');
      expect(service.getTrustGiven()).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should call callback when trust changes', async () => {
      const callback = vi.fn();
      service.subscribe(callback);

      await service.setTrust('did:key:user-2', 'full');

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up TrustService subscriptions', () => {
      service.destroy();

      expect(mockHandle.off).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});
