/**
 * useCrossTabSync - Hook for cross-tab synchronization
 *
 * Listens to localStorage changes from other tabs and triggers
 * callbacks when shared data changes (identity, user document, etc.)
 *
 * This enables real-time updates across multiple browser tabs
 * without relying solely on Automerge sync.
 */

import { useEffect, useCallback } from 'react';
import type { StoredIdentity } from '../utils/storage';
import { loadSharedIdentity } from '../utils/storage';
import { loadUserDocId } from './useUserDocument';

const SHARED_IDENTITY_KEY = 'narrative_shared_identity';
const USER_DOC_KEY = 'narrative_user_doc_id';

export interface CrossTabSyncOptions {
  /**
   * Called when identity changes in another tab
   * Return true to reload the page, false to handle manually
   */
  onIdentityChange?: (newIdentity: StoredIdentity | null) => boolean | void;

  /**
   * Called when user document ID changes in another tab
   */
  onUserDocChange?: (newDocId: string | null) => void;

  /**
   * Enable automatic page reload on identity change
   * @default true
   */
  autoReloadOnIdentityChange?: boolean;
}

/**
 * Hook for cross-tab synchronization of identity and user document
 *
 * @example
 * ```tsx
 * useCrossTabSync({
 *   onIdentityChange: (identity) => {
 *     console.log('Identity changed in another tab', identity);
 *     // Return true to auto-reload, false to handle manually
 *     return true;
 *   },
 *   onUserDocChange: (docId) => {
 *     console.log('User doc changed in another tab', docId);
 *   },
 * });
 * ```
 */
export function useCrossTabSync(options: CrossTabSyncOptions = {}): void {
  const {
    onIdentityChange,
    onUserDocChange,
    autoReloadOnIdentityChange = true,
  } = options;

  const handleStorageChange = useCallback(
    (event: StorageEvent) => {
      // Identity changed in another tab
      if (event.key === SHARED_IDENTITY_KEY) {
        const oldIdentity = event.oldValue ? JSON.parse(event.oldValue) as StoredIdentity : null;
        const newIdentity = event.newValue ? JSON.parse(event.newValue) as StoredIdentity : null;

        // Check if DID actually changed (not just name/avatar)
        const didChanged = oldIdentity?.did !== newIdentity?.did;

        console.log('🔄 Identity changed in another tab', {
          oldDid: oldIdentity?.did?.substring(0, 30),
          newDid: newIdentity?.did?.substring(0, 30),
          didChanged,
          nameChanged: oldIdentity?.displayName !== newIdentity?.displayName,
        });

        if (onIdentityChange) {
          const shouldReload = onIdentityChange(newIdentity);
          if (shouldReload) {
            window.location.reload();
          }
        } else if (autoReloadOnIdentityChange && didChanged) {
          // Only reload if the DID actually changed (not just name/avatar)
          // Name/avatar updates come through Automerge sync via UserDocument
          console.log('🔄 DID changed, reloading page...');
          window.location.reload();
        }
      }

      // User document ID changed in another tab
      if (event.key === USER_DOC_KEY) {
        console.log('🔄 User document ID changed in another tab', {
          oldDocId: event.oldValue?.substring(0, 30),
          newDocId: event.newValue?.substring(0, 30),
        });

        if (onUserDocChange) {
          onUserDocChange(event.newValue);
        }
      }
    },
    [onIdentityChange, onUserDocChange, autoReloadOnIdentityChange]
  );

  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleStorageChange]);
}

/**
 * Utility to manually trigger a cross-tab sync notification
 * Useful when making changes that should be reflected in other tabs
 */
export function notifyCrossTabSync(key: 'identity' | 'userDoc'): void {
  const storageKey = key === 'identity' ? SHARED_IDENTITY_KEY : USER_DOC_KEY;
  const currentValue = localStorage.getItem(storageKey);

  // Trigger storage event by briefly changing and restoring the value
  // Note: This only works for OTHER tabs, not the current one
  // The current tab should update its state directly
  if (currentValue) {
    // Force a storage event by appending/removing a timestamp
    // This is a workaround since storage events don't fire in the same tab
    const tempKey = `${storageKey}_sync_trigger`;
    localStorage.setItem(tempKey, Date.now().toString());
    localStorage.removeItem(tempKey);
  }
}

/**
 * Get current cross-tab state
 */
export function getCrossTabState(): {
  identity: StoredIdentity | null;
  userDocId: string | null;
} {
  return {
    identity: loadSharedIdentity(),
    userDocId: loadUserDocId(),
  };
}
