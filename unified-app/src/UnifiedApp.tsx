/**
 * UnifiedApp - Main view component with module switching
 *
 * Follows the standard pattern: receives props from AppShell, uses AppLayout for UI.
 */

import { useState } from 'react';
import type { DocHandle, AutomergeUrl } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { DocumentId } from '@automerge/automerge-repo';
import { AppLayout, type AppContextValue, type UserDocument } from 'narrative-ui';
import { UnifiedDocument, AVAILABLE_MODULES, ModuleId } from './types';
import { ModuleSwitcher } from './components/ModuleSwitcher';
import { NarrativeModuleWrapper } from './components/NarrativeModuleWrapper';
import { MarketModuleWrapper } from './components/MarketModuleWrapper';
import { MapModuleWrapper } from './components/MapModuleWrapper';

interface UnifiedAppProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
  // Debug Dashboard toggle (from AppShell)
  onToggleDebugDashboard: () => void;
}

/**
 * Main Unified Application View
 */
export function UnifiedApp({
  documentId,
  currentUserDid,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
  onToggleDebugDashboard,
}: UnifiedAppProps) {
  // In automerge-repo v2.x, use useDocHandle hook instead of repo.find()
  const docHandle = useDocHandle<UnifiedDocument>(documentId);

  // Load documents reactively
  const [doc] = useDocument<UnifiedDocument>(documentId);
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // App-specific UI state
  const [activeModule, setActiveModule] = useState<ModuleId>('narrative');

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  // Module Switcher component for navbar
  const moduleSwitcher = doc ? (
    <ModuleSwitcher
      modules={AVAILABLE_MODULES}
      enabledModules={doc.enabledModules || { narrative: true }}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    />
  ) : null;

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
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Narrative"
      workspaceName={doc?.context?.name || 'Workspace'}
      hideWorkspaceSwitcher={false}
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={handleUpdateIdentityInDoc}
      navbarChildren={moduleSwitcher}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
      onToggleDebugDashboard={onToggleDebugDashboard}
    >
      {(ctx: AppContextValue) => (
        <>
          {/* Module Content */}
          {activeModule === 'map' ? (
            // Map module: fullscreen flex layout with min-h-0 for proper flex shrinking
            <div className="flex-1 min-h-0 relative overflow-hidden">
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
            // Other modules: scrollable container with padding
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="container mx-auto p-10 pt-8 pb-24 max-w-6xl w-full">
                {activeModule === 'narrative' && doc?.data.narrative && docHandle && (
                  <NarrativeModuleWrapper
                    doc={doc}
                    docHandle={docHandle}
                    identity={{ did: currentUserDid }}
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
        </>
      )}
    </AppLayout>
  );
}
