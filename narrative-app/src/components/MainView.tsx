import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocHandle, useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument, type WorkspaceLoadingState, type ContentState } from 'narrative-ui';
import { useOpinionGraph } from '../hooks/useOpinionGraph';
import type { OpinionGraphDoc } from '../schema/opinion-graph';
import { AssumptionList } from './AssumptionList';
import { CreateAssumptionModal } from './CreateAssumptionModal';
import { ImportModal } from './ImportModal';
import { useState } from 'react';
// Debug extensions are auto-initialized via main.tsx import
import '../debug';

interface MainViewProps {
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
}

/**
 * Main application view with AppLayout
 * Shows list of assumptions and allows creating new ones
 */
export function MainView({
  documentId,
  currentUserDid,
  privateKey,
  publicKey,
  displayName,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle: _userDocHandle, // Available for direct mutations if needed
  workspaceLoading,
  onToggleDebugDashboard,
  contentState,
  onJoinWorkspace,
  onCancelLoading,
  onGoToStart,
  onSwitchWorkspace,
}: MainViewProps) {
  // In automerge-repo v2.x, use useDocHandle hook instead of repo.find()
  // Only call hooks when documentId is available
  const docHandle = useDocHandle<OpinionGraphDoc>(documentId ?? undefined);
  const narrative = useOpinionGraph(documentId, docHandle, currentUserDid, privateKey, publicKey, displayName);

  // Load user document reactively
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // App-specific UI state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'agree' | 'recent' | 'created'>('created');
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [webOfTrustFilter, setWebOfTrustFilter] = useState(false);

  // Debug state is automatically updated via useAppContext in AppLayout

  const handleImportAssumptions = async (importText: string) => {
    if (!narrative) return;

    const parsed = JSON.parse(importText || '[]');
    if (!Array.isArray(parsed)) throw new Error('JSON Array erwartet');

    for (const item of parsed) {
      const sentence = typeof item === 'string' ? item : item?.sentence;
      const tags =
        item && Array.isArray(item.tags)
          ? item.tags.filter((t: unknown) => typeof t === 'string')
          : [];

      if (sentence && typeof sentence === 'string') {
        await narrative.createAssumption(sentence, tags);
      }
    }
  };

  // Get userDocHandle from props (passed by AppShell)
  const userDocHandle = _userDocHandle;

  return (
    <AppLayout
      doc={narrative?.doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={currentUserDid}
      appTitle="Narrative"
      workspaceName="Narrative Board"
      hideWorkspaceSwitcher={false}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={narrative?.updateIdentity}
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
    >
      {(ctx: AppContextValue) => {
        // Wrapper functions that filter by hidden users
        const getFilteredVotesForAssumption = (assumptionId: string) => {
          const votes = narrative?.getVotesForAssumption(assumptionId) || [];
          return votes.filter((vote) => !ctx.hiddenUserDids.has(vote.voterDid));
        };

        const getFilteredEditsForAssumption = (assumptionId: string) => {
          const edits = narrative?.getEditsForAssumption(assumptionId) || [];
          return edits.filter((edit) => !ctx.hiddenUserDids.has(edit.editorDid));
        };

        const getFilteredVoteSummary = (assumptionId: string) => {
          const filteredVotes = getFilteredVotesForAssumption(assumptionId);
          const green = filteredVotes.filter((v) => v.value === 'green').length;
          const yellow = filteredVotes.filter((v) => v.value === 'yellow').length;
          const red = filteredVotes.filter((v) => v.value === 'red').length;
          const userVote = filteredVotes.find((v) => v.voterDid === currentUserDid)?.value;

          return {
            green,
            yellow,
            red,
            total: green + yellow + red,
            userVote,
          };
        };

        const sortedAssumptions = (() => {
          if (!narrative) return [];

          const getLastVoteTs = (assumptionId: string) => {
            const votes = narrative.doc.data.votes;
            return (
              narrative.doc.data.assumptions[assumptionId]?.voteIds
                .map((id) => votes[id])
                .filter((v): v is NonNullable<typeof votes[string]> => Boolean(v))
                .filter((v) => !ctx.hiddenUserDids.has(v.voterDid))
                .reduce((latest, vote) => Math.max(latest, vote.updatedAt ?? vote.createdAt), 0) || 0
            );
          };

          // Filter out assumptions from hidden users
          const withoutHidden = narrative.assumptions.filter(
            (a) => !ctx.hiddenUserDids.has(a.createdBy)
          );

          // Apply Web of Trust filter if active
          // Uses UserDocument trustGiven to filter by trusted users
          const withTrustFilter = webOfTrustFilter
            ? withoutHidden.filter((a) => {
                // Always show own assumptions
                if (a.createdBy === currentUserDid) return true;
                // Check if we trust this user (via UserDocument)
                if (!userDoc?.trustGiven) return false;
                return Object.values(userDoc.trustGiven).some(
                  (att) => att.trusteeDid === a.createdBy
                );
              })
            : withoutHidden;

          const filtered = activeTagFilter
            ? withTrustFilter.filter((a) => a.tagIds.includes(activeTagFilter))
            : withTrustFilter;

          return [...filtered].sort((a, b) => {
            const summaryA = getFilteredVoteSummary(a.id);
            const summaryB = getFilteredVoteSummary(b.id);

            const totalA = summaryA.total;
            const totalB = summaryB.total;
            const agreeRateA = totalA ? summaryA.green / totalA : 0;
            const agreeRateB = totalB ? summaryB.green / totalB : 0;
            const lastVoteA = getLastVoteTs(a.id);
            const lastVoteB = getLastVoteTs(b.id);

            if (sortBy === 'votes') {
              return totalB - totalA || agreeRateB - agreeRateA || lastVoteB - lastVoteA || b.createdAt - a.createdAt;
            }
            if (sortBy === 'agree') {
              return agreeRateB - agreeRateA || totalB - totalA || lastVoteB - lastVoteA || b.createdAt - a.createdAt;
            }
            if (sortBy === 'created') {
              return b.createdAt - a.createdAt || lastVoteB - lastVoteA || totalB - totalA;
            }
            // recent
            return lastVoteB - lastVoteA || totalB - totalA || agreeRateB - agreeRateA || b.createdAt - a.createdAt;
          });
        })();

        return (
          <>
            {/* Scrollable Content Area - app-specific */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
              <div className="container mx-auto p-10 pt-8 pb-24 max-w-6xl w-full">
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex flex-wrap gap-2 mt-3">
                      {/* Web of Trust Filter */}
                      <button
                        className={`badge gap-1 p-4 cursor-pointer transition-all ${
                          webOfTrustFilter
                            ? 'badge-success'
                            : 'badge-ghost border-base-300 hover:border-success'
                        }`}
                        onClick={() => setWebOfTrustFilter(!webOfTrustFilter)}
                        title={webOfTrustFilter ? 'Nur Web of Trust' : 'Alle Assumptions'}
                      >
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
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>{webOfTrustFilter ? 'Web of Trust' : 'Alle'}</span>
                      </button>

                      {/* Tag Filter */}
                      {activeTagFilter && narrative && (
                        <div className="badge badge-primary gap-1 p-4 pr-1">
                          <span>{narrative.tags.find((t) => t.id === activeTagFilter)?.name ?? 'Tag'}</span>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setActiveTagFilter(null)}
                            aria-label="Filter entfernen"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="form-control w-full md:w-64">
                        <div className="label py-0">
                          <span className="label-text">Sortieren nach</span>
                        </div>
                        <select
                          className="select select-bordered select-sm"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        >
                          <option value="recent">Neuster Vote</option>
                          <option value="votes">Anzahl Votes</option>
                          <option value="agree">Zustimmung</option>
                          <option value="created">Neueste Annahme</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                {narrative && (
                  <AssumptionList
                    assumptions={sortedAssumptions}
                    getVoteSummary={getFilteredVoteSummary}
                    getVotesForAssumption={getFilteredVotesForAssumption}
                    getEditsForAssumption={getFilteredEditsForAssumption}
                    onVote={narrative.setVote}
                    onEdit={narrative.updateAssumption}
                    tags={narrative.tags}
                    onTagClick={(tagId) => setActiveTagFilter((prev) => (prev === tagId ? null : tagId))}
                    currentUserId={narrative.currentUserDid}
                    doc={narrative.doc}
                    onCreate={() => setIsCreateModalOpen(true)}
                  />
                )}
              </div>

              {/* Floating New Assumption Button */}
              <button
                className="btn btn-primary gap-2 fixed bottom-6 right-6 shadow-lg shadow-black/30"
                onClick={() => setIsCreateModalOpen(true)}
                title="New Assumption"
              >
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>New Assumption</span>
              </button>

              {/* Import Button */}
              <button
                className="btn btn-neutral gap-2 fixed bottom-6 left-6 shadow-lg shadow-black/30"
                onClick={() => setShowImportModal(true)}
                title="Import"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                Import
              </button>
            </div>

            {/* App-specific Modals */}
            <ImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImport={handleImportAssumptions}
            />

            {narrative && (
              <CreateAssumptionModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={narrative.createAssumption}
                availableTags={narrative.tags}
              />
            )}
          </>
        );
      }}
    </AppLayout>
  );
}
