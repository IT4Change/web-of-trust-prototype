/**
 * NewWorkspaceModal - Dialog to create a new workspace with name and avatar
 */

import { useState, useRef } from 'react';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, avatarDataUrl?: string) => void;
}

export function NewWorkspaceModal({
  isOpen,
  onClose,
  onCreate,
}: NewWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 500KB for data URL)
    if (file.size > 500 * 1024) {
      alert('Bild zu groß. Maximal 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate(name.trim(), avatarPreview || undefined);

    // Reset form
    setName('');
    setAvatarPreview(null);
    onClose();
  };

  const handleClose = () => {
    setName('');
    setAvatarPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-[9999]">
      <div className="modal-box max-w-md">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={handleClose}
        >
          ✕
        </button>

        <h3 className="font-bold text-lg mb-6">Neuer Workspace</h3>

        <form onSubmit={handleSubmit}>
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden bg-base-300 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Workspace Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-base-content/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 mx-auto mb-1"
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
                  <span className="text-xs">Bild hinzufügen</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {avatarPreview && (
              <button
                type="button"
                className="btn btn-xs btn-ghost mt-2"
                onClick={() => setAvatarPreview(null)}
              >
                Bild entfernen
              </button>
            )}
          </div>

          {/* Name */}
          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text">Workspace Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="z.B. Mein Projekt"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >
              Erstellen
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );
}
