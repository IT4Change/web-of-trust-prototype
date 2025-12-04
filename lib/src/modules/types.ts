/**
 * Module system types for unified multi-module documents
 *
 * This provides a standardized interface for creating modules that can be
 * integrated into the unified workspace system.
 */

import type { ComponentType } from 'react';
import type { IdentityProfile, TrustAttestation } from '../schema/identity';

/**
 * Shared context provided to all modules
 * Contains access to identity and trust system
 */
export interface ModuleContext {
  /** Current user's DID */
  currentUserDid: string;
  /** All identities in this workspace */
  identities: Record<string, IdentityProfile>;
  /** All trust attestations in this workspace */
  trustAttestations: Record<string, TrustAttestation>;
}

/**
 * Standard props interface for all module components
 *
 * @template TData - Module-specific data type
 */
export interface ModuleProps<TData = unknown> {
  /** Module's data slice from the document */
  data: TData;
  /** Callback to update module data */
  onChange: (data: TData) => void;
  /** Shared workspace context */
  context: ModuleContext;
}

/**
 * Module definition for registration in the module system
 *
 * @template TData - Module-specific data type
 */
export interface ModuleDefinition<TData = unknown> {
  /** Unique module identifier (e.g., 'narrative', 'map', 'market') */
  id: string;
  /** Human-readable module name */
  name: string;
  /** Icon/emoji for UI display */
  icon: string;
  /** Optional description */
  description?: string;
  /** Semantic version */
  version: string;
  /** Factory function to create empty initial data */
  createEmptyData: () => TData;
  /** Main React component for this module */
  component: ComponentType<ModuleProps<TData>>;
  /** Optional settings/config component */
  settingsComponent?: ComponentType<ModuleProps<TData>>;
}
