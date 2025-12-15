/**
 * OwnUserDocLoader - Invisible component that loads the user's own UserDocument
 *
 * Similar to UserDocLoader but specifically for loading the current user's
 * personal document with DID validation and handle access.
 *
 * Uses useDocument for reactive updates and reports status via callbacks.
 * This component renders nothing (returns null) - it only manages document loading.
 */

import { useEffect, useRef } from 'react';
import { useDocument, useDocHandle } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl, DocHandle } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';

export interface OwnUserDocLoaderProps {
  /** The AutomergeUrl of the UserDocument to load */
  url: string;
  /** The expected DID - used to validate document ownership */
  expectedDid: string;
  /** Called when document is successfully loaded with matching DID */
  onLoaded: (handle: DocHandle<UserDocument>, doc: UserDocument) => void;
  /** Called when document is unavailable (not found in network) */
  onUnavailable: () => void;
  /** Called when document DID doesn't match expected DID */
  onDidMismatch: (actualDid: string) => void;
}

/**
 * Invisible component that loads the current user's UserDocument.
 *
 * Validates that the document belongs to the expected user (DID check)
 * and provides the DocHandle for mutations.
 */
export function OwnUserDocLoader({
  url,
  expectedDid,
  onLoaded,
  onUnavailable,
  onDidMismatch,
}: OwnUserDocLoaderProps) {
  // Track if we've already reported a state (to avoid duplicate calls)
  const reportedStateRef = useRef<'loaded' | 'unavailable' | 'mismatch' | null>(null);

  // Use the standard hooks
  const [doc] = useDocument<UserDocument>(url as AutomergeUrl);
  const handle = useDocHandle<UserDocument>(url as AutomergeUrl);

  // Effect to detect UNAVAILABLE state from handle
  useEffect(() => {
    if (!handle) return;
    if (reportedStateRef.current) return; // Already reported something

    // Check for unavailable state by polling
    const checkState = () => {
      if (reportedStateRef.current) return; // Already reported

      // DocHandle state can be: 'idle' | 'loading' | 'requesting' | 'ready' | 'unavailable' | 'deleted'
      const state = (handle as unknown as { state?: string }).state;
      if (state === 'unavailable') {
        console.log(`[OwnUserDocLoader] Document unavailable: ${url.substring(0, 30)}`);
        reportedStateRef.current = 'unavailable';
        onUnavailable();
      }
    };

    // Check immediately
    checkState();

    // Poll periodically for state changes
    const interval = setInterval(checkState, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [handle, url, onUnavailable]);

  // Effect to validate and report loaded document
  useEffect(() => {
    if (!doc || !handle) return;
    if (reportedStateRef.current) return; // Already reported

    const docDid = doc.did;

    // Wait for DID to be available (new docs may sync incrementally)
    if (!docDid) {
      console.log(`[OwnUserDocLoader] Doc loaded but no DID yet for ${url.substring(0, 30)} - waiting for sync`);
      return;
    }

    // Validate DID matches expected
    if (docDid !== expectedDid) {
      console.warn(
        `[OwnUserDocLoader] DID mismatch for ${url.substring(0, 30)}: expected ${expectedDid.substring(0, 20)}, got ${docDid.substring(0, 20)}`
      );
      reportedStateRef.current = 'mismatch';
      onDidMismatch(docDid);
      return;
    }

    // Success - document loaded and DID matches
    console.log(`[OwnUserDocLoader] UserDocument loaded successfully: ${url.substring(0, 30)}`);
    reportedStateRef.current = 'loaded';
    onLoaded(handle, doc);
  }, [doc, handle, url, expectedDid, onLoaded, onDidMismatch]);

  // This component renders nothing - it's invisible
  return null;
}
