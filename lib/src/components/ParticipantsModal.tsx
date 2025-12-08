/**
 * ParticipantsModal - Shows all participants in the current workspace
 *
 * Displays users who have contributed to the current document/workspace.
 * Clicking on a user opens their profile modal.
 */

import { useState, useEffect } from 'react';
import { UserListItem } from './UserListItem';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile, KnownProfile } from '../hooks/useAppContext';
import { verifyEntitySignature } from '../utils/signature';
import { extractPublicKeyFromDid, base64Encode } from '../utils/did';

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

interface ParticipantsModalProps<TData = unknown> {
  isOpen: boolean;
  onClose: () => void;
  doc: BaseDocument<TData>;
  currentUserDid: string;
  hiddenUserDids: Set<string>;
  onToggleUserVisibility: (did: string) => void;
  onUserClick: (did: string) => void;
  /** User document for trust information (optional) */
  userDoc?: UserDocument | null;
  /**
   * @deprecated Use knownProfiles/getProfile instead
   * Profiles loaded from trusted users' UserDocuments (optional)
   */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
  /**
   * All known profiles from useAppContext
   */
  knownProfiles?: Map<string, KnownProfile>;
  /** Get profile from central known profiles */
  getProfile?: (did: string) => KnownProfile | undefined;
}

export function ParticipantsModal<TData = unknown>({
  isOpen,
  onClose,
  doc,
  currentUserDid,
  hiddenUserDids,
  onToggleUserVisibility,
  onUserClick,
  userDoc,
  trustedUserProfiles = {},
  knownProfiles = new Map(),
  getProfile,
}: ParticipantsModalProps<TData>) {
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

  // Get all workspace participants from doc.identities
  // Priority: knownProfiles > trustedUserProfiles > doc.identities
  const participants = Object.entries(doc.identities).map(([did, profile]) => {
    const knownProfile = getProfile?.(did) || knownProfiles.get(did);
    const trustedProfile = trustedUserProfiles[did];
    return {
      did,
      displayName: knownProfile?.displayName || trustedProfile?.displayName || profile?.displayName,
      avatarUrl: knownProfile?.avatarUrl || trustedProfile?.avatarUrl || profile?.avatarUrl,
      profileSignatureStatus: knownProfile?.signatureStatus || trustedProfile?.profileSignatureStatus,
    };
  });

  // Sort: current user first, then by name
  participants.sort((a, b) => {
    if (a.did === currentUserDid) return -1;
    if (b.did === currentUserDid) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Teilnehmer
        </h3>
        <p className="text-sm text-base-content/60 mb-4">
          {participants.length} {participants.length === 1 ? 'Person' : 'Personen'} in diesem Workspace
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {participants.map(({ did, displayName, avatarUrl, profileSignatureStatus }) => (
            <UserListItem
              key={did}
              did={did}
              displayName={displayName}
              avatarUrl={avatarUrl}
              currentUserDid={currentUserDid}
              isHidden={hiddenUserDids.has(did)}
              outgoingTrust={userDoc?.trustGiven?.[did]}
              incomingTrust={userDoc?.trustReceived?.[did]}
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

        {participants.length === 0 && (
          <div className="text-center py-8 text-base-content/60">
            Noch keine Teilnehmer
          </div>
        )}

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
