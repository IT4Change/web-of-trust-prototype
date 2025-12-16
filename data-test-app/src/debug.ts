/**
 * Debug utilities for inspecting Data Layer Test data structure
 * Import this in main.tsx to expose data to browser console
 */

import type { DataTestAppDoc } from './schema';

/**
 * Expose the document to the browser console for debugging
 */
export function exposeDocToConsole(doc: DataTestAppDoc | null) {
  if (typeof window !== 'undefined') {
    (window as any).__dataTestAppDoc = doc;
    console.log('📊 Document exposed as window.__dataTestAppDoc');
  }
}

/**
 * Pretty print document structure to console
 */
export function printDocStructure(doc: DataTestAppDoc | null) {
  if (!doc) {
    console.log('❌ No document loaded');
    return;
  }

  console.group('📊 Data Layer Test Document Structure');

  console.group('👥 Identities');
  console.table(doc.identities);
  console.groupEnd();

  console.group('📦 Data');
  console.log(doc.data);
  console.groupEnd();

  console.group('📊 Document Stats');
  console.log('Version:', doc.version);
  console.log('Last Modified:', new Date(doc.lastModified).toLocaleString());
  console.log('Total Users:', Object.keys(doc.identities).length);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Export document to JSON file
 */
export function exportDocToJson(doc: DataTestAppDoc | null) {
  if (!doc) {
    console.error('❌ No document to export');
    return;
  }

  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dataTestApp-doc-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Document exported to JSON file');
}

// Make debug functions available in console
if (typeof window !== 'undefined') {
  (window as any).__dataTestAppDebug = {
    print: printDocStructure,
    export: exportDocToJson,
  };

  console.log('🛠️  Data Layer Test Debug Tools loaded!');
  console.log('Available commands:');
  console.log('  __dataTestAppDebug.print(__dataTestAppDoc)   - Print document structure');
  console.log('  __dataTestAppDebug.export(__dataTestAppDoc)  - Export document to JSON');
}
