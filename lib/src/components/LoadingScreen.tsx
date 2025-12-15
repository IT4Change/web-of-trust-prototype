/**
 * Loading screens for various initialization states
 *
 * - LoadingScreen: Full-screen spinner for initial app load
 * - DocumentLoadingScreen: Full-screen with retry progress (legacy)
 * - WorkspaceLoadingContent: Content-area loading for when shell is already visible
 */

import { useState, useEffect } from 'react';

export interface LoadingScreenProps {
  /** Optional message to show */
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'white',
        gap: '16px',
      }}
    >
      <div className="network-loader">
        {/* Center node */}
        <div className="node center"></div>
        {/* Level 1: Outer nodes with connections to center */}
        <div className="node n1"><div className="line l-center"></div></div>
        <div className="node n2"><div className="line l-center"></div><div className="line l-peer"></div></div>
        <div className="node n3"><div className="line l-center"></div><div className="line l-peer"></div></div>
        <div className="node n4"><div className="line l-center"></div><div className="line l-peer"></div></div>
        <div className="node n5"><div className="line l-center"></div><div className="line l-peer"></div></div>
        {/* Level 2: Multiple nodes branching from each level 1 node */}
        <div className="node n1a"><div className="line l-parent"></div><div className="line l-peer"></div></div>
        <div className="node n1b"><div className="line l-parent"></div><div className="line l-peer"></div></div>
        <div className="node n2a"><div className="line l-parent"></div></div>
        <div className="node n2b"><div className="line l-parent"></div><div className="line l-peer"></div></div>
        <div className="node n3a"><div className="line l-parent"></div></div>
        <div className="node n3b"><div className="line l-parent"></div><div className="line l-peer"></div></div>
        <div className="node n4a"><div className="line l-parent"></div><div className="line l-peer"></div></div>
        <div className="node n4b"><div className="line l-parent"></div></div>
        <div className="node n5a"><div className="line l-parent"></div></div>
        <div className="node n5b"><div className="line l-parent"></div></div>
      </div>
      <style>{`
        .network-loader {
          width: 120px;
          height: 120px;
          position: relative;
        }
        .network-loader .node {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .network-loader .node.center {
          left: 50%;
          top: 50%;
          background: #6366f1;
          width: 14px;
          height: 14px;
          animation: nl-pulse 1.5s ease-in-out infinite;
          z-index: 10;
        }
        .network-loader .node .line {
          position: absolute;
          height: 2px;
          background: currentColor;
        }
        /* Level 1 nodes - connect to center */
        /* n1: top center */
        .network-loader .node.n1 { left: 50%; top: 23%; background: #10b981; animation: nl-pop 4s ease-in-out infinite 0s; }
        .network-loader .node.n1 .line { width: 27px; left: 5px; top: 5px; transform: rotate(90deg); transform-origin: 0 0; background: #10b981; }

        /* n2: top right */
        .network-loader .node.n2 { left: 77%; top: 35%; background: #3b82f6; animation: nl-pop 4s ease-in-out infinite 0.2s; }
        .network-loader .node.n2 .line { width: 30px; left: 5px; top: 5px; transform: rotate(151deg); transform-origin: 0 0; background: #3b82f6; }

        /* n3: bottom right */
        .network-loader .node.n3 { left: 73%; top: 73%; background: #f59e0b; animation: nl-pop 4s ease-in-out infinite 0.4s; }
        .network-loader .node.n3 .line { width: 32px; left: 5px; top: 5px; transform: rotate(-135deg); transform-origin: 0 0; background: #f59e0b; }

        /* n4: bottom left */
        .network-loader .node.n4 { left: 27%; top: 73%; background: #ec4899; animation: nl-pop 4s ease-in-out infinite 0.6s; }
        .network-loader .node.n4 .line { width: 32px; left: 5px; top: 5px; transform: rotate(-45deg); transform-origin: 0 0; background: #ec4899; }

        /* n5: top left */
        .network-loader .node.n5 { left: 23%; top: 35%; background: #8b5cf6; animation: nl-pop 4s ease-in-out infinite 0.8s; }
        .network-loader .node.n5 .line { width: 30px; left: 5px; top: 5px; transform: rotate(29deg); transform-origin: 0 0; background: #8b5cf6; }

        /* Level 2 nodes - each with unique color */
        /* From n1 (top) */
        .network-loader .node.n1a { left: 35%; top: 5%; background: #06b6d4; animation: nl-pop 4s ease-in-out infinite 0.5s; }
        .network-loader .node.n1a .line { width: 22px; left: 5px; top: 5px; transform: rotate(48deg); transform-origin: 0 0; background: #06b6d4; }
        .network-loader .node.n1b { left: 65%; top: 5%; background: #84cc16; animation: nl-pop 4s ease-in-out infinite 0.6s; }
        .network-loader .node.n1b .line { width: 22px; left: 5px; top: 5px; transform: rotate(132deg); transform-origin: 0 0; background: #84cc16; }

        /* From n2 (top right) */
        .network-loader .node.n2a { left: 95%; top: 20%; background: #14b8a6; animation: nl-pop 4s ease-in-out infinite 0.7s; }
        .network-loader .node.n2a .line { width: 22px; left: 5px; top: 5px; transform: rotate(140deg); transform-origin: 0 0; background: #14b8a6; }
        .network-loader .node.n2b { left: 92%; top: 50%; background: #a855f7; animation: nl-pop 4s ease-in-out infinite 0.8s; }
        .network-loader .node.n2b .line { width: 20px; left: 5px; top: 5px; transform: rotate(-135deg); transform-origin: 0 0; background: #a855f7; }

        /* From n3 (bottom right) */
        .network-loader .node.n3a { left: 92%; top: 88%; background: #ef4444; animation: nl-pop 4s ease-in-out infinite 0.9s; }
        .network-loader .node.n3a .line { width: 22px; left: 5px; top: 5px; transform: rotate(-140deg); transform-origin: 0 0; background: #ef4444; }
        .network-loader .node.n3b { left: 60%; top: 95%; background: #22c55e; animation: nl-pop 4s ease-in-out infinite 1.0s; }
        .network-loader .node.n3b .line { width: 22px; left: 5px; top: 5px; transform: rotate(-60deg); transform-origin: 0 0; background: #22c55e; }

        /* From n4 (bottom left) */
        .network-loader .node.n4a { left: 8%; top: 88%; background: #eab308; animation: nl-pop 4s ease-in-out infinite 1.1s; }
        .network-loader .node.n4a .line { width: 22px; left: 5px; top: 5px; transform: rotate(-40deg); transform-origin: 0 0; background: #eab308; }
        .network-loader .node.n4b { left: 40%; top: 95%; background: #0ea5e9; animation: nl-pop 4s ease-in-out infinite 1.2s; }
        .network-loader .node.n4b .line { width: 22px; left: 5px; top: 5px; transform: rotate(-120deg); transform-origin: 0 0; background: #0ea5e9; }

        /* From n5 (top left) */
        .network-loader .node.n5a { left: 5%; top: 20%; background: #f97316; animation: nl-pop 4s ease-in-out infinite 1.3s; }
        .network-loader .node.n5a .line { width: 22px; left: 5px; top: 5px; transform: rotate(40deg); transform-origin: 0 0; background: #f97316; }
        .network-loader .node.n5b { left: 8%; top: 50%; background: #e11d48; animation: nl-pop 4s ease-in-out infinite 1.4s; }
        .network-loader .node.n5b .line { width: 20px; left: 5px; top: 5px; transform: rotate(-45deg); transform-origin: 0 0; background: #e11d48; }

        @keyframes nl-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
        @keyframes nl-pop {
          0%, 8% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          15%, 85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          92%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
        }
      `}</style>
      {message && <p style={{ color: '#64748b', fontSize: '14px' }}>{message}</p>}
    </div>
  );
}

export interface DocumentLoadingScreenProps {
  /** Document ID being loaded (truncated for display) */
  documentId?: string;
  /** Current retry attempt (1-based) */
  attempt?: number;
  /** Maximum retry attempts */
  maxAttempts?: number;
  /** Time elapsed since loading started (ms) */
  elapsedTime?: number;
  /** Callback to create a new document */
  onCreateNew?: () => void;
  /** Time after which to show "create new" option (ms) */
  showCreateNewAfter?: number;
}

/**
 * Enhanced loading screen for document sync with progress animation
 */
export function DocumentLoadingScreen({
  documentId,
  attempt = 1,
  maxAttempts = 5,
  elapsedTime = 0,
  onCreateNew,
  showCreateNewAfter = 20000,
}: DocumentLoadingScreenProps) {
  const [dots, setDots] = useState('');
  const [showCreateNew, setShowCreateNew] = useState(false);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Show "create new" button after threshold
  useEffect(() => {
    if (elapsedTime >= showCreateNewAfter) {
      setShowCreateNew(true);
    }
  }, [elapsedTime, showCreateNewAfter]);

  // Calculate progress based on attempts (each attempt has exponential backoff)
  // Attempts: 1 (0s), 2 (2s), 3 (4s), 4 (8s), 5 (16s) = ~30s total
  const progressPercent = Math.min((attempt / maxAttempts) * 100, 100);

  // Friendly status messages
  const getStatusMessage = () => {
    if (attempt === 1) return 'Verbinde mit Sync-Server';
    if (attempt === 2) return 'Suche Dokument im Netzwerk';
    if (attempt === 3) return 'Warte auf Synchronisation';
    if (attempt <= 5) return 'Noch einen Moment Geduld';
    if (attempt <= 8) return 'Verbindung wird aufgebaut';
    return 'Letzter Versuch';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200 p-4">
      <div className="text-center max-w-md w-full">
        {/* Animated sync icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div
            className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"
            style={{ animationDuration: '1.5s' }}
          ></div>

          {/* Inner pulsing circle */}
          <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>

        {/* Status message with animated dots */}
        <h2 className="text-xl font-medium text-base-content mb-2">
          {getStatusMessage()}{dots}
        </h2>

        {/* Subtle progress indicator */}
        <div className="w-full bg-base-300 rounded-full h-1.5 mb-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Attempt info (subtle) */}
        <p className="text-sm text-base-content/50 mb-6">
          Versuch {attempt} von {maxAttempts}
        </p>

        {/* Document ID (very subtle, truncated) */}
        {documentId && (
          <p className="text-xs text-base-content/30 font-mono truncate mb-6">
            {documentId.length > 40 ? `${documentId.substring(0, 40)}...` : documentId}
          </p>
        )}

        {/* Create new document button - appears after threshold */}
        {showCreateNew && onCreateNew && (
          <div className="animate-fade-in">
            <p className="text-sm text-base-content/60 mb-3">
              Das Dokument scheint nicht verfügbar zu sein.
            </p>
            <button
              className="btn btn-primary"
              onClick={onCreateNew}
            >
              Neues Dokument erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface WorkspaceLoadingContentProps {
  /** Document URL being loaded (for display) */
  documentUrl?: string;
  /** Seconds elapsed since loading started */
  secondsElapsed?: number;
  /** Callback to create a new document */
  onCreateNew?: () => void;
  /** Seconds after which to show "create new" option */
  showCreateNewAfterSeconds?: number;
  /** Callback to cancel loading and return to start */
  onCancel?: () => void;
}

/**
 * Content-area loading component for workspace documents.
 * Used when the app shell (navbar, etc.) is already visible
 * but the workspace document is still being loaded/synced.
 */
export function WorkspaceLoadingContent({
  documentUrl,
  secondsElapsed = 0,
  onCreateNew,
  showCreateNewAfterSeconds = 60,
  onCancel,
}: WorkspaceLoadingContentProps) {
  const [dots, setDots] = useState('');

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Show "create new" button after threshold
  const showCreateNew = secondsElapsed >= showCreateNewAfterSeconds;

  // Friendly status messages based on time
  const getStatusMessage = () => {
    if (secondsElapsed < 5) return 'Verbinde mit Sync-Server';
    if (secondsElapsed < 15) return 'Suche Workspace im Netzwerk';
    if (secondsElapsed < 30) return 'Warte auf Synchronisation';
    if (secondsElapsed < 45) return 'Noch einen Moment Geduld';
    return 'Synchronisation läuft';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-base-200">
      <div className="text-center max-w-md w-full">
        {/* Card container */}
        <div className="card bg-base-100 shadow-xl p-8">
          {/* Animated sync icon */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div
              className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"
              style={{ animationDuration: '1.5s' }}
            ></div>

            {/* Inner pulsing circle with folder icon */}
            <div className="absolute inset-3 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
              <svg
                className="w-7 h-7 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-base-content mb-2">
            Workspace wird geladen
          </h2>

          {/* Status message with animated dots */}
          <p className="text-base-content/70 mb-4">
            {getStatusMessage()}{dots}
          </p>

          {/* Seconds counter */}
          <p className="text-2xl font-mono text-base-content/60 mb-4">
            {secondsElapsed}s
          </p>

          {/* Document URL (very subtle, truncated) */}
          {documentUrl && (
            <p className="text-xs text-base-content/30 font-mono truncate mb-4 px-2">
              {documentUrl.length > 50 ? `${documentUrl.substring(0, 50)}...` : documentUrl}
            </p>
          )}

          {/* Create new document button - appears after threshold */}
          {showCreateNew && onCreateNew && (
            <div className="pt-4 border-t border-base-300">
              <p className="text-sm text-base-content/60 mb-3">
                Das Workspace-Dokument scheint nicht verfügbar zu sein.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={onCreateNew}
              >
                Neuen Workspace erstellen
              </button>
            </div>
          )}
        </div>

        {/* Cancel button */}
        {onCancel && (
          <button
            className="btn btn-ghost btn-sm mt-4"
            onClick={onCancel}
          >
            Abbrechen
          </button>
        )}

        {/* Hint text below card */}
        <p className="text-xs text-base-content/40 mt-4">
          Du kannst in der Zwischenzeit dein Profil und deine Freundesliste ansehen.
        </p>
      </div>
    </div>
  );
}
