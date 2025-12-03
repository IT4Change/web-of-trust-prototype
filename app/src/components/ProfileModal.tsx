import { UserAvatar } from './UserAvatar';
import { processImageFile } from '../utils/imageProcessing';
import { useState } from 'react';
import type { OpinionGraphDoc } from 'narrative-ui';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserDid: string;
  doc: OpinionGraphDoc;
  onUpdateIdentity: (updates: { displayName?: string; avatarUrl?: string }) => void;
  onExportIdentity: () => void;
  onImportIdentity: () => void;
  onResetId: () => void;
  initialDisplayName?: string;
}

export function ProfileModal({
  isOpen,
  onClose,
  currentUserDid,
  doc,
  onUpdateIdentity,
  onExportIdentity,
  onImportIdentity,
  onResetId,
  initialDisplayName = '',
}: ProfileModalProps) {
  const [nameInput, setNameInput] = useState(initialDisplayName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSizeKB, setAvatarSizeKB] = useState<number>(0);
  const [avatarError, setAvatarError] = useState<string>('');

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    try {
      const { dataUrl, sizeKB } = await processImageFile(file, 128, 0.8);
      setAvatarPreview(dataUrl);
      setAvatarSizeKB(sizeKB);

      if (sizeKB > 50) {
        setAvatarError(`Warnung: Avatar ist ${sizeKB}KB groß (empfohlen: max. 50KB). Möglicherweise langsame Synchronisation.`);
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Fehler beim Verarbeiten des Bildes');
      setAvatarPreview(null);
    }
  };

  const handleRemoveAvatar = () => {
    onUpdateIdentity({ avatarUrl: '' });
    setAvatarPreview(null);
    setAvatarSizeKB(0);
    setAvatarError('');
  };

  const handleSaveName = () => {
    const next = nameInput.trim();
    if (!next) return;

    // Save both display name and avatar (if changed)
    onUpdateIdentity({
      displayName: next,
      ...(avatarPreview ? { avatarUrl: avatarPreview } : {})
    });

    const storedIdentity = localStorage.getItem('narrativeIdentity');
    if (storedIdentity) {
      const parsed = JSON.parse(storedIdentity);
      parsed.displayName = next;
      localStorage.setItem('narrativeIdentity', JSON.stringify(parsed));
    }

    // Reset avatar preview after saving
    setAvatarPreview(null);
    setAvatarSizeKB(0);
    setAvatarError('');

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md space-y-4">
        <h3 className="font-bold text-lg">Dein Profil</h3>

        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-3 p-4 bg-base-200 rounded-lg">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-base-100">
            <UserAvatar
              did={currentUserDid}
              avatarUrl={avatarPreview || doc?.identities?.[currentUserDid]?.avatarUrl}
              size={96}
            />
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="avatar-upload" className="btn btn-sm btn-outline w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Avatar hochladen
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />

            {avatarPreview && (
              <p className="text-xs text-base-content/60 mt-2">
                Avatar-Vorschau ({avatarSizeKB}KB) - Wird beim Speichern übernommen
              </p>
            )}

            {(doc?.identities?.[currentUserDid]?.avatarUrl || avatarPreview) && (
              <button className="btn btn-sm btn-ghost w-full" onClick={handleRemoveAvatar}>
                Avatar entfernen
              </button>
            )}

            {avatarError && (
              <div className={`text-xs p-2 rounded ${avatarSizeKB > 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
                {avatarError}
              </div>
            )}

            <div className="text-xs text-base-content/60 text-center">
              128x128px, max. 50KB empfohlen
            </div>
          </div>
        </div>

        {/* DID Section */}
        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-sm text-base-content/70 mb-1">Deine DID</div>
          <code className="text-xs break-all">{currentUserDid}</code>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Anzeigename</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Dein Name"
          />
          <label className="label">
            <span className="label-text-alt text-base-content/60">
              Wird lokal gespeichert und mit deinem DID geteilt.
            </span>
          </label>
          <button className="btn btn-primary btn-sm w-fit mt-2" onClick={handleSaveName}>
            Speichern
          </button>
        </div>

        <div className="divider">Identity</div>
        <div className="flex flex-col gap-2">
          <button className="btn btn-outline btn-sm" onClick={onExportIdentity}>
            Export Identity
          </button>
          <button className="btn btn-outline btn-sm" onClick={onImportIdentity}>
            Import Identity
          </button>
          <button className="btn btn-error btn-sm" onClick={onResetId}>
            Reset ID
          </button>
        </div>

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
