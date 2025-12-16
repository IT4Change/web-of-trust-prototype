import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

/**
 * Data Layer Test app-specific data
 *
 * Add your app-specific types and data structures here.
 */
export interface DataTestAppData {
  // Add your app-specific fields here
  // Example:
  // items: Record<string, Item>;
}

/**
 * Full Data Layer Test Document
 */
export type DataTestAppDoc = BaseDocument<DataTestAppData>;

/**
 * Creates an empty Data Layer Test document
 *
 * @param creatorIdentity - Identity of the user creating the document
 */
export function createEmptyDataTestAppDoc(
  creatorIdentity: UserIdentity
): DataTestAppDoc {
  return createBaseDocument<DataTestAppData>(
    {
      // Initialize your app-specific fields here
    },
    creatorIdentity
  );
}
