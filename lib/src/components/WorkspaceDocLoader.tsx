/**
 * WorkspaceDocLoader - Invisible component that loads a workspace document
 *
 * Uses useDocument for reactive updates and reports status via callbacks.
 * This component renders nothing (returns null) - it only manages document loading.
 */

import { useEffect, useRef } from 'react';
import { useDocument, useDocHandle } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import type { BaseDocument } from '../schema';

export interface WorkspaceDocLoaderProps<TDoc extends BaseDocument> {
  /** The AutomergeUrl of the workspace document to load */
  url: string;
  /** Called when document is successfully loaded */
  onLoaded: (documentId: DocumentId) => void;
  /** Called when document is unavailable (not found in network) */
  onUnavailable: () => void;
}

/**
 * Invisible component that loads a workspace document.
 *
 * Reports loading state via callbacks - the parent component
 * handles UI feedback (loading animation, seconds counter, etc.)
 */
export function WorkspaceDocLoader<TDoc extends BaseDocument>({
  url,
  onLoaded,
  onUnavailable,
}: WorkspaceDocLoaderProps<TDoc>) {
  // Track if we've already reported a state (to avoid duplicate calls)
  const reportedStateRef = useRef<'loaded' | 'unavailable' | null>(null);

  // Use the standard hooks
  const [doc] = useDocument<TDoc>(url as AutomergeUrl);
  const handle = useDocHandle<TDoc>(url as AutomergeUrl);

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
        console.log(`[WorkspaceDocLoader] Document unavailable: ${url.substring(0, 30)}`);
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

  // Effect to report loaded document
  useEffect(() => {
    if (!doc || !handle) return;
    if (reportedStateRef.current) return; // Already reported

    // Check that document has actual content (not empty)
    // BaseDocument should have at least version and lastModified
    if (!doc.version) {
      console.log(`[WorkspaceDocLoader] Doc loaded but no version yet for ${url.substring(0, 30)} - waiting for sync`);
      return;
    }

    // Success - document loaded
    console.log(`[WorkspaceDocLoader] Workspace document loaded successfully: ${url.substring(0, 30)}`);
    reportedStateRef.current = 'loaded';
    onLoaded(handle.documentId);
  }, [doc, handle, url, onLoaded]);

  // This component renders nothing - it's invisible
  return null;
}
