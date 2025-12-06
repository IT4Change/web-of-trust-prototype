/**
 * MapModule - Reusable map module component
 *
 * This module wraps MapContent and can be used standalone or embedded in a unified app.
 * It receives callbacks for mutations rather than using hooks directly,
 * allowing the parent to control how data is persisted.
 */

import type { ModuleProps } from 'narrative-ui';
import type { MapData, UserLocation, MapDoc } from '../schema/map-data';
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

  // Full document for profile modal
  doc: MapDoc;

  // Placing marker mode (controlled by parent for profile actions)
  isPlacingMarker: boolean;
  setIsPlacingMarker: (value: boolean) => void;
}

export function MapModule({
  context,
  onSetLocation,
  onRemoveLocation,
  getMyLocation,
  locations,
  hiddenUserDids = new Set(),
  doc,
  isPlacingMarker,
  setIsPlacingMarker,
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
        doc={doc}
        isPlacingMarker={isPlacingMarker}
        setIsPlacingMarker={setIsPlacingMarker}
      />
    </div>
  );
}
