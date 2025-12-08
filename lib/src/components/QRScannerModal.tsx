import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import { QRCodeSVG } from 'qrcode.react';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { KnownProfile } from '../hooks/useAppContext';
import { UserAvatar } from './UserAvatar';
import { getDefaultDisplayName, extractPublicKeyFromDid, base64Encode } from '../utils/did';
import { verifyProfileSignature } from '../utils/signature';

type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending' | 'loading' | 'waiting';

interface QRScannerModalProps<TData = unknown> {
  isOpen: boolean;
  onClose: () => void;
  currentUserDid: string;
  /** Workspace document (optional - can work without it using only userDoc) */
  doc?: BaseDocument<TData> | null;
  /** Callback when user trusts another user. Receives DID and optional userDocUrl for bidirectional trust. */
  onTrustUser: (did: string, userDocUrl?: string) => void;
  /** Current user's UserDocument URL (for showing own QR code after confirming) */
  userDocUrl?: string;
  /** Current user's UserDocument (reactive, for detecting mutual trust) */
  userDoc?: UserDocument | null;
  /** Callback to open a user's profile */
  onOpenProfile?: (did: string) => void;
  /** Callback when mutual trust is established (both users trust each other) */
  onMutualTrustEstablished?: (friendDid: string, friendName: string) => void;
  /** Get profile from central known profiles (optional - enables reactive updates) */
  getProfile?: (did: string) => KnownProfile | undefined;
  /** Register external doc for reactive profile loading (optional - call after QR scan) */
  registerExternalDoc?: (userDocUrl: string) => void;
  /**
   * All known profiles from useAppContext (optional - enables reactive UI updates)
   * When this Map changes, the component re-renders with updated profile data
   */
  knownProfiles?: Map<string, KnownProfile>;
}

export function QRScannerModal<TData = unknown>({
  isOpen,
  onClose,
  currentUserDid,
  doc,
  onTrustUser,
  userDocUrl,
  userDoc,
  onOpenProfile,
  onMutualTrustEstablished,
  getProfile,
  registerExternalDoc,
  knownProfiles,
}: QRScannerModalProps<TData>) {
  const repo = useRepo();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scannedDid, setScannedDid] = useState<string | null>(null);
  const [scannedUserDocUrl, setScannedUserDocUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus>('pending');
  const [loadedProfile, setLoadedProfile] = useState<{ displayName?: string; avatarUrl?: string } | null>(null);
  const [showOwnQR, setShowOwnQR] = useState(false);
  const [confirmedUserName, setConfirmedUserName] = useState<string>('');
  const [confirmedDid, setConfirmedDid] = useState<string | null>(null);

  // Load UserDocument and verify signature when scanned (reactive)
  useEffect(() => {
    if (!scannedDid || !scannedUserDocUrl) {
      setSignatureStatus('missing');
      setLoadedProfile(null);
      return;
    }

    // Register with central profile management for reactive updates
    console.log('[QRScannerModal] registerExternalDoc available:', !!registerExternalDoc, 'userDocUrl:', scannedUserDocUrl?.substring(0, 30));
    if (registerExternalDoc) {
      console.log('[QRScannerModal] Calling registerExternalDoc with:', scannedUserDocUrl?.substring(0, 40));
      registerExternalDoc(scannedUserDocUrl);
    } else {
      console.warn('[QRScannerModal] registerExternalDoc is undefined - cannot register for reactive updates');
    }

    let cleanup: (() => void) | undefined;

    const loadAndVerify = async () => {
      setSignatureStatus('loading');
      try {
        // Load the UserDocument
        const handle = await repo.find<UserDocument>(scannedUserDocUrl as AutomergeUrl);

        // Function to update profile from document
        const updateFromDoc = async (userDoc: UserDocument | undefined) => {
          if (!userDoc || !userDoc.profile) {
            console.log('[QRScannerModal] UserDocument has no profile');
            setSignatureStatus('missing');
            setLoadedProfile(null);
            return;
          }

          // Verify the DID matches
          if (userDoc.did !== scannedDid) {
            console.warn('[QRScannerModal] DID mismatch in UserDocument');
            setSignatureStatus('invalid');
            return;
          }

          // Store the profile data from UserDocument
          console.log('[QRScannerModal] Profile loaded:', userDoc.profile.displayName);
          setLoadedProfile({
            displayName: userDoc.profile.displayName,
            avatarUrl: userDoc.profile.avatarUrl,
          });

          // Check if profile has a signature
          if (!userDoc.profile.signature) {
            setSignatureStatus('missing');
            return;
          }

          // Verify the profile signature
          const publicKeyBytes = extractPublicKeyFromDid(scannedDid);
          const publicKeyBase64 = base64Encode(publicKeyBytes);
          const result = await verifyProfileSignature(userDoc.profile, publicKeyBase64);

          setSignatureStatus(result.valid ? 'valid' : 'invalid');
        };

        // Show waiting state while we wait for the document
        setSignatureStatus('waiting');

        // Wait for document to arrive from network (proper automerge-repo API!)
        // Add explicit timeout since whenReady() may hang indefinitely
        console.log('[QRScannerModal] Waiting for document from network...');

        const timeoutMs = 60000; // 60 seconds - sync can take up to a minute
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        try {
          await Promise.race([handle.whenReady(), timeoutPromise]);
          console.log('[QRScannerModal] Document ready!');
        } catch (timeoutErr) {
          console.warn('[QRScannerModal] Timeout waiting for document:', timeoutErr);
          // Check if we got the doc anyway (race condition)
          const maybeDoc = handle.doc();
          if (!maybeDoc) {
            setSignatureStatus('missing');
            return;
          }
          console.log('[QRScannerModal] Document available despite timeout');
        }

        // Now safely access the document
        const userDoc = handle.doc();
        await updateFromDoc(userDoc);

        // Subscribe to future changes
        const onChange = () => {
          updateFromDoc(handle.doc());
        };
        handle.on('change', onChange);

        cleanup = () => {
          handle.off('change', onChange);
        };
      } catch (error) {
        console.error('[QRScannerModal] Failed to load/verify UserDocument:', error);
        setSignatureStatus('missing');
      }
    };

    loadAndVerify();

    return () => {
      cleanup?.();
    };
  }, [scannedDid, scannedUserDocUrl, repo]);

  // Start scanner when modal opens
  useEffect(() => {
    if (!isOpen || scannedDid) return;

    const startScanner = async () => {
      try {
        setIsScanning(true);
        setScanError('');

        // Create scanner instance
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        // Start scanning
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Parse the scanned QR code
            // Format: narrative://verify/{did}?userDoc={encodedUrl}
            const match = decodedText.match(/narrative:\/\/verify\/([^?]+)(\?.*)?/);
            if (match && match[1]) {
              const did = match[1];
              setScannedDid(did);

              // Extract userDocUrl if present
              if (match[2]) {
                const params = new URLSearchParams(match[2]);
                const userDocUrl = params.get('userDoc');
                if (userDocUrl) {
                  setScannedUserDocUrl(decodeURIComponent(userDocUrl));
                }
              }

              setIsScanning(false);
              // Just stop scanning, don't clear yet
              scanner.stop().catch(console.error);
            } else {
              setScanError('Invalid QR code. Please scan a Narrative verification QR code.');
            }
          },
          (errorMessage) => {
            // Ignore common scanning errors
            if (!errorMessage.includes('NotFoundException')) {
              console.warn('QR Scan error:', errorMessage);
            }
          }
        );
      } catch (error) {
        console.error('Failed to start scanner:', error);
        setScanError('Failed to access camera. Please check permissions.');
        setIsScanning(false);
      }
    };

    startScanner();

    // Cleanup - only when modal closes
    return () => {
      const currentScanner = scannerRef.current;
      if (currentScanner) {
        const cleanup = async () => {
          try {
            const state = currentScanner.getState();
            // Only try to stop if actually scanning
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
              await currentScanner.stop();
            }
            currentScanner.clear();
          } catch (error) {
            // Ignore errors during cleanup
          }
        };
        cleanup();
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  // Auto-detect mutual trust: when showing own QR, watch for trustReceived from the confirmed user
  useEffect(() => {
    if (!showOwnQR || !confirmedDid || !userDoc) return;

    // Check if the confirmed user now appears in our trustReceived
    if (userDoc.trustReceived?.[confirmedDid]) {
      console.log('[QRScannerModal] Mutual trust detected! Friend:', confirmedDid);
      // Mutual trust established - trigger callbacks and close
      onMutualTrustEstablished?.(confirmedDid, confirmedUserName);
      onOpenProfile?.(confirmedDid);
      handleClose();
    }
  }, [showOwnQR, confirmedDid, userDoc, userDoc?.trustReceived, confirmedUserName, onMutualTrustEstablished, onOpenProfile]);

  const handleClose = async () => {
    // Stop and clear scanner if it exists
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // Only try to stop if actually scanning
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    setScannedDid(null);
    setScannedUserDocUrl(null);
    setScanError('');
    setIsScanning(false);
    setSignatureStatus('pending');
    setLoadedProfile(null);
    setShowOwnQR(false);
    setConfirmedUserName('');
    setConfirmedDid(null);
    onClose();
  };

  const handleTrust = () => {
    console.log('[QRScannerModal] handleTrust called', {
      scannedDid,
      scannedUserDocUrl,
      currentUserDid,
      hasOnTrustUser: !!onTrustUser
    });
    if (scannedDid) {
      // Get display name before clearing state
      const workspaceProfile = doc?.identities?.[scannedDid];
      const userName = loadedProfile?.displayName || workspaceProfile?.displayName || getDefaultDisplayName(scannedDid);

      console.log('[QRScannerModal] Calling onTrustUser with:', scannedDid, scannedUserDocUrl);
      onTrustUser(scannedDid, scannedUserDocUrl ?? undefined);

      // Show own QR code for reciprocal trust (if userDocUrl is available)
      if (userDocUrl) {
        setConfirmedDid(scannedDid);
        setConfirmedUserName(userName);
        setShowOwnQR(true);
        // Clear scanned data but keep modal open
        setScannedDid(null);
        setScannedUserDocUrl(null);
        setLoadedProfile(null);
        setSignatureStatus('pending');
      } else {
        console.log('[QRScannerModal] No userDocUrl, closing modal');
        handleClose();
      }
    } else {
      console.warn('[QRScannerModal] handleTrust called but no scannedDid!');
    }
  };

  if (!isOpen) return null;

  // Show own QR code after confirming trust (for reciprocal trust)
  if (showOwnQR && userDocUrl) {
    const ownProfile = doc?.identities?.[currentUserDid];
    const ownDisplayName = ownProfile?.displayName || getDefaultDisplayName(currentUserDid);
    const ownQrValue = `narrative://verify/${currentUserDid}?userDoc=${encodeURIComponent(userDocUrl)}`;

    return (
      <div className="modal modal-open z-[9999]">
        <div className="modal-box max-w-md">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={handleClose}
          >
            ✕
          </button>

          <h3 className="font-bold text-xl mb-4 text-center">Zeige jetzt {confirmedUserName} deinen Code</h3>

          <div className="flex flex-col items-center mb-4">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <QRCodeSVG value={ownQrValue} size={180} level="M" />
            </div>
            <div className="alert alert-success py-3 justify-center text-center mt-4">

              <div className="text-sm text-base-content text-center">
                Lass <span className="font-bold">{confirmedUserName}</span> jetzt deinen QR-Code scannen, damit ihr euch gegenseitig vertraut!
              </div>
            </div>
          </div>

        </div>
        <div className="modal-backdrop" onClick={handleClose}></div>
      </div>
    );
  }

  // Show confirmation dialog after successful scan
  if (scannedDid) {
    // Priority: knownProfiles (central) > loadedProfile (local) > workspace > default
    // Use both getProfile function and knownProfiles Map for reactive updates
    const knownProfile = getProfile?.(scannedDid) ?? knownProfiles?.get(scannedDid);
    const workspaceProfile = doc?.identities?.[scannedDid];
    const displayName = knownProfile?.displayName || loadedProfile?.displayName || workspaceProfile?.displayName || getDefaultDisplayName(scannedDid);
    const avatarUrl = knownProfile?.avatarUrl || loadedProfile?.avatarUrl || workspaceProfile?.avatarUrl;

    // Debug: Log profile sources to understand what's happening
    console.log('[QRScannerModal] Profile resolution:', {
      scannedDid: scannedDid?.substring(0, 30),
      knownProfilesSize: knownProfiles?.size,
      hasKnownProfile: !!knownProfile,
      knownProfileData: knownProfile ? { displayName: knownProfile.displayName, avatarUrl: !!knownProfile.avatarUrl, source: knownProfile.source } : null,
      loadedProfile: loadedProfile ? { displayName: loadedProfile.displayName, avatarUrl: !!loadedProfile.avatarUrl } : null,
      finalDisplayName: displayName,
      finalAvatarUrl: !!avatarUrl,
    });

    // Use signature status from knownProfiles if available, otherwise use local status
    const effectiveSignatureStatus = knownProfile?.signatureStatus || signatureStatus;

    // Render signature badge using effectiveSignatureStatus
    const renderSignatureBadge = () => {
      if (effectiveSignatureStatus === 'loading' || effectiveSignatureStatus === 'waiting' || effectiveSignatureStatus === 'pending') {
        // Show loading only for local states (knownProfile 'pending' means still loading)
        if (signatureStatus === 'loading' || signatureStatus === 'waiting') {
          return (
            <span className="tooltip tooltip-top" data-tip={signatureStatus === 'waiting' ? "Warte auf Netzwerk..." : "Profil wird geprüft..."}>
              <span className="loading loading-spinner loading-xs"></span>
            </span>
          );
        }
        return null;
      }
      if (effectiveSignatureStatus === 'valid') {
        return (
          <span className="tooltip tooltip-top" data-tip="Profil verifiziert">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        );
      }
      if (effectiveSignatureStatus === 'invalid') {
        return (
          <span className="tooltip tooltip-top" data-tip="Profil manipuliert!">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        );
      }
      // 'missing' - no badge shown
      return null;
    };

    return (
      <div className="modal modal-open z-[9999]">
        <div className="modal-box max-w-md">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={handleClose}
          >
            ✕
          </button>

          <h3 className="font-bold text-xl mb-4 text-center">Freund hinzufügen</h3>

          <div className="flex flex-col items-center gap-4 p-4 bg-base-200 rounded-lg">
            <div className={`w-20 h-20 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-base-100 ${signatureStatus === 'waiting' ? 'ring-warning' : 'ring-primary'}`}>
              {signatureStatus === 'waiting' && !loadedProfile ? (
                <div className="w-full h-full flex items-center justify-center bg-base-300">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : (
                <UserAvatar
                  did={scannedDid}
                  avatarUrl={avatarUrl}
                  size={80}
                />
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="font-bold text-lg">{displayName}</div>
                {renderSignatureBadge()}
              </div>
              <div className="text-xs text-base-content/50 break-all mt-2">
                {scannedDid}
              </div>
            </div>
          </div>

          {signatureStatus === 'waiting' && (
            <div className="alert alert-warning py-2 justify-center text-center">
              <span className="loading loading-spinner loading-xs"></span>
              <span className="text-sm">
                Profil wird vom Netzwerk geladen...
              </span>
            </div>
          )}

          <div className="alert alert-info py-2 justify-center text-center">
            <span className="text-sm">
              Hiermit bestätige ich die Identität von {displayName} und füge sie in mein Netzwerk hinzu.
            </span>
          </div>

          <div className="modal-action">
            <button className="btn" onClick={handleClose}>
              Abbrechen
            </button>
            <button className="btn btn-primary" onClick={handleTrust}>
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Bestätigen
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={handleClose}></div>
      </div>
    );
  }

  // Show scanner view
  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-md">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          onClick={handleClose}
        >
          ✕
        </button>

        <h3 className="font-bold text-xl mb-4 text-center">Freund hinzufügen</h3>

        <div className="flex flex-col gap-3">
          {/* Scanner container */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <div id="qr-reader" className="w-full"></div>
          </div>

          {/* Trust hint */}
          <div className="alert alert-success py-2 justify-center text-center">
            <span className="font-bold text-white">Scanne den QR-Code deines Freundes, um ihm zu vertrauen</span>
          </div>

          {scanError && (
            <div className="alert alert-error py-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{scanError}</span>
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );
}
