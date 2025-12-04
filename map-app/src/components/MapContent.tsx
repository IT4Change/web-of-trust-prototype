/**
 * MapContent - Core map rendering component
 *
 * This component handles:
 * - Leaflet map initialization
 * - Marker management with click-to-open profile
 * - FAB to place own profile on map
 *
 * It's designed to be embedded in both standalone MapView and unified-app MapModule.
 */

import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from 'narrative-ui';
import type { UserLocation } from '../schema/map-data';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapContentProps {
  /** Current user's DID */
  currentUserDid: string;
  /** All locations to display */
  locations: UserLocation[];
  /** Identity lookup for display names */
  identities: Record<string, { displayName?: string; avatarUrl?: string }>;
  /** Hidden user DIDs (filtered out) */
  hiddenUserDids?: Set<string>;
  /** Callback to set/update location */
  onSetLocation: (lat: number, lng: number, label?: string) => void;
  /** Callback to remove location */
  onRemoveLocation: () => void;
  /** Get current user's location */
  getMyLocation: () => UserLocation | null;
}

export function MapContent({
  currentUserDid,
  locations,
  identities,
  hiddenUserDids = new Set(),
  onSetLocation,
  onRemoveLocation,
  getMyLocation,
}: MapContentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [isPlacingMarker, setIsPlacingMarker] = useState(false);
  const [selectedUserDid, setSelectedUserDid] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([51.505, -0.09], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Force Leaflet to recalculate map size
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentMarkers = markersRef.current;

    // Remove markers for hidden users or deleted locations
    currentMarkers.forEach((marker, locationId) => {
      const location = locations.find((loc) => loc.id === locationId);
      if (!location || hiddenUserDids.has(location.userDid)) {
        marker.remove();
        currentMarkers.delete(locationId);
      }
    });

    // Add or update markers
    locations.forEach((location) => {
      if (!location || hiddenUserDids.has(location.userDid)) return;

      const existingMarker = currentMarkers.get(location.id);
      const isCurrentUser = location.userDid === currentUserDid;

      if (existingMarker) {
        // Update existing marker position
        existingMarker.setLatLng([location.lat, location.lng]);
      } else {
        // Create new marker
        const marker = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${isCurrentUser ? '#3b82f6' : '#ef4444'}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(map);

        // Click on marker opens profile modal
        marker.on('click', () => {
          setSelectedUserDid(location.userDid);
        });

        currentMarkers.set(location.id, marker);
      }
    });
  }, [locations, identities, hiddenUserDids, currentUserDid]);

  // Handle placing marker mode
  useEffect(() => {
    if (!mapRef.current || !isPlacingMarker) return;

    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onSetLocation(lat, lng);
      setIsPlacingMarker(false);
    };

    map.on('click', handleMapClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      map.off('click', handleMapClick);
      map.getContainer().style.cursor = '';
    };
  }, [isPlacingMarker, onSetLocation]);

  const myLocation = getMyLocation();
  const selectedProfile = selectedUserDid ? identities[selectedUserDid] : null;
  const selectedDisplayName = selectedProfile?.displayName || 'Anonymous';
  const isSelectedCurrentUser = selectedUserDid === currentUserDid;

  return (
    <div className="w-full h-full relative">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Placing marker hint */}
      {isPlacingMarker && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[550] bg-primary text-primary-content px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>Tap on the map to set your location</span>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => setIsPlacingMarker(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Single FAB - Bottom Right */}
      <div className="absolute bottom-8 right-6 z-[550]">
        <button
          className={`btn btn-circle btn-lg shadow-lg shadow-black/30 ${isPlacingMarker ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setIsPlacingMarker(!isPlacingMarker)}
          title={myLocation ? 'Update your location' : 'Add your location'}
        >
          {isPlacingMarker ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Profile Modal - Opens when clicking on a marker */}
      {selectedUserDid && (
        <div className="modal modal-open z-[9999]">
          <div className="modal-box max-w-md">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setSelectedUserDid(null)}
            >
              ✕
            </button>

            <h3 className="font-bold text-lg mb-4">
              {isSelectedCurrentUser ? 'Your Profile' : 'User Profile'}
            </h3>

            <div className="flex flex-col items-center gap-4 p-4 bg-base-200 rounded-lg">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
                <UserAvatar
                  did={selectedUserDid}
                  avatarUrl={selectedProfile?.avatarUrl}
                  size={80}
                />
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{selectedDisplayName}</div>
                {isSelectedCurrentUser && (
                  <div className="badge badge-primary mt-1">You</div>
                )}
                <div className="text-xs text-base-content/50 break-all mt-2">
                  {selectedUserDid}
                </div>
              </div>
            </div>

            {isSelectedCurrentUser && (
              <div className="modal-action flex-col gap-2">
                <button
                  className="btn btn-primary w-full"
                  onClick={() => {
                    setSelectedUserDid(null);
                    setIsPlacingMarker(true);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Update Location
                </button>

                <button
                  className="btn btn-error btn-outline w-full"
                  onClick={() => {
                    onRemoveLocation();
                    setSelectedUserDid(null);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Remove from Map
                </button>
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedUserDid(null)}></div>
        </div>
      )}
    </div>
  );
}
