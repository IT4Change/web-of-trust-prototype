/**
 * StartContent - Content area for start state (no workspace loaded)
 *
 * Introduces users to the Web of Trust concept and invites them to:
 * - Set up their profile
 * - Build their Web of Trust (verify friends)
 * - Start workspaces
 */

import { useState } from 'react';
import { UserAvatar } from './UserAvatar';

export interface StartContentProps {
  /** Callback when user wants to create a new workspace */
  onCreateWorkspace: (name: string, avatar?: string) => void;
  /** Callback to open own profile for editing */
  onOpenProfile: () => void;
  /** Callback to open QR scanner */
  onOpenScanner: () => void;
  /** Callback to show own QR code (opens profile) */
  onShowMyQR: () => void;
  /** Current user's identity */
  identity: {
    did: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export function StartContent({
  onCreateWorkspace,
  onOpenProfile,
  onOpenScanner,
  onShowMyQR,
  identity,
}: StartContentProps) {
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const handleCreateSubmit = () => {
    const trimmed = workspaceName.trim();
    if (!trimmed) return; // Name is required
    onCreateWorkspace(trimmed);
  };

  return (
    <div className="flex-1 overflow-y-auto flex justify-center p-4 py-8">
      <div className="max-w-md w-full pb-20 md:pb-16">
        {/* Welcome Header with Web of Trust explanation */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-4">
            Willkommen im{' '}<br className="sm:hidden" /><span className="whitespace-nowrap">Web of Trust</span>
          </h1>
            <p className="text-sm text-base-content/70">
              Hier kannst du Inhalte{' '}<br className="sm:hidden" />gezielt mit vertrauten Personen teilen.
            </p>
        </div>

        {/* Action Cards */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd"/>
                </svg>
                <span className="font-semibold">Dein Profil</span>
              </div>
              <p className="text-sm text-base-content/60 mb-3">
                Fülle dein Profil aus, damit andere dich erkennen können.
              </p>
              <div className="flex items-center gap-4">
                <UserAvatar
                  did={identity.did}
                  avatarUrl={identity.avatarUrl}
                  size={48}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {identity.displayName || 'Unbenannt'}
                  </div>
                </div>
                <button
                  className="btn btn-outline h-auto py-3"
                  onClick={onOpenProfile}
                >
                  Bearbeiten
                </button>
              </div>
            </div>
          </div>

          {/* Info: Web of Trust */}
          <p className="text-sm text-base-content/70 text-center px-4">
            Mit dem Web of Trust baust du ein persönliches Vertrauensnetzwerk auf – so kannst du Inhalte gezielt mit vertrauten Personen teilen.
          </p>

          {/* Web of Trust Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z"/>
                </svg>
                <span className="font-semibold">Web of Trust aufbauen</span>
              </div>
              <p className="text-sm text-base-content/60 mb-3">
                Verifiziere Freunde per QR-Code, um sie deinem Netzwerk hinzuzufügen.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn btn-primary h-auto py-3 gap-2"
                  onClick={onOpenScanner}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 12v4a1 1 0 0 1-1 1h-4" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M17 8V7" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M7 17h.01" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <rect x="7" y="7" width="5" height="5" rx="1" />
                  </svg>
                  <span>QR scannen</span>
                </button>
                <button
                  className="btn btn-outline h-auto py-3 gap-2"
                  onClick={onShowMyQR}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span>QR anzeigen</span>
                </button>
              </div>
            </div>
          </div>

          {/* Info: Space */}
          <p className="text-sm text-base-content/70 text-center px-4">
            Ein Space ist ein geteilter Raum, wo alle Teilnehmer gemeinsam arbeiten und den gleichen Content sehen.
          </p>

          {/* Space Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.566 4.657A4.505 4.505 0 016.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0015.75 3h-7.5a3 3 0 00-2.684 1.657zM2.25 12a3 3 0 013-3h13.5a3 3 0 013 3v6a3 3 0 01-3 3H5.25a3 3 0 01-3-3v-6zM5.25 7.5c-.41 0-.806.055-1.184.157A3 3 0 016.75 6h10.5a3 3 0 012.683 1.657A4.505 4.505 0 0018.75 7.5H5.25z"/>
                </svg>
                <span className="font-semibold">Space</span>
              </div>
              {!showCreateInput ? (
                <>
                  <p className="text-sm text-base-content/60 mb-3">
                    Trete einem Space über einen Einladungslink bei oder erstelle einen neuen.
                  </p>
                  <button
                    className="btn btn-outline w-full h-auto py-3 gap-2"
                    onClick={() => setShowCreateInput(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Space erstellen</span>
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Name des Space"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && workspaceName.trim() && handleCreateSubmit()}
                    onFocus={(e) => {
                      // Scroll input into view when keyboard appears on mobile
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 300);
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost flex-1 h-auto py-3"
                      onClick={() => {
                        setShowCreateInput(false);
                        setWorkspaceName('');
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      className="btn btn-primary flex-1 h-auto py-3"
                      onClick={handleCreateSubmit}
                      disabled={!workspaceName.trim()}
                    >
                      Erstellen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Bottom spacer for mobile */}
        <div className="h-8" />
      </div>
    </div>
  );
}
