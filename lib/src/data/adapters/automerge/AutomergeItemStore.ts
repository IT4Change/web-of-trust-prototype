/**
 * Automerge Item Store
 *
 * ItemStore-Implementierung für Automerge-Dokumente.
 * Speichert Items in einem normalisierten Record innerhalb des Dokuments.
 */

import type { DocHandle } from '@automerge/automerge-repo';
import { generateId } from '../../../schema/document';
import type { Item, ItemFilter, ItemStore } from '../../types';

/**
 * Dokument-Struktur für Items
 */
export interface AutomergeItemsDoc {
  items: Record<string, Item>;
  lastModified: number;
}

/**
 * ItemStore für Automerge-Dokumente
 */
export class AutomergeItemStore implements ItemStore {
  private docHandle: DocHandle<AutomergeItemsDoc>;
  private listeners: Set<(items: Item[]) => void> = new Set();
  private changeHandler: (() => void) | null = null;

  constructor(docHandle: DocHandle<AutomergeItemsDoc>) {
    this.docHandle = docHandle;
    this.setupSubscription();
  }

  private setupSubscription(): void {
    // Automerge doc change subscription
    this.changeHandler = () => this.notifyListeners();
    this.docHandle.on('change', this.changeHandler);
  }

  /**
   * Cleanup when store is no longer needed
   */
  destroy(): void {
    if (this.changeHandler) {
      this.docHandle.off('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.listeners.clear();
  }

  list(filter?: ItemFilter): Item[] {
    const doc = this.docHandle.docSync();
    if (!doc?.items) return [];

    let result = Object.values(doc.items);

    if (filter) {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        result = result.filter((item) => types.includes(item.type));
      }
      if (filter.createdBy) {
        result = result.filter((item) => item.createdBy === filter.createdBy);
      }
      if (filter.tags && filter.tags.length > 0) {
        result = result.filter(
          (item) =>
            item.tags && filter.tags!.some((tag) => item.tags!.includes(tag))
        );
      }
      if (filter.geo === true) {
        result = result.filter((item) => item.geo !== undefined);
      }
      if (filter.dateTime === true) {
        result = result.filter((item) => item.dateTime !== undefined);
      }
      // TODO: Geo radius/polygon filtering
      // TODO: DateTime range filtering
    }

    return result;
  }

  get(id: string): Item | null {
    const doc = this.docHandle.docSync();
    return doc?.items?.[id] ?? null;
  }

  subscribe(callback: (items: Item[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async create(
    item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Item> {
    const now = Date.now();
    const newItem: Item = {
      ...item,
      id: generateId('item'),
      createdAt: now,
      updatedAt: now,
    };

    this.docHandle.change((d) => {
      if (!d.items) {
        d.items = {};
      }
      d.items[newItem.id] = newItem;
      d.lastModified = now;
    });

    return newItem;
  }

  async update(id: string, changes: Partial<Item>): Promise<void> {
    const doc = this.docHandle.docSync();
    if (!doc?.items?.[id]) {
      throw new Error(`Item not found: ${id}`);
    }

    const now = Date.now();

    this.docHandle.change((d) => {
      const item = d.items[id];
      if (!item) return;

      // Apply changes (except id and createdAt)
      Object.entries(changes).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'createdAt') {
          (item as unknown as Record<string, unknown>)[key] = value;
        }
      });

      item.updatedAt = now;
      d.lastModified = now;
    });
  }

  async delete(id: string): Promise<void> {
    this.docHandle.change((d) => {
      if (d.items?.[id]) {
        delete d.items[id];
        d.lastModified = Date.now();
      }
    });
  }

  private notifyListeners(): void {
    const items = this.list();
    this.listeners.forEach((cb) => cb(items));
  }
}
