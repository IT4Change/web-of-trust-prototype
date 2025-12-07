import { useState } from 'react';
import type { DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import { DocumentId } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument, type ProfileAction } from 'narrative-ui';
import { useMapDocument } from '../hooks/useMapDocument';
import { MapContent } from './MapContent';

interface MapViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
  // Debug Dashboard toggle (from AppShell)
  onToggleDebugDashboard: () => void;
}

/**
 * Main map view component (standalone app shell)
 * Uses MapContent for the actual map rendering
 */
export function MapView({
  documentId,
  currentUserDid,
  privateKey,
  publicKey,
  displayName,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
  onToggleDebugDashboard,
}: MapViewProps) {
  // Hook now handles docHandle internally using useDocHandle
  const mapData = useMapDocument(
    documentId,
    currentUserDid,
    privateKey,
    publicKey,
    displayName
  );

  // Load UserDocument for trust/verification features
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // State for placing marker mode (lifted from MapContent for profile actions)
  const [isPlacingMarker, setIsPlacingMarker] = useState(false);

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Map-specific profile actions
  const getProfileActions = (profileDid: string, closeProfile: () => void): ProfileAction[] => {
    if (profileDid !== currentUserDid || !mapData) return [];

    const myLocation = mapData.getMyLocation();
    return [
      {
        label: myLocation ? 'Standort aktualisieren' : 'Standort setzen',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        onClick: () => {
          closeProfile();
          setIsPlacingMarker(true);
        },
        variant: 'primary',
        ownProfileOnly: true,
      },
      ...(myLocation ? [{
        label: 'Von Karte entfernen',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        onClick: () => {
          mapData.removeMyLocation();
          closeProfile();
        },
        variant: 'error' as const,
        ownProfileOnly: true,
      }] : []),
    ];
  };

  return (
    <AppLayout
      doc={mapData?.doc}
      docHandle={mapData?.docHandle}
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Narrative Map"
      workspaceName="Map"
      hideWorkspaceSwitcher={false}
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={mapData?.updateIdentity}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
      profileActions={getProfileActions}
      onToggleDebugDashboard={onToggleDebugDashboard}
    >
      {(ctx: AppContextValue) => (
        <div className="flex-1 relative overflow-hidden">
          {mapData && (
            <MapContent
              currentUserDid={currentUserDid}
              locations={mapData.locations}
              identities={mapData.doc.identities}
              hiddenUserDids={ctx.hiddenUserDids}
              onSetLocation={mapData.setMyLocation}
              onRemoveLocation={mapData.removeMyLocation}
              getMyLocation={mapData.getMyLocation}
              doc={mapData.doc}
              isPlacingMarker={isPlacingMarker}
              setIsPlacingMarker={setIsPlacingMarker}
            />
          )}
        </div>
      )}
    </AppLayout>
  );
}
