/**
 * Automerge Relation Store
 *
 * RelationStore-Implementierung für Automerge-Dokumente.
 */

import type { DocHandle } from '@automerge/automerge-repo';
import { generateId } from '../../../schema/document';
import type { Relation, RelationFilter, RelationStore } from '../../types';

/**
 * Dokument-Struktur für Relations
 */
export interface AutomergeRelationsDoc {
  relations: Record<string, Relation>;
  lastModified: number;
}

/**
 * RelationStore für Automerge-Dokumente
 */
export class AutomergeRelationStore implements RelationStore {
  private docHandle: DocHandle<AutomergeRelationsDoc>;
  private listeners: Set<(relations: Relation[]) => void> = new Set();
  private changeHandler: (() => void) | null = null;

  constructor(docHandle: DocHandle<AutomergeRelationsDoc>) {
    this.docHandle = docHandle;
    this.setupSubscription();
  }

  private setupSubscription(): void {
    this.changeHandler = () => this.notifyListeners();
    this.docHandle.on('change', this.changeHandler);
  }

  destroy(): void {
    if (this.changeHandler) {
      this.docHandle.off('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.listeners.clear();
  }

  list(filter?: RelationFilter): Relation[] {
    const doc = this.docHandle.docSync();
    if (!doc?.relations) return [];

    let result = Object.values(doc.relations);

    if (filter) {
      if (filter.subject) {
        result = result.filter((r) => r.subject === filter.subject);
      }
      if (filter.predicate) {
        const predicates = Array.isArray(filter.predicate)
          ? filter.predicate
          : [filter.predicate];
        result = result.filter((r) => predicates.includes(r.predicate));
      }
      if (filter.object) {
        result = result.filter((r) => r.object === filter.object);
      }
      if (filter.createdBy) {
        result = result.filter((r) => r.createdBy === filter.createdBy);
      }
    }

    return result;
  }

  getBySubject(subjectId: string, predicate?: string): Relation[] {
    return this.list({ subject: subjectId, predicate });
  }

  getByObject(objectId: string, predicate?: string): Relation[] {
    return this.list({ object: objectId, predicate });
  }

  subscribe(callback: (relations: Relation[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async create(relation: Omit<Relation, 'id' | 'createdAt'>): Promise<Relation> {
    const now = Date.now();
    const newRelation: Relation = {
      ...relation,
      id: generateId('rel'),
      createdAt: now,
    };

    this.docHandle.change((d) => {
      if (!d.relations) {
        d.relations = {};
      }
      d.relations[newRelation.id] = newRelation;
      d.lastModified = now;
    });

    return newRelation;
  }

  async delete(id: string): Promise<void> {
    this.docHandle.change((d) => {
      if (d.relations?.[id]) {
        delete d.relations[id];
        d.lastModified = Date.now();
      }
    });
  }

  private notifyListeners(): void {
    const relations = this.list();
    this.listeners.forEach((cb) => cb(relations));
  }
}
