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

import { useEffect, useRef } from 'react';
import { useProfileUrl } from 'narrative-ui';
import type { UserLocation, MapDoc } from '../schema/map-data';
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
  /** The document (for profile lookup) */
  doc: MapDoc;
  /** Whether placing marker mode is active (controlled by parent) */
  isPlacingMarker: boolean;
  /** Callback to set placing marker mode */
  setIsPlacingMarker: (value: boolean) => void;
}

export function MapContent({
  currentUserDid,
  locations,
  identities,
  hiddenUserDids = new Set(),
  onSetLocation,
  getMyLocation,
  isPlacingMarker,
  setIsPlacingMarker,
}: MapContentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // URL-based profile support
  const { openProfile } = useProfileUrl();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([51.505, -0.09], 3);

    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoibmV4dHF1ZXN0IiwiYSI6ImNqM2x1dzNkbDAxajUyd3F0bmc3b3E0dHQifQ.V4hEw7CC3e_76sNhMxwE3Q',
      {
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 22,
        tileSize: 512,
        zoomOffset: -1,
      }
    ).addTo(map);

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

        // Click on marker opens profile via URL
        marker.on('click', () => {
          openProfile(location.userDid);
        });

        currentMarkers.set(location.id, marker);
      }
    });
  }, [locations, identities, hiddenUserDids, currentUserDid, openProfile]);

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
  }, [isPlacingMarker, onSetLocation, setIsPlacingMarker]);

  const myLocation = getMyLocation();

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
          <span>Tippe auf die Karte um deinen Standort zu setzen</span>
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
          title={myLocation ? 'Standort aktualisieren' : 'Standort hinzufügen'}
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
    </div>
  );
}
