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

export function LoadingScreen({ message = 'Initialisiere...' }: LoadingScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-base-content">{message}</p>
      </div>
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
  /** Document ID being loaded (for display) */
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
  /** Callback to cancel loading and return to start */
  onCancel?: () => void;
}

/**
 * Content-area loading component for workspace documents.
 * Used when the app shell (navbar, etc.) is already visible
 * but the workspace document is still being loaded/synced.
 */
export function WorkspaceLoadingContent({
  documentId,
  attempt = 1,
  maxAttempts = 10,
  elapsedTime = 0,
  onCreateNew,
  showCreateNewAfter = 20000,
  onCancel,
}: WorkspaceLoadingContentProps) {
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

  // Calculate progress based on attempts
  const progressPercent = Math.min((attempt / maxAttempts) * 100, 100);

  // Friendly status messages
  const getStatusMessage = () => {
    if (attempt === 1) return 'Verbinde mit Sync-Server';
    if (attempt === 2) return 'Suche Workspace im Netzwerk';
    if (attempt === 3) return 'Warte auf Synchronisation';
    if (attempt <= 5) return 'Noch einen Moment Geduld';
    if (attempt <= 8) return 'Verbindung wird aufgebaut';
    return 'Letzter Versuch';
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

          {/* Progress bar */}
          <div className="w-full bg-base-300 rounded-full h-1.5 mb-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Attempt info */}
          <p className="text-xs text-base-content/40 mb-4">
            Versuch {attempt} von {maxAttempts}
          </p>

          {/* Document ID (very subtle, truncated) */}
          {documentId && (
            <p className="text-xs text-base-content/30 font-mono truncate mb-4 px-2">
              {documentId.length > 50 ? `${documentId.substring(0, 50)}...` : documentId}
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
