import type { DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import { DocumentId } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument } from 'narrative-ui';
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

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

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
            />
          )}
        </div>
      )}
    </AppLayout>
  );
}
