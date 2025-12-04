import { useState, useMemo, useEffect } from 'react';
import type { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import {
  UserAvatar,
  ProfileModal,
  CollaboratorsModal,
  addTrustAttestation,
} from 'narrative-ui';
import { useMarket } from '../hooks/useMarket';
import type { ListingType, CategoryId, MarketAppDoc } from '../schema';
import { CATEGORIES } from '../schema';
import { ListingCard } from './ListingCard';
import { CreateListingModal } from './CreateListingModal';
import { exposeDocToConsole } from '../debug';

interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: () => void;
}

type FilterType = 'all' | 'offer' | 'need';
type FilterStatus = 'active' | 'all';

export function MainView({
  documentId,
  currentUserDid,
  displayName,
  onResetIdentity,
  onNewDocument,
}: MainViewProps) {
  const repo = useRepo();
  const docHandle = repo.find<MarketAppDoc>(documentId);

  const {
    doc,
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

  // UI State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());

  // Expose doc to console for debugging
  useEffect(() => {
    exposeDocToConsole(doc ?? null);
  }, [doc]);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryId | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

  // Filtered listings
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      // Type filter
      if (filterType !== 'all' && listing.type !== filterType) return false;

      // Category filter
      if (filterCategory !== 'all' && listing.categoryId !== filterCategory) return false;

      // Status filter
      if (filterStatus === 'active' && listing.status !== 'active') return false;

      // Hidden users filter
      if (hiddenUserDids.has(listing.createdBy)) return false;

      return true;
    });
  }, [listings, filterType, filterCategory, filterStatus, hiddenUserDids]);

  // Counts
  const offerCount = listings.filter(l => l.type === 'offer' && l.status === 'active').length;
  const needCount = listings.filter(l => l.type === 'need' && l.status === 'active').length;

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

  const toggleUserVisibility = (did: string) => {
    setHiddenUserDids((prev) => {
      const next = new Set(prev);
      if (next.has(did)) {
        next.delete(did);
      } else {
        next.add(did);
      }
      return next;
    });
  };

  const handleTrustUser = (trusteeDid: string) => {
    docHandle.change((d) => {
      addTrustAttestation(d, currentUserDid, trusteeDid, 'verified', 'in-person');
      d.lastModified = Date.now();
    });
  };

  const handleUpdateIdentity = (updates: { displayName?: string; avatarUrl?: string }) => {
    updateIdentity(currentUserDid, updates);
  };

  const handleExportIdentity = () => {
    const savedIdentity = localStorage.getItem('narrativeIdentity');
    if (!savedIdentity) return;

    const blob = new Blob([savedIdentity], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-identity-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportIdentity = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const identity = JSON.parse(content);
          if (identity.did) {
            localStorage.setItem('narrativeIdentity', content);
            window.location.reload();
          }
        } catch {
          alert('Invalid identity file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleShareClick = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
  };

  if (isLoading || !doc) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const currentUserName = displayName || doc.identities[currentUserDid]?.displayName || currentUserDid.slice(0, 12) + '...';

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg sticky top-0 z-10">
        <div className="flex-1">
          <span className="text-xl font-bold px-4">🏪 Marktplatz</span>
        </div>
        <div className="flex-none gap-2 pr-2">
          <div className="flex items-center gap-2">
            <UserAvatar
              did={currentUserDid}
              avatarUrl={doc.identities[currentUserDid]?.avatarUrl}
              size={32}
            />
            <span className="text-sm hidden sm:inline">{currentUserName}</span>
          </div>
          {/* User Menu */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-6 w-52 p-2 shadow">
              <li>
                <a onClick={() => setShowIdentityModal(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </a>
              </li>
              <li>
                <a onClick={() => setShowFriendsModal(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Teilnehmer
                </a>
              </li>
              <div className="divider my-1"></div>
              <li>
                <a onClick={onNewDocument}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                  Neuer Marktplatz
                </a>
              </li>
              <li>
                <a onClick={handleShareClick}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Link teilen
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
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
              {/* Type Filter */}
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

              {/* Category Filter */}
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

              {/* Status Filter */}
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
                doc={doc}
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

      {/* Modals */}
      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateListing}
      />

      <ProfileModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        currentUserDid={currentUserDid}
        doc={doc}
        onUpdateIdentity={handleUpdateIdentity}
        onExportIdentity={handleExportIdentity}
        onImportIdentity={handleImportIdentity}
        onResetId={onResetIdentity}
        initialDisplayName={displayName}
      />

      <CollaboratorsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        doc={doc}
        currentUserDid={currentUserDid}
        hiddenUserDids={hiddenUserDids}
        onToggleUserVisibility={toggleUserVisibility}
        onTrustUser={handleTrustUser}
      />
    </div>
  );
}
