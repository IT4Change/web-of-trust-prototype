import { useState, useEffect } from 'react';
import type { BaseDocument } from '../schema/document';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile, KnownProfile } from '../hooks/useAppContext';
import type { UserDocument } from '../schema/userDocument';
import { UserAvatar } from './UserAvatar';
import { QRScannerModal } from './QRScannerModal';
import { getDefaultDisplayName, extractPublicKeyFromDid, base64Encode } from '../utils/did';
import { verifyEntitySignature } from '../utils/signature';

type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/**
 * Verify an attestation's signature
 */
async function verifyAttestationSignature(attestation: TrustAttestation): Promise<SignatureStatus> {
  if (!attestation.signature) return 'missing';

  try {
    const publicKeyBytes = extractPublicKeyFromDid(attestation.trusterDid);
    const publicKeyBase64 = base64Encode(publicKeyBytes);
    const result = await verifyEntitySignature(attestation as unknown as Record<string, unknown>, publicKeyBase64);
    return result.valid ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

interface TrustReciprocityModalProps<TData = unknown> {
  pendingAttestations: TrustAttestation[];
  /** Workspace document (optional - used for workspace identity fallback) */
  doc?: BaseDocument<TData> | null;
  currentUserDid: string;
  /** Called when user successfully scans and trusts back via QR */
  onTrustUser: (trusteeDid: string, trusteeUserDocUrl?: string) => void;
  onDecline: (attestationId: string) => void;
  onShowToast?: (message: string) => void;
  /** @deprecated Use getProfile instead */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
  /** Get profile from central known profiles */
  getProfile?: (did: string) => KnownProfile | undefined;
  /** All known profiles for reactive UI updates */
  knownProfiles?: Map<string, KnownProfile>;
  /** Register an external UserDoc URL for reactive updates (e.g., from QR scanner) */
  registerExternalDoc?: (userDocUrl: string) => void;
  /** User document URL for QR code generation */
  userDocUrl?: string;
  /** Current user's UserDocument (reactive, for passing to QRScannerModal) */
  userDoc?: UserDocument | null;
  /** Callback to open a user's profile */
  onOpenProfile?: (did: string) => void;
  /** Callback when mutual trust is established */
  onMutualTrustEstablished?: (friendDid: string, friendName: string) => void;
}

export function TrustReciprocityModal<TData = unknown>({
  pendingAttestations,
  doc,
  currentUserDid,
  onTrustUser,
  onDecline,
  onShowToast,
  trustedUserProfiles = {},
  getProfile,
  knownProfiles,
  registerExternalDoc,
  userDocUrl,
  userDoc,
  onOpenProfile,
  onMutualTrustEstablished,
}: TrustReciprocityModalProps<TData>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus>('pending');

  // Reset index when pending attestations change
  useEffect(() => {
    if (pendingAttestations.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= pendingAttestations.length) {
      setCurrentIndex(0);
    }
  }, [pendingAttestations, currentIndex]);

  // Verify signature of current attestation
  useEffect(() => {
    if (pendingAttestations.length === 0 || currentIndex >= pendingAttestations.length) {
      return;
    }
    setSignatureStatus('pending');
    verifyAttestationSignature(pendingAttestations[currentIndex]).then(setSignatureStatus);
  }, [pendingAttestations, currentIndex]);

  // Render signature status icon
  const renderSignatureIcon = (status: SignatureStatus) => {
    if (status === 'pending') {
      return <span className="loading loading-spinner loading-xs"></span>;
    }
    if (status === 'valid') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    }
    if (status === 'invalid') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    // missing
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  if (pendingAttestations.length === 0 || currentIndex >= pendingAttestations.length) {
    return null;
  }

  const currentAttestation = pendingAttestations[currentIndex];
  const trusterDid = currentAttestation.trusterDid;
  const knownProfile = getProfile?.(trusterDid);
  const workspaceProfile = doc?.identities?.[trusterDid];
  const trustedProfile = trustedUserProfiles[trusterDid];
  // Priority: knownProfiles > trustedUserProfiles > workspace identity > DID-based name
  const displayName = knownProfile?.displayName || trustedProfile?.displayName || workspaceProfile?.displayName || getDefaultDisplayName(trusterDid);
  const avatarUrl = knownProfile?.avatarUrl || trustedProfile?.avatarUrl || workspaceProfile?.avatarUrl;

  const handleOpenScanner = () => {
    setShowScanner(true);
  };

  const handleScannerClose = () => {
    setShowScanner(false);
  };

  const handleTrustFromScanner = (scannedDid: string, scannedUserDocUrl?: string) => {
    onTrustUser(scannedDid, scannedUserDocUrl);
    setShowScanner(false);

    // Mark the current attestation as handled if the scanned DID matches
    if (scannedDid === trusterDid) {
      onDecline(currentAttestation.id); // Mark as seen

      // This is mutual trust! The truster trusted us, and we just trusted them back
      const friendName = getProfile?.(scannedDid)?.displayName || trustedUserProfiles[scannedDid]?.displayName || displayName;
      onMutualTrustEstablished?.(scannedDid, friendName);
      onOpenProfile?.(scannedDid);
    }

    // Move to next attestation
    if (currentIndex < pendingAttestations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDecline = () => {
    onDecline(currentAttestation.id);
    // Move to next attestation or close
    if (currentIndex < pendingAttestations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const remainingCount = pendingAttestations.length - currentIndex - 1;

  return (
    <div className="modal modal-open z-[10000]">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Vertrauensanfrage</h3>

        <div className="flex flex-col items-center gap-4 p-4 bg-base-200 rounded-lg mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
            <UserAvatar
              did={trusterDid}
              avatarUrl={avatarUrl}
              size={80}
            />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="font-bold text-lg">{displayName}</div>
              <span
                className="tooltip tooltip-top"
                data-tip={
                  signatureStatus === 'valid' ? `${displayName}s Signatur verifiziert` :
                  signatureStatus === 'invalid' ? `${displayName}s Signatur ungültig!` :
                  signatureStatus === 'missing' ? `${displayName}s Signatur fehlt (Legacy)` :
                  `${displayName}s Signatur wird geprüft...`
                }
              >
                {renderSignatureIcon(signatureStatus)}
              </span>
            </div>
            <div className="text-xs text-base-content/50 break-all mt-2">
              {trusterDid}
            </div>
          </div>
        </div>

        {signatureStatus === 'invalid' ? (
          <div className="alert alert-error mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
            <span className="text-sm">
              <strong>Warnung:</strong> Die Signatur dieser Attestierung ist ungültig!
              Diese könnte gefälscht sein.
            </span>
          </div>
        ) : (
          <div className="alert alert-info mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span className="text-sm">
              <strong>{displayName}</strong> hat deine Identität verifiziert.
              Um zurück zu vertrauen, scanne den QR-Code von {displayName}.
            </span>
          </div>
        )}

        {remainingCount > 0 && (
          <div className="text-sm text-base-content/60 text-center mb-4">
            {remainingCount} weitere Anfrage{remainingCount > 1 ? 'n' : ''} ausstehend
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={handleDecline}>
            Später
          </button>
          <button className="btn btn-primary flex-1" onClick={handleOpenScanner}>
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
        </div>
      </div>
      <div className="modal-backdrop"></div>

      {/* QR Scanner Modal for trust-back */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={handleScannerClose}
        currentUserDid={currentUserDid}
        doc={doc}
        onTrustUser={handleTrustFromScanner}
        userDocUrl={userDocUrl}
        userDoc={userDoc}
        onOpenProfile={onOpenProfile}
        onMutualTrustEstablished={onMutualTrustEstablished}
        knownProfiles={knownProfiles}
        getProfile={getProfile}
        registerExternalDoc={registerExternalDoc}
      />
    </div>
  );
}
