/**
 * MapModuleWrapper - Connects MapModule to Automerge document
 *
 * This wrapper handles:
 * - Converting UnifiedDocument to MapModule props
 * - Providing mutation callbacks that update the Automerge doc
 * - Managing the module-specific data within the unified document
 */

import { useCallback, useMemo } from 'react';
import type { DocHandle } from '@automerge/automerge-repo';
import { MapModule } from 'map-app/modules';
import type { UserIdentity } from 'narrative-ui';
import { generateId } from 'narrative-ui';
import type { UnifiedDocument } from '../types';
import type { MapData, UserLocation } from 'map-app/schema';

interface MapModuleWrapperProps {
  doc: UnifiedDocument;
  docHandle: DocHandle<UnifiedDocument>;
  identity: UserIdentity;
  hiddenUserDids: Set<string>;
}

export function MapModuleWrapper({
  doc,
  docHandle,
  identity,
  hiddenUserDids,
}: MapModuleWrapperProps) {
  // Initialize map data if missing (for existing documents)
  if (!doc.data.map && docHandle) {
    docHandle.change((d) => {
      if (!d.data.map) {
        d.data.map = {
          locations: {},
        };
        d.lastModified = Date.now();
      }
    });
  }

  const mapData = doc.data.map;

  // Get all locations as array
  const locations = useMemo((): UserLocation[] => {
    if (!mapData) return [];
    return Object.values(mapData.locations) as UserLocation[];
  }, [mapData]);

  // Set or update current user's location
  const handleSetLocation = useCallback(
    (lat: number, lng: number, label?: string) => {
      if (!docHandle) return;

      docHandle.change((d) => {
        if (!d.data.map) return;
        const mData = d.data.map as MapData;

        const now = Date.now();

        // Find existing location for current user
        const existingLocationId = Object.keys(mData.locations).find((id) => {
          const loc = mData.locations[id];
          return loc && loc.userDid === identity.did;
        });

        if (existingLocationId) {
          // Update existing location
          const loc = mData.locations[existingLocationId];
          if (loc) {
            loc.lat = lat;
            loc.lng = lng;
            if (label !== undefined) {
              if (label === '') {
                delete loc.label;
              } else {
                loc.label = label;
              }
            }
            loc.updatedAt = now;
          }
        } else {
          // Create new location
          const locationId = generateId();
          const newLocation: UserLocation = {
            id: locationId,
            userDid: identity.did,
            lat,
            lng,
            createdAt: now,
            updatedAt: now,
          };

          if (label) {
            newLocation.label = label;
          }

          mData.locations[locationId] = newLocation;
        }

        d.lastModified = now;
      });
    },
    [docHandle, identity.did]
  );

  // Remove current user's location
  const handleRemoveLocation = useCallback(() => {
    if (!docHandle) return;

    docHandle.change((d) => {
      if (!d.data.map) return;
      const mData = d.data.map as MapData;

      const locationId = Object.keys(mData.locations).find((id) => {
        const loc = mData.locations[id];
        return loc && loc.userDid === identity.did;
      });

      if (locationId) {
        delete mData.locations[locationId];
        d.lastModified = Date.now();
      }
    });
  }, [docHandle, identity.did]);

  // Get current user's location
  const getMyLocation = useCallback((): UserLocation | null => {
    if (!mapData) return null;
    return (
      (Object.values(mapData.locations) as UserLocation[]).find(
        (loc) => loc && loc.userDid === identity.did
      ) || null
    );
  }, [mapData, identity.did]);

  if (!mapData) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title">Map Module</h2>
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MapModule
        data={mapData}
        onChange={() => {}} // Reserved for future direct data mutations
        context={{
          currentUserDid: identity.did,
          identities: doc.identities,
          trustAttestations: doc.trustAttestations,
        }}
        onSetLocation={handleSetLocation}
        onRemoveLocation={handleRemoveLocation}
        getMyLocation={getMyLocation}
        locations={locations}
        hiddenUserDids={hiddenUserDids}
        doc={{
          identities: doc.identities,
          trustAttestations: doc.trustAttestations,
        }}
      />
    </div>
  );
}
