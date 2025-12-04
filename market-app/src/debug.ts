/**
 * Debug utilities for inspecting Marktplatz data structure
 * Import this in your component during development to expose data to console
 */

import type { MarketAppDoc } from './schema';

/**
 * Helper to resolve DID to display name
 */
function resolveName(doc: MarketAppDoc, did: string): string {
  return doc.identities?.[did]?.displayName || did;
}

/**
 * Expose the document to the browser console for debugging
 * Call this from your component: exposeDocToConsole(doc)
 */
export function exposeDocToConsole(doc: MarketAppDoc | null) {
  if (typeof window !== 'undefined') {
    (window as any).__marketDoc = doc;
    console.log('🏪 Market document exposed as window.__marketDoc');
    console.log('Try: __marketDoc.data.listings');
    console.log('Try: __marketDoc.data.reactions');
    console.log('Try: __marketDoc.identities');
  }
}

/**
 * Pretty print document structure to console
 */
export function printDocStructure(doc: MarketAppDoc | null) {
  if (!doc) {
    console.log('❌ No document loaded');
    return;
  }

  console.group('🏪 Marktplatz Document Structure');

  console.group('👥 Identities');
  console.table(doc.identities);
  console.groupEnd();

  console.group('📦 Listings (' + Object.keys(doc.data.listings).length + ')');
  Object.values(doc.data.listings).forEach(listing => {
    const typeIcon = listing.type === 'offer' ? '🤲' : '🙋';
    console.log(`${typeIcon} "${listing.title}" by ${resolveName(doc, listing.createdBy)}`);
    console.log(`  Category: ${listing.categoryId}, Status: ${listing.status}`);
    console.log(`  Reactions: ${listing.reactionIds.length}`);
  });
  console.groupEnd();

  console.group('💬 Reactions (' + Object.keys(doc.data.reactions).length + ')');
  Object.values(doc.data.reactions).forEach(reaction => {
    const listing = doc.data.listings[reaction.listingId];
    console.log(`${resolveName(doc, reaction.reactorDid)} interested in "${listing?.title || 'unknown'}"`);
  });
  console.groupEnd();

  console.group('📊 Document Stats');
  console.log('Version:', doc.version);
  console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
  console.log('Total Listings:', Object.keys(doc.data.listings).length);
  console.log('Total Reactions:', Object.keys(doc.data.reactions).length);
  console.log('Total Users:', Object.keys(doc.identities).length);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
export function exportDocToJson(doc: MarketAppDoc | null) {
  if (!doc) {
    console.error('❌ No document to export');
    return;
  }

  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `market-doc-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Document exported to JSON file');
}

/**
 * List all listings by type
 */
export function listByType(doc: MarketAppDoc | null, type: 'offer' | 'need') {
  if (!doc) return [];

  return Object.values(doc.data.listings)
    .filter(l => l.type === type)
    .map(l => ({
      title: l.title,
      category: l.categoryId,
      status: l.status,
      creator: resolveName(doc, l.createdBy),
      reactions: l.reactionIds.length,
    }));
}

/**
 * List all listings by user
 */
export function listByUser(doc: MarketAppDoc | null, userDid: string) {
  if (!doc) return [];

  return Object.values(doc.data.listings)
    .filter(l => l.createdBy === userDid)
    .map(l => ({
      type: l.type,
      title: l.title,
      category: l.categoryId,
      status: l.status,
      reactions: l.reactionIds.length,
    }));
}

/**
 * Diagnose document structure issues
 */
export function diagnoseDoc(doc: MarketAppDoc | null) {
  console.group('🔍 Document Diagnosis');

  if (!doc) {
    console.error('❌ Document is null/undefined');
    console.groupEnd();
    return;
  }

  console.log('✅ Document exists');
  console.log('  version:', doc.version);
  console.log('  lastModified:', doc.lastModified);

  if (!doc.identities) {
    console.warn('⚠️  doc.identities is missing');
  } else {
    console.log('✅ doc.identities exists with', Object.keys(doc.identities).length, 'entries');
  }

  if (!doc.data) {
    console.error('❌ doc.data is missing - document has wrong structure!');
    console.log('  Full doc keys:', Object.keys(doc));
    console.groupEnd();
    return;
  }

  console.log('✅ doc.data exists');

  if (!doc.data.listings) {
    console.error('❌ doc.data.listings is missing');
  } else {
    console.log('✅ doc.data.listings exists with', Object.keys(doc.data.listings).length, 'entries');
  }

  if (!doc.data.reactions) {
    console.warn('⚠️  doc.data.reactions is missing');
  } else {
    console.log('✅ doc.data.reactions exists with', Object.keys(doc.data.reactions).length, 'entries');
  }

  console.log('📋 Full document structure:', JSON.stringify(doc, null, 2));
  console.groupEnd();
}

// Make debug functions available in console
if (typeof window !== 'undefined') {
  (window as any).__marketDebug = {
    print: printDocStructure,
    export: exportDocToJson,
    diagnose: diagnoseDoc,
    offers: (doc: MarketAppDoc | null) => listByType(doc, 'offer'),
    needs: (doc: MarketAppDoc | null) => listByType(doc, 'need'),
    byUser: listByUser,
  };

  console.log('🛠️  Market Debug Tools loaded!');
  console.log('Available commands:');
  console.log('  __marketDebug.diagnose(__marketDoc)      - Diagnose document issues');
  console.log('  __marketDebug.print(__marketDoc)         - Print document structure');
  console.log('  __marketDebug.export(__marketDoc)        - Export document to JSON');
  console.log('  __marketDebug.offers(__marketDoc)        - List all offers');
  console.log('  __marketDebug.needs(__marketDoc)         - List all needs');
  console.log('  __marketDebug.byUser(__marketDoc, did)   - List user\'s listings');
}
