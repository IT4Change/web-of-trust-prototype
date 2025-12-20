/**
 * UnifiedApp - Main view component with module switching
 *
 * Follows the standard pattern: receives props from AppShell, uses AppLayout for UI.
 */

import { useState } from 'react';
import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument, type WorkspaceLoadingState, type ContentState } from 'narrative-ui';
import { UnifiedDocument, AVAILABLE_MODULES, ModuleId } from './types';
import { ModuleSwitcher } from './components/ModuleSwitcher';
import { BottomNav } from './components/BottomNav';
import { NarrativeModuleWrapper } from './components/NarrativeModuleWrapper';
import { MarketModuleWrapper } from './components/MarketModuleWrapper';
import { MapModuleWrapper } from './components/MapModuleWrapper';

export interface UnifiedAppProps {
  documentId: DocumentId | null;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
  // Workspace loading state (from AppShell when document is still loading)
  workspaceLoading?: WorkspaceLoadingState;
  // Debug Dashboard toggle (from AppShell)
  onToggleDebugDashboard: () => void;
  // Content state from AppShell
  contentState: ContentState;
  // Callbacks for content state transitions
  onJoinWorkspace: (docUrl: string) => void;
  onCancelLoading: () => void;
  // Callback to go to start screen (from workspace switcher)
  onGoToStart?: () => void;
  // Callback to switch workspace without page reload
  onSwitchWorkspace?: (workspaceId: string) => void;
  // Callback to import identity (handles state update without page reload)
  onImportIdentity?: () => void;
}

/**
 * Main Unified Application View
 */
export function UnifiedApp({
  documentId,
  currentUserDid,
  privateKey,
  publicKey,
  displayName,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
  workspaceLoading,
  onToggleDebugDashboard,
  contentState,
  onJoinWorkspace,
  onCancelLoading,
  onGoToStart,
  onSwitchWorkspace,
  onImportIdentity,
}: UnifiedAppProps) {
  // In automerge-repo v2.x, use useDocHandle hook instead of repo.find()
  // Handle null docId case - hooks must be called unconditionally
  const docHandle = useDocHandle<UnifiedDocument>(documentId ?? undefined);

  // Load documents reactively
  const [doc] = useDocument<UnifiedDocument>(documentId ?? undefined);
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // App-specific UI state
  const [activeModule, setActiveModule] = useState<ModuleId>('narrative');

  // Callback for updating identity in the document
  const handleUpdateIdentityInDoc = (updates: { displayName?: string; avatarUrl?: string }) => {
    if (!docHandle) return;
    docHandle.change((d) => {
      if (!d.identities) {
        d.identities = {};
      }
      if (!d.identities[currentUserDid]) {
        d.identities[currentUserDid] = {};
      }
      if (updates.displayName !== undefined) {
        d.identities[currentUserDid].displayName = updates.displayName;
      }
      if (updates.avatarUrl !== undefined) {
        d.identities[currentUserDid].avatarUrl = updates.avatarUrl;
      }
      d.lastModified = Date.now();
    });
  };

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={currentUserDid}
      appTitle="Narrative"
      workspaceName={doc?.context?.name || 'Workspace'}
      hideWorkspaceSwitcher={false}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={handleUpdateIdentityInDoc}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
      onToggleDebugDashboard={onToggleDebugDashboard}
      workspaceLoading={workspaceLoading}
      contentState={contentState}
      onJoinWorkspace={onJoinWorkspace}
      onCancelLoading={onCancelLoading}
      identity={{ did: currentUserDid, displayName }}
      onGoToStart={onGoToStart}
      onSwitchWorkspace={onSwitchWorkspace}
      onImportIdentity={onImportIdentity}
    >
      {(ctx: AppContextValue) => (
        <>
          {/* Module Content */}
          {activeModule === 'map' ? (
            // Map module: fullscreen flex layout with ModuleSwitcher overlay
            <div className="flex-1 min-h-0 relative overflow-hidden pb-14 md:pb-0">
              {/* ModuleSwitcher as overlay on map - hidden on mobile */}
              {doc && (
                <div className="hidden md:flex absolute top-4 left-1/2 -translate-x-1/2 z-500">
                  <ModuleSwitcher
                    modules={AVAILABLE_MODULES}
                    enabledModules={doc.enabledModules || { narrative: true }}
                    activeModule={activeModule}
                    onModuleChange={setActiveModule}
                  />
                </div>
              )}
              {doc && docHandle && (
                <MapModuleWrapper
                  doc={doc}
                  docHandle={docHandle}
                  identity={{ did: currentUserDid }}
                  hiddenUserDids={ctx.hiddenUserDids}
                />
              )}
            </div>
          ) : (
            // Other modules: scrollable container with ModuleSwitcher at top
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {/* ModuleSwitcher centered at top - hidden on mobile */}
              {doc && (
                <div className="hidden md:flex justify-center py-4 sticky top-0 z-10 bg-base-200">
                  <ModuleSwitcher
                    modules={AVAILABLE_MODULES}
                    enabledModules={doc.enabledModules || { narrative: true }}
                    activeModule={activeModule}
                    onModuleChange={setActiveModule}
                  />
                </div>
              )}
              <div className="container mx-auto px-4 md:px-10 pt-6 md:pt-8 pb-24 md:pb-8 max-w-6xl w-full">
                {activeModule === 'narrative' && doc?.data.narrative && docHandle && (
                  <NarrativeModuleWrapper
                    doc={doc}
                    docHandle={docHandle}
                    identity={{ did: currentUserDid, publicKey, displayName }}
                    privateKey={privateKey}
                    hiddenUserDids={ctx.hiddenUserDids}
                  />
                )}

                {activeModule === 'market' && doc && docHandle && (
                  <MarketModuleWrapper
                    doc={doc}
                    docHandle={docHandle}
                    identity={{ did: currentUserDid }}
                    hiddenUserDids={ctx.hiddenUserDids}
                  />
                )}
              </div>
            </div>
          )}

          {/* Bottom Navigation for mobile - only shown when doc is loaded */}
          {doc && (
            <BottomNav
              modules={AVAILABLE_MODULES}
              enabledModules={doc.enabledModules || { narrative: true }}
              activeModule={activeModule}
              onModuleChange={setActiveModule}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
