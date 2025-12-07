/**
 * OnboardingScreen - Shown when user has no workspace
 *
 * Offers options to:
 * - Join an existing workspace (via QR code or link)
 * - Create a new workspace
 * - Learn about workspaces and Web of Trust
 */

import { useState } from 'react';
import type { StoredIdentity } from '../utils/storage';

export interface OnboardingScreenProps {
  /** Callback when user wants to join a workspace via URL */
  onJoinWorkspace: (docUrl: string) => void;
  /** Callback when user wants to create a new workspace */
  onCreateWorkspace: (name: string, avatar?: string) => void;
  /** Current user's identity */
  identity: StoredIdentity;
  /** App title for personalized greeting */
  appTitle?: string;
}

export function OnboardingScreen({
  onJoinWorkspace,
  onCreateWorkspace,
  identity,
  appTitle = 'Narrative',
}: OnboardingScreenProps) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [joinError, setJoinError] = useState('');

  const [showCreateInput, setShowCreateInput] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const handleJoinSubmit = () => {
    const trimmed = joinUrl.trim();
    if (!trimmed) {
      setJoinError('Bitte gib einen Link ein');
      return;
    }

    // Extract doc ID from various URL formats
    let docId = trimmed;

    // Handle full URLs with #doc= hash
    if (trimmed.includes('#doc=')) {
      const match = trimmed.match(/#doc=([^&]+)/);
      if (match) {
        docId = match[1];
      }
    }

    // Validate it looks like an automerge URL
    if (!docId.startsWith('automerge:')) {
      setJoinError('Ungültiger Workspace-Link');
      return;
    }

    setJoinError('');
    onJoinWorkspace(docId);
  };

  const handleCreateSubmit = () => {
    const trimmed = workspaceName.trim();
    if (!trimmed) {
      onCreateWorkspace('Neuer Workspace');
    } else {
      onCreateWorkspace(trimmed);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Willkommen bei {appTitle}!
          </h1>
          <p className="text-base-content/70">
            Hallo {identity.displayName || 'dort'}! Wie möchtest du starten?
          </p>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          {/* Join Workspace */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              {!showJoinInput ? (
                <button
                  className="btn btn-outline btn-lg w-full justify-start gap-3"
                  onClick={() => setShowJoinInput(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Workspace beitreten</div>
                    <div className="text-sm text-base-content/60">Mit einem Link oder QR-Code</div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="font-semibold">Workspace beitreten</span>
                  </div>
                  <input
                    type="text"
                    className={`input input-bordered w-full ${joinError ? 'input-error' : ''}`}
                    placeholder="Link einfügen (z.B. https://...#doc=automerge:...)"
                    value={joinUrl}
                    onChange={(e) => {
                      setJoinUrl(e.target.value);
                      setJoinError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
                    autoFocus
                  />
                  {joinError && (
                    <p className="text-error text-sm">{joinError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={() => {
                        setShowJoinInput(false);
                        setJoinUrl('');
                        setJoinError('');
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={handleJoinSubmit}
                    >
                      Beitreten
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Create Workspace */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              {!showCreateInput ? (
                <button
                  className="btn btn-primary btn-lg w-full justify-start gap-3"
                  onClick={() => setShowCreateInput(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Neuen Workspace erstellen</div>
                    <div className="text-sm opacity-80">Starte einen eigenen Workspace</div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-semibold">Neuen Workspace erstellen</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Name des Workspace (optional)"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSubmit()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={() => {
                        setShowCreateInput(false);
                        setWorkspaceName('');
                      }}
                    >
                      Abbrechen
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={handleCreateSubmit}
                    >
                      Erstellen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 space-y-4">
          <div className="divider text-base-content/50 text-sm">Was ist das?</div>

          <div className="bg-base-100 rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <div className="text-2xl">🏢</div>
              <div>
                <div className="font-semibold text-sm">Workspace</div>
                <div className="text-sm text-base-content/70">
                  Ein geteilter Raum, wo alle Teilnehmer den gleichen Content sehen und gemeinsam arbeiten.
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="text-2xl">🤝</div>
              <div>
                <div className="font-semibold text-sm">Web of Trust</div>
                <div className="text-sm text-base-content/70">
                  Verbinde dich mit Freunden per QR-Code. So kannst du Inhalte gezielt mit vertrauten Personen teilen.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
