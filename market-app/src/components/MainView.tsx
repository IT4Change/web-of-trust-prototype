import { useState } from 'react';
import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument, type WorkspaceLoadingState, type ContentState } from 'narrative-ui';
import { useMarket } from '../hooks/useMarket';
import type { ListingType, CategoryId } from '../schema';
import { CATEGORIES } from '../schema';
import { ListingCard } from './ListingCard';
import { CreateListingModal } from './CreateListingModal';
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

type FilterType = 'all' | 'offer' | 'need';
type FilterStatus = 'active' | 'all';

export function MainView({
  documentId,
  currentUserDid,
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
}: MainViewProps) {
  // Load UserDocument for trust/verification features
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // Hook now handles docHandle internally using useDocHandle
  const {
    doc,
    docHandle,
    isLoading,
    listings,
    createListing,
    setListingStatus,
    addReaction,
    removeReaction,
    getReactionCount,
    hasUserReacted,
    getReactionsForListing,
    updateIdentity,
  } = useMarket(documentId);

  // App-specific UI state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryId | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

  // Debug state is automatically updated via useAppContext in AppLayout

  const handleCreateListing = (data: {
    type: ListingType;
    title: string;
    description: string;
    categoryId: CategoryId;
    location?: string;
  }) => {
    createListing(data, currentUserDid);
  };

  const handleReact = (listingId: string) => {
    addReaction(listingId, currentUserDid);
  };

  const handleRemoveReaction = (listingId: string) => {
    const reactions = getReactionsForListing(listingId);
    const myReaction = reactions.find(r => r.reactorDid === currentUserDid);
    if (myReaction) {
      removeReaction(myReaction.id, listingId);
    }
  };

  // Only show loading spinner when actually loading a document (not in start state)
  if (isLoading && contentState === 'ready') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={currentUserDid}
      appTitle="Marktplatz"
      workspaceName="Marktplatz"
      hideWorkspaceSwitcher={true}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={(updates) => updateIdentity(currentUserDid, updates)}
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
        // Filtered listings
        const filteredListings = listings.filter((listing) => {
          if (filterType !== 'all' && listing.type !== filterType) return false;
          if (filterCategory !== 'all' && listing.categoryId !== filterCategory) return false;
          if (filterStatus === 'active' && listing.status !== 'active') return false;
          if (ctx.hiddenUserDids.has(listing.createdBy)) return false;
          return true;
        });

        // Counts
        const offerCount = listings.filter(l => l.type === 'offer' && l.status === 'active').length;
        const needCount = listings.filter(l => l.type === 'need' && l.status === 'active').length;

        return (
          <>
            {/* Main Content - app-specific */}
            <div className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-4 max-w-3xl">
                {/* Stats */}
                <div className="stats shadow mb-4 w-full">
                  <div className="stat">
                    <div className="stat-title">Angebote</div>
                    <div className="stat-value text-success">{offerCount}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Gesuche</div>
                    <div className="stat-value text-warning">{needCount}</div>
                  </div>
                </div>

                {/* Filters */}
                <div className="card bg-base-100 shadow mb-4">
                  <div className="card-body p-4">
                    <div className="flex flex-wrap gap-4">
                      <div className="join">
                        <button
                          className={`join-item btn btn-sm ${filterType === 'all' ? 'btn-active' : ''}`}
                          onClick={() => setFilterType('all')}
                        >
                          Alle
                        </button>
                        <button
                          className={`join-item btn btn-sm ${filterType === 'offer' ? 'btn-success' : ''}`}
                          onClick={() => setFilterType('offer')}
                        >
                          Angebote
                        </button>
                        <button
                          className={`join-item btn btn-sm ${filterType === 'need' ? 'btn-warning' : ''}`}
                          onClick={() => setFilterType('need')}
                        >
                          Gesuche
                        </button>
                      </div>

                      <select
                        className="select select-sm select-bordered"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value as CategoryId | 'all')}
                      >
                        <option value="all">Alle Kategorien</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>

                      <label className="label cursor-pointer gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={filterStatus === 'all'}
                          onChange={(e) => setFilterStatus(e.target.checked ? 'all' : 'active')}
                        />
                        <span className="label-text text-sm">Archivierte zeigen</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <button
                  className="btn btn-primary w-full mb-4"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  + Neues Inserat
                </button>

                {/* Listings */}
                <div className="space-y-3">
                  {filteredListings.length === 0 ? (
                    <div className="card bg-base-100 shadow">
                      <div className="card-body text-center text-base-content/50">
                        <p>Keine Inserate gefunden.</p>
                        <p className="text-sm">Erstelle das erste Inserat!</p>
                      </div>
                    </div>
                  ) : (
                    filteredListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        doc={doc!}
                        currentUserDid={currentUserDid}
                        reactionCount={getReactionCount(listing.id)}
                        hasReacted={hasUserReacted(listing.id, currentUserDid)}
                        onReact={() => handleReact(listing.id)}
                        onRemoveReaction={() => handleRemoveReaction(listing.id)}
                        onStatusChange={(status) => setListingStatus(listing.id, status)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* App-specific Modal */}
            <CreateListingModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onSubmit={handleCreateListing}
            />
          </>
        );
      }}
    </AppLayout>
  );
}
