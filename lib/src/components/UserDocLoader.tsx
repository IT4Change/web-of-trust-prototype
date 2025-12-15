/**
 * UserDocLoader - Invisible component that loads a UserDocument
 *
 * Uses useDocument for reactive updates and reports status via callbacks.
 * This component renders nothing (returns null) - it only manages document loading.
 */

import { useEffect, useRef } from 'react';
import { useDocument, useDocHandle } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { UserDocument } from '../schema/userDocument';
import type { UserDocLoaderProps } from '../providers/types';

// Debug logging helper
const DEBUG = true;
const log = (msg: string, ...args: unknown[]) => {
  if (DEBUG) console.log(`[UserDocLoader] ${msg}`, ...args);
};

/**
 * Invisible component that loads a UserDocument and reports its state.
 *
 * Uses useDocument for reactive updates - when the document changes,
 * the onLoaded callback is called with the updated profile data.
 */
export function UserDocLoader({
  url,
  expectedDid,
  source,
  onLoaded,
  onUnavailable,
}: UserDocLoaderProps) {
  // Track if we've already reported unavailable (to avoid duplicate calls)
  const reportedUnavailableRef = useRef(false);
  const lastReportedProfileRef = useRef<string | null>(null);
  const mountTimeRef = useRef(Date.now());

  // Use the standard hooks - useDocument returns [doc, changeDoc] or [undefined, noop]
  const [doc] = useDocument<UserDocument>(url as AutomergeUrl);
  const handle = useDocHandle<UserDocument>(url as AutomergeUrl);

  // Log on mount
  useEffect(() => {
    log(`MOUNT url=${url.substring(0, 40)}... expectedDid=${expectedDid?.substring(0, 20) || 'none'} source=${source}`);
    return () => {
      const duration = Date.now() - mountTimeRef.current;
      log(`UNMOUNT url=${url.substring(0, 40)}... after ${duration}ms`);
    };
  }, [url, expectedDid, source]);

  // Log handle and doc state changes
  useEffect(() => {
    const state = (handle as unknown as { state?: string })?.state || 'no-handle';
    const hasDoc = !!doc;
    const hasDid = !!doc?.did;
    const hasProfile = !!doc?.profile;
    log(`STATE url=${url.substring(0, 40)}... handleState=${state} hasDoc=${hasDoc} hasDid=${hasDid} hasProfile=${hasProfile}`);
  }, [url, handle, doc, doc?.did, doc?.profile]);

  // Effect to detect UNAVAILABLE state from handle
  useEffect(() => {
    if (!handle) {
      log(`NO HANDLE yet for ${url.substring(0, 40)}...`);
      return;
    }

    // Check for unavailable state by polling (events not reliably typed)
    const checkState = () => {
      // DocHandle state can be: 'idle' | 'loading' | 'requesting' | 'ready' | 'unavailable' | 'deleted'
      const state = (handle as unknown as { state?: string }).state;

      if (state === 'unavailable' && !reportedUnavailableRef.current) {
        log(`UNAVAILABLE detected for ${url.substring(0, 40)}...`);
        reportedUnavailableRef.current = true;
        onUnavailable(url);
      }
    };

    // Check immediately
    checkState();

    // Poll periodically for state changes (the 'unavailable' event isn't in typed API)
    const interval = setInterval(checkState, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [handle, url, onUnavailable]);

  // Effect to report loaded document and react to profile changes
  useEffect(() => {
    if (!doc) {
      log(`NO DOC yet for ${url.substring(0, 40)}...`);
      return;
    }

    const docDid = doc.did;

    // Wait for DID to be available (new docs may sync incrementally)
    if (!docDid) {
      log(`Doc loaded but no DID yet for ${url.substring(0, 40)}... - waiting for sync`);
      return;
    }

    // Validate expectedDid if provided
    if (expectedDid && docDid !== expectedDid) {
      log(`DID MISMATCH for ${url.substring(0, 40)}...: expected ${expectedDid.substring(0, 20)}, got ${docDid?.substring(0, 20)}`);
      // Still report it - the provider can decide what to do
    }

    // Create a stable key for change detection
    const profileKey = JSON.stringify({
      did: docDid,
      displayName: doc.profile?.displayName,
      avatarUrl: doc.profile?.avatarUrl,
      updatedAt: doc.profile?.updatedAt,
      signature: doc.profile?.signature,
    });

    // Only report if profile data has changed
    if (profileKey !== lastReportedProfileRef.current) {
      lastReportedProfileRef.current = profileKey;

      const elapsed = Date.now() - mountTimeRef.current;
      log(`LOADED url=${url.substring(0, 40)}... did=${docDid.substring(0, 20)}... name=${doc.profile?.displayName || 'none'} elapsed=${elapsed}ms`);

      onLoaded(url, docDid, {
        displayName: doc.profile?.displayName,
        avatarUrl: doc.profile?.avatarUrl,
        updatedAt: doc.profile?.updatedAt,
        signature: doc.profile?.signature,
      });
    }
  }, [doc, doc?.did, url, expectedDid, onLoaded, doc?.profile?.displayName, doc?.profile?.avatarUrl, doc?.profile?.updatedAt, doc?.profile?.signature]);

  // This component renders nothing - it's invisible
  return null;
}
