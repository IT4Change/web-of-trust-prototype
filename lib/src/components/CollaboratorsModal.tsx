/**
 * CollaboratorsModal - Shows all users with trust relationships
 *
 * Displays users from:
 * - trustGiven (people you trust)
 * - trustReceived (people who trust you)
 *
 * Clicking on a user opens their profile modal.
 * Includes a visual Trust Graph for network visualization.
 */

import { useState, useEffect } from 'react';
import { UserListItem } from './UserListItem';
import { QRScannerModal } from './QRScannerModal';
import { TrustGraph } from './TrustGraph';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile, KnownProfile } from '../hooks/useAppContext';
import { verifyEntitySignature } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode, getDefaultDisplayName } from '../utils/did';

type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/**
 * Verify an attestation's signature
 */
async function verifyAttestationSignature(attestation: TrustAttestation): Promise<SignatureStatus> {
  if (!attestation.signature) {
    return 'missing';
  }

  try {
    const publicKeyBytes = extractPublicKeyFromDid(attestation.trusterDid);
    if (!publicKeyBytes) {
      return 'invalid';
    }

    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const result = await verifyEntitySignature(
      attestation as unknown as Record<string, unknown>,
      publicKeyBase64
    );

    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

interface CollaboratorsModalProps<TData = unknown> {
  isOpen: boolean;
  onClose: () => void;
  /** Workspace document (optional - can work without it using only userDoc) */
  doc?: BaseDocument<TData> | null;
  currentUserDid: string;
  hiddenUserDids: Set<string>;
  onToggleUserVisibility: (did: string) => void;
  onTrustUser: (did: string, userDocUrl?: string) => void;
  onUserClick: (did: string) => void;
  /** User document for trust information */
  userDoc?: UserDocument | null;
  /**
   * @deprecated Use knownProfiles instead
   * Profiles loaded from trusted users' UserDocuments (optional)
   */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
  /**
   * All known profiles from useAppContext
   * Recommended - provides profiles from trust network, workspace, and external sources
   */
  knownProfiles?: Map<string, KnownProfile>;
  /** Get profile from central known profiles */
  getProfile?: (did: string) => KnownProfile | undefined;
  /** User document URL for QR code generation */
  userDocUrl?: string;
  /** Register external doc for reactive profile loading */
  registerExternalDoc?: (userDocUrl: string) => void;
}

type ViewTab = 'list' | 'graph';

export function CollaboratorsModal<TData = unknown>({
  isOpen,
  onClose,
  doc,
  currentUserDid,
  hiddenUserDids,
  onToggleUserVisibility,
  onTrustUser,
  onUserClick,
  userDoc,
  trustedUserProfiles = {},
  knownProfiles = new Map(),
  getProfile,
  userDocUrl,
  registerExternalDoc,
}: CollaboratorsModalProps<TData>) {
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');

  // Track signature verification status for each DID
  const [signatureStatuses, setSignatureStatuses] = useState<
    Record<string, { outgoing?: SignatureStatus; incoming?: SignatureStatus }>
  >({});

  // Verify signatures when userDoc changes
  useEffect(() => {
    if (!userDoc || !isOpen) return;

    const verifyAll = async () => {
      const newStatuses: Record<string, { outgoing?: SignatureStatus; incoming?: SignatureStatus }> = {};

      // Verify outgoing trust attestations (trustGiven)
      for (const [trusteeDid, attestation] of Object.entries(userDoc.trustGiven || {})) {
        if (!newStatuses[trusteeDid]) newStatuses[trusteeDid] = {};
        newStatuses[trusteeDid].outgoing = await verifyAttestationSignature(attestation);
      }

      // Verify incoming trust attestations (trustReceived)
      for (const [trusterDid, attestation] of Object.entries(userDoc.trustReceived || {})) {
        if (!newStatuses[trusterDid]) newStatuses[trusterDid] = {};
        newStatuses[trusterDid].incoming = await verifyAttestationSignature(attestation);
      }

      setSignatureStatuses(newStatuses);
    };

    verifyAll();
  }, [userDoc, isOpen]);

  if (!isOpen) return null;

  // Collect all unique DIDs from trust relationships
  const allDids = new Set<string>();

  if (userDoc) {
    // Add people you trust
    Object.values(userDoc.trustGiven || {}).forEach(attestation => {
      allDids.add(attestation.trusteeDid);
    });
    // Add people who trust you
    Object.values(userDoc.trustReceived || {}).forEach(attestation => {
      allDids.add(attestation.trusterDid);
    });
  }

  // Convert to array and build user data
  // Priority: knownProfiles > trustedUserProfiles > doc.identities > doc.identityLookup > default name
  const collaborators = Array.from(allDids)
    .filter(did => did !== currentUserDid) // Exclude self
    .map(did => {
      const knownProfile = getProfile?.(did) || knownProfiles.get(did);
      const trustedProfile = trustedUserProfiles[did];
      const workspaceProfile = doc?.identities?.[did];
      const lookupProfile = doc?.identityLookup?.[did];
      return {
        did,
        displayName: knownProfile?.displayName || trustedProfile?.displayName || workspaceProfile?.displayName || lookupProfile?.displayName || getDefaultDisplayName(did),
        avatarUrl: knownProfile?.avatarUrl || trustedProfile?.avatarUrl || workspaceProfile?.avatarUrl || lookupProfile?.avatarUrl,
        outgoingTrust: userDoc?.trustGiven?.[did],
        incomingTrust: userDoc?.trustReceived?.[did],
        profileSignatureStatus: knownProfile?.signatureStatus || trustedProfile?.profileSignatureStatus,
      };
    });

  // Sort: bidirectional first, then outgoing, then incoming
  collaborators.sort((a, b) => {
    const aBidirectional = a.outgoingTrust && a.incomingTrust;
    const bBidirectional = b.outgoingTrust && b.incomingTrust;
    if (aBidirectional && !bBidirectional) return -1;
    if (!aBidirectional && bBidirectional) return 1;
    if (a.outgoingTrust && !b.outgoingTrust) return -1;
    if (!a.outgoingTrust && b.outgoingTrust) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  // Count statistics
  const bidirectionalCount = collaborators.filter(c => c.outgoingTrust && c.incomingTrust).length;
  const outgoingOnlyCount = collaborators.filter(c => c.outgoingTrust && !c.incomingTrust).length;
  const incomingOnlyCount = collaborators.filter(c => !c.outgoingTrust && c.incomingTrust).length;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-lg">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
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
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Vertrauensnetzwerk
        </h3>

        {/* Statistics */}
        <div className="flex gap-4 text-sm text-base-content/60 mb-4">
          {bidirectionalCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="badge badge-success badge-xs"></span>
              {bidirectionalCount} gegenseitig
            </span>
          )}
          {outgoingOnlyCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="badge badge-info badge-xs"></span>
              {outgoingOnlyCount} ausgehend
            </span>
          )}
          {incomingOnlyCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="badge badge-warning badge-xs"></span>
              {incomingOnlyCount} eingehend
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-base-200 rounded-lg p-1 mb-4">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors cursor-pointer ${activeTab === 'list' ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}
            onClick={() => setActiveTab('list')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Liste
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors cursor-pointer ${activeTab === 'graph' ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}
            onClick={() => setActiveTab('graph')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Netzwerk
          </button>
        </div>

        {/* List View */}
        {activeTab === 'list' && (
          <>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {collaborators.map(({ did, displayName, avatarUrl, outgoingTrust, incomingTrust, profileSignatureStatus }) => (
                <UserListItem
                  key={did}
                  did={did}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  currentUserDid={currentUserDid}
                  isHidden={hiddenUserDids.has(did)}
                  outgoingTrust={outgoingTrust}
                  incomingTrust={incomingTrust}
                  outgoingSignatureStatus={signatureStatuses[did]?.outgoing}
                  incomingSignatureStatus={signatureStatuses[did]?.incoming}
                  profileSignatureStatus={profileSignatureStatus}
                  onUserClick={onUserClick}
                  onToggleVisibility={onToggleUserVisibility}
                  showVisibilityToggle={true}
                  showTrustBadges={true}
                />
              ))}
            </div>

            {collaborators.length === 0 && (
              <div className="text-center py-8 text-base-content/60">
                <p className="mb-2">Noch keine Vertrauensbeziehungen</p>
                <p className="text-xs">Scanne den QR-Code eines anderen Benutzers um zu verifizieren</p>
              </div>
            )}
          </>
        )}

        {/* Graph View */}
        {activeTab === 'graph' && (
          <div className="max-h-[50vh] overflow-hidden">
            <TrustGraph
              userDoc={userDoc ?? undefined}
              knownProfiles={knownProfiles}
              trustedUserProfiles={trustedUserProfiles}
              height={350}
              onNodeClick={onUserClick}
              showStats={false}
              loadSecondDegree={true}
            />
            <p className="text-xs text-base-content/50 text-center mt-2">
              Klicke auf einen Knoten um das Profil zu öffnen
            </p>
          </div>
        )}

        <div className="modal-action">
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowScanner(true)}
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
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            QR-Code scannen
          </button>
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        currentUserDid={currentUserDid}
        doc={doc}
        onTrustUser={onTrustUser}
        userDocUrl={userDocUrl}
        knownProfiles={knownProfiles}
        getProfile={getProfile}
        registerExternalDoc={registerExternalDoc}
      />
    </div>
  );
}
