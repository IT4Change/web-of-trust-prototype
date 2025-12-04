/**
 * MapModule - Reusable map module component
 *
 * This module wraps MapContent and can be used standalone or embedded in a unified app.
 * It receives callbacks for mutations rather than using hooks directly,
 * allowing the parent to control how data is persisted.
 */

import type { ModuleProps } from 'narrative-ui';
import type { MapData, UserLocation } from '../schema/map-data';
import { MapContent } from '../components/MapContent';

export interface MapModuleProps extends ModuleProps<MapData> {
  // Mutation callbacks
  onSetLocation: (lat: number, lng: number, label?: string) => void;
  onRemoveLocation: () => void;

  // Query helpers
  getMyLocation: () => UserLocation | null;
  locations: UserLocation[];

  // Hidden users for filtering
  hiddenUserDids?: Set<string>;

  // Document context for identities
  doc: {
    identities: Record<string, { displayName?: string; avatarUrl?: string }>;
    trustAttestations: Record<string, unknown>;
  };
}

export function MapModule({
  context,
  onSetLocation,
  onRemoveLocation,
  getMyLocation,
  locations,
  hiddenUserDids = new Set(),
  doc,
}: MapModuleProps) {
  return (
    <div className="w-full h-full">
      <MapContent
        currentUserDid={context.currentUserDid}
        locations={locations}
        identities={doc.identities}
        hiddenUserDids={hiddenUserDids}
        onSetLocation={onSetLocation}
        onRemoveLocation={onRemoveLocation}
        getMyLocation={getMyLocation}
      />
    </div>
  );
}
