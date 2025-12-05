/**
 * Dank App - Debug Extensions
 *
 * This app uses the central __narrative debug tools from narrative-ui.
 * No app-specific extensions needed yet.
 *
 * Available commands (from lib):
 *   __narrative.help()       - Show all available commands
 *   __narrative.userDoc()    - Get user document
 *   __narrative.doc()        - Get workspace document
 *   __narrative.loadDoc(id)  - Load any document by ID
 */

import type { DankWalletDoc } from './schema';
import type { NarrativeDebug } from 'narrative-ui';

// Extend the global window type with app-specific document type
declare global {
  interface Window {
    __narrative: NarrativeDebug;
    __doc: DankWalletDoc | null;
  }
}

// No additional initialization needed - central debug tools handle everything
console.log('💰 Dank App: Using central __narrative debug tools. Type __narrative.help() for commands.');
