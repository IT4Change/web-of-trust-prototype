import { useState, useEffect } from 'react';
import { UserAvatar } from './UserAvatar';
import { QRCodeSVG } from 'qrcode.react';
import type { BaseDocument } from '../schema/document';
import type { UserDocument } from '../schema/userDocument';
import type { TrustAttestation } from '../schema/identity';
import type { TrustedUserProfile } from '../hooks/useAppContext';
import { extractPublicKeyFromDid, base64Encode, getDefaultDisplayName } from '../utils/did';
import { formatRelativeTime, formatFullDateTime } from '../utils/time';
import { verifyEntitySignature } from '../utils/signature';
import { processImageFile } from '../utils/imageProcessing';
import { loadSharedIdentity, saveSharedIdentity } from '../utils/storage';

type SignatureStatus = 'valid' | 'invalid' | 'missing' | 'pending';

/**
 * Custom action for the profile modal
 */
export interface ProfileAction {
  /** Button label */
  label: string;
  /** Button icon (optional) */
  icon?: React.ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'error' | 'ghost' | 'outline';
  /** Only show for own profile */
  ownProfileOnly?: boolean;
  /** Only show for other profiles */
  otherProfileOnly?: boolean;
}

interface UserProfileModalProps<TData = unknown> {
  /** The DID of the user to display */
  did: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** The current document (for profile lookup) */
  doc: BaseDocument<TData>;
  /** Current user's DID (to show "You" badge and trust status) */
  currentUserDid?: string;
  /** Trust attestation given to this user (if any) */
  trustGiven?: TrustAttestation;
  /** Trust attestation received from this user (if any) */
  trustReceived?: TrustAttestation;
  /** Called when user wants to trust this profile */
  onTrust?: (did: string) => void;
  /** Called when user wants to revoke trust */
  onRevokeTrust?: (did: string) => void;
  /** User document URL for QR code (only shown for own profile) */
  userDocUrl?: string;
  /** Additional custom actions */
  customActions?: ProfileAction[];
  /** Hide the default trust actions */
  hideTrustActions?: boolean;
  /** Profiles loaded from trusted users' UserDocuments (for avatar/name) */
  trustedUserProfiles?: Record<string, TrustedUserProfile>;
  // --- Edit features for own profile ---
  /** UserDocument for consistent profile data (preferred source) */
  userDoc?: UserDocument | null;
  /** Callback to update identity (name, avatar) - enables edit mode for own profile */
  onUpdateIdentity?: (updates: { displayName?: string; avatarUrl?: string }) => void;
  /** Callback to export identity */
  onExportIdentity?: () => void;
  /** Callback to import identity */
  onImportIdentity?: () => void;
  /** Callback to reset identity */
  onResetIdentity?: () => void;
}

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

export function UserProfileModal<TData = unknown>({
  did,
  isOpen,
  onClose,
  doc,
  currentUserDid,
  trustGiven,
  trustReceived,
  onTrust,
  onRevokeTrust,
  userDocUrl,
  customActions = [],
  hideTrustActions = false,
  trustedUserProfiles = {},
  userDoc,
  onUpdateIdentity,
  onExportIdentity,
  onImportIdentity,
  onResetIdentity,
}: UserProfileModalProps<TData>) {
  const [trustGivenStatus, setTrustGivenStatus] = useState<SignatureStatus>('pending');
  const [trustReceivedStatus, setTrustReceivedStatus] = useState<SignatureStatus>('pending');

  // Edit states for own profile
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [avatarError, setAvatarError] = useState('');

  const isOwnProfile = currentUserDid === did;
  const canEdit = isOwnProfile && !!onUpdateIdentity;
  const workspaceProfile = doc.identities?.[did];
  const trustedProfile = trustedUserProfiles[did];
  // For own profile with userDoc, prefer userDoc data
  const displayName = (isOwnProfile && userDoc?.profile?.displayName)
    || trustedProfile?.displayName
    || workspaceProfile?.displayName
    || getDefaultDisplayName(did);
  const avatarUrl = (isOwnProfile && userDoc?.profile?.avatarUrl)
    || trustedProfile?.avatarUrl
    || workspaceProfile?.avatarUrl;

  // Determine trust relationship
  const hasTrustGiven = !!trustGiven;
  const hasTrustReceived = !!trustReceived;
  const isMutualTrust = hasTrustGiven && hasTrustReceived;

  // Verify signatures when attestations change
  useEffect(() => {
    if (!isOpen) return;

    if (trustGiven) {
      setTrustGivenStatus('pending');
      verifyAttestationSignature(trustGiven).then(setTrustGivenStatus);
    } else {
      setTrustGivenStatus('missing');
    }

    if (trustReceived) {
      setTrustReceivedStatus('pending');
      verifyAttestationSignature(trustReceived).then(setTrustReceivedStatus);
    } else {
      setTrustReceivedStatus('missing');
    }
  }, [isOpen, trustGiven, trustReceived]);

  // Sync nameInput when displayName changes
  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  // Avatar upload handler
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateIdentity) return;

    setAvatarError('');

    try {
      const { dataUrl, sizeKB } = await processImageFile(file, 128, 0.8);

      if (sizeKB > 50) {
        setAvatarError(`Warning: Avatar is ${sizeKB}KB (recommended: max 50KB). May cause slow sync.`);
      }

      // Save avatar immediately
      onUpdateIdentity({ avatarUrl: dataUrl });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Error processing image');
    }
  };

  // Remove avatar handler
  const handleRemoveAvatar = () => {
    if (!onUpdateIdentity) return;
    onUpdateIdentity({ avatarUrl: '' });
    setAvatarError('');
  };

  // Save name handler
  const handleSaveName = () => {
    const next = nameInput.trim();
    if (!next || !onUpdateIdentity) return;

    onUpdateIdentity({ displayName: next });

    // Update shared identity in localStorage
    const storedIdentity = loadSharedIdentity();
    if (storedIdentity) {
      storedIdentity.displayName = next;
      saveSharedIdentity(storedIdentity);
    }

    setIsEditingName(false);
  };

  if (!isOpen) return null;

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
    return null;
  };

  // QR Code value
  const qrValue = userDocUrl
    ? `narrative://verify/${did}?userDoc=${encodeURIComponent(userDocUrl)}`
    : `narrative://verify/${did}`;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-sm p-6">
        {/* Close button */}
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          onClick={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Own Profile: Avatar/Name on top, large QR below */}
        {isOwnProfile ? (
          <>
            {/* Avatar centered with optional edit overlay */}
            <div className="flex flex-col items-center mb-4 pt-2">
              <div className="relative mb-2">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
                  <UserAvatar did={did} avatarUrl={avatarUrl} size={80} />
                </div>
                {/* Edit overlay for avatar - only if canEdit */}
                {canEdit && (
                  <>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />
                    {/* Delete avatar button */}
                    {avatarUrl && (
                      <button
                        className="absolute -bottom-1 -right-2 w-8 h-8 bg-error rounded-lg flex items-center justify-center border-2 border-base-100 hover:bg-error/80 transition-colors"
                        onClick={handleRemoveAvatar}
                        title="Avatar entfernen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-error-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
                {/* Du badge - only for own profile when not in edit mode */}
                {isOwnProfile && !canEdit && (
                  <div className="absolute -bottom-1 -right-1 badge badge-primary badge-xs">Du</div>
                )}
              </div>

              {/* Name display or edit */}
              {canEdit && isEditingName ? (
                <div className="w-full max-w-[280px] mt-2">
                  <div className="form-control">
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Dein Name"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn btn-ghost btn-sm flex-1"
                      onClick={() => {
                        setNameInput(displayName);
                        setIsEditingName(false);
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      className="btn btn-primary btn-sm flex-1"
                      onClick={handleSaveName}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : canEdit ? (
                <div className="flex items-center justify-center w-full mt-2">
                  <div className="w-8 h-8 invisible" />
                  <span
                    className="font-bold text-3xl text-center cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setIsEditingName(true)}
                  >
                    {displayName}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm btn-circle ml-1"
                    onClick={() => setIsEditingName(true)}
                    title="Name bearbeiten"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="font-bold text-xl text-center leading-tight mt-2">{displayName}</div>
              )}

              {avatarError && (
                <div className="text-xs p-2 rounded mt-2 bg-warning/20 text-warning">
                  {avatarError}
                </div>
              )}
            </div>

            {/* Large QR Code */}
            <div className="flex flex-col items-center mb-4">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                <QRCodeSVG value={qrValue} size={180} level="M" />
              </div>
              <div className="text-sm text-base-content/60 mt-2 text-center">
                Zeig den QR-Code deinen Freunden um dein Netzwerk aufzubauen!
              </div>
            </div>

            {/* DID - Compact */}
            <div className="bg-base-200 rounded-lg p-2 mb-4">
              <code className="text-xs break-all select-all block leading-tight">{did}</code>
            </div>

            {/* Identity management - collapsible (only if canEdit) */}
            {canEdit && onExportIdentity && onImportIdentity && onResetIdentity && (
              <details className="collapse collapse-arrow bg-base-200 rounded-lg mb-2">
                <summary className="collapse-title">
                  Identität verwalten
                </summary>
                <div className="collapse-content">
                  <div className="flex flex-col gap-2 pt-2">
                    <button className="btn btn-outline btn-sm" onClick={onExportIdentity}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Exportieren
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={onImportIdentity}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Importieren
                    </button>
                    <button className="btn btn-error btn-sm" onClick={onResetIdentity}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              </details>
            )}
          </>
        ) : (
          <>
            {/* Other Profile: Centered Avatar */}
            <div className="flex flex-col items-center mb-4 pt-2">
              <div className="relative mb-2">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-base-300 ring-offset-2 ring-offset-base-100">
                  <UserAvatar did={did} avatarUrl={avatarUrl} size={80} />
                </div>
                {/* Trust indicator on avatar */}
                {isMutualTrust && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-success-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {hasTrustGiven && !isMutualTrust && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-info rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-info-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {hasTrustReceived && !isMutualTrust && !hasTrustGiven && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-warning rounded-full flex items-center justify-center border-2 border-base-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-warning-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="font-bold text-lg">{displayName}</div>

              {/* Trust Status Badge */}
              {isMutualTrust && (
                <span className="badge badge-success gap-1 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Gegenseitiges Vertrauen
                </span>
              )}
              {hasTrustGiven && !isMutualTrust && (
                <span className="badge badge-info gap-1 mt-1">Du vertraust</span>
              )}
              {hasTrustReceived && !isMutualTrust && !hasTrustGiven && (
                <span className="badge badge-warning gap-1 mt-1">Vertraut dir</span>
              )}
            </div>

            {/* DID - Compact */}
            <div className="bg-base-200 rounded-lg p-2 mb-4">
              <div className="text-xs text-base-content/50 mb-0.5">DID</div>
              <code className="text-xs break-all select-all block leading-tight">{did}</code>
            </div>

            {/* Trust Details - Compact inline */}
            {(hasTrustGiven || hasTrustReceived) && (
              <div className="space-y-2 mb-4">
                {hasTrustGiven && trustGiven && (
                  <div className="flex items-center justify-between text-sm bg-base-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-base-content/70">Von dir verifiziert</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderSignatureIcon(trustGivenStatus)}
                      {trustGiven.createdAt && (
                        <span
                          className="text-xs text-base-content/50"
                          title={formatFullDateTime(trustGiven.createdAt)}
                        >
                          {formatRelativeTime(trustGiven.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {hasTrustReceived && trustReceived && (
                  <div className="flex items-center justify-between text-sm bg-base-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                      </svg>
                      <span className="text-base-content/70">Hat dich verifiziert</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderSignatureIcon(trustReceivedStatus)}
                      {trustReceived.createdAt && (
                        <span
                          className="text-xs text-base-content/50"
                          title={formatFullDateTime(trustReceived.createdAt)}
                        >
                          {formatRelativeTime(trustReceived.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Custom actions */}
        {customActions.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {customActions
              .filter(action => {
                if (action.ownProfileOnly && !isOwnProfile) return false;
                if (action.otherProfileOnly && isOwnProfile) return false;
                return true;
              })
              .map((action, index) => {
                const variantClass = {
                  primary: 'btn-primary',
                  secondary: 'btn-secondary',
                  error: 'btn-error',
                  ghost: 'btn-ghost',
                  outline: 'btn-outline',
                }[action.variant || 'primary'];

                return (
                  <button
                    key={index}
                    className={`btn ${variantClass} w-full`}
                    onClick={action.onClick}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                );
              })}
          </div>
        )}

        {/* Trust action buttons */}
        {!isOwnProfile && !hideTrustActions && (
          <div className="flex gap-3">
            {hasTrustGiven ? (
              <button
                className="btn btn-error btn-outline flex-1"
                onClick={() => onRevokeTrust?.(did)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Vertrauen entziehen
              </button>
            ) : (
              <button
                className="btn btn-primary flex-1"
                onClick={() => onTrust?.(did)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verifizieren
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Schließen
            </button>
          </div>
        )}

      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
