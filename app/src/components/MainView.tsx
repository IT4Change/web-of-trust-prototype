import { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { useOpinionGraph, type OpinionGraphDoc } from 'narrative-ui';
import { AssumptionList } from './AssumptionList';
import { CreateAssumptionModal } from './CreateAssumptionModal';
import { ProfileModal } from './ProfileModal';
import { ImportModal } from './ImportModal';
import { CollaboratorsModal } from './CollaboratorsModal';
import { useEffect, useMemo, useState } from 'react';
import { exposeDocToConsole } from '../debug';
import { UserAvatar } from './UserAvatar';


interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetId: () => void;
  onNewBoard: () => void;
}

/**
 * Main application view with AppShell layout
 * Shows list of assumptions and allows creating new ones
 */
export function MainView({ documentId, currentUserDid, privateKey, publicKey, displayName, onResetId, onNewBoard }: MainViewProps) {
  const repo = useRepo();
  const docHandle = repo.find<OpinionGraphDoc>(documentId);
  const narrative = useOpinionGraph(documentId, docHandle, currentUserDid, privateKey, publicKey, displayName);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'agree' | 'recent' | 'created'>('created');
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [hiddenUserDids, setHiddenUserDids] = useState<Set<string>>(new Set());
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  useEffect(() => {
    if (narrative?.doc) {
      exposeDocToConsole(narrative.doc);
    }
  }, [narrative?.doc]);

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

  // Wrapper functions that filter by hidden users
  const getFilteredVotesForAssumption = (assumptionId: string) => {
    const votes = narrative?.getVotesForAssumption(assumptionId) || [];
    return votes.filter((vote) => !hiddenUserDids.has(vote.voterDid));
  };

  const getFilteredEditsForAssumption = (assumptionId: string) => {
    const edits = narrative?.getEditsForAssumption(assumptionId) || [];
    return edits.filter((edit) => !hiddenUserDids.has(edit.editorDid));
  };

  const getFilteredVoteSummary = (assumptionId: string) => {
    // Recalculate summary with filtered votes
    const filteredVotes = getFilteredVotesForAssumption(assumptionId);
    const green = filteredVotes.filter((v) => v.value === 'green').length;
    const yellow = filteredVotes.filter((v) => v.value === 'yellow').length;
    const red = filteredVotes.filter((v) => v.value === 'red').length;

    // Find current user's vote
    const userVote = filteredVotes.find((v) => v.voterDid === currentUserDid)?.value;

    return {
      green,
      yellow,
      red,
      total: green + yellow + red,
      userVote,
    };
  };

  const sortedAssumptions = useMemo(() => {
    if (!narrative) return [];

    const getLastVoteTs = (assumptionId: string) => {
      const votes = narrative.doc.votes;
      return (
        narrative.doc.assumptions[assumptionId]?.voteIds
          .map((id) => votes[id])
          .filter((v): v is NonNullable<typeof votes[string]> => Boolean(v))
          .filter((v) => !hiddenUserDids.has(v.voterDid)) // Filter hidden users
          .reduce((latest, vote) => Math.max(latest, vote.updatedAt ?? vote.createdAt), 0) || 0
      );
    };

    // Filter out assumptions from hidden users
    const withoutHidden = narrative.assumptions.filter(
      (a) => !hiddenUserDids.has(a.createdBy)
    );

    const filtered = activeTagFilter
      ? withoutHidden.filter((a) => a.tagIds.includes(activeTagFilter))
      : withoutHidden;

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
  }, [narrative, sortBy, narrative?.doc?.lastModified, activeTagFilter, hiddenUserDids]);

  const handleShareClick = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    });
  };


  const handleExportIdentity = () => {
    const savedIdentity = localStorage.getItem('narrativeIdentity');
    if (!savedIdentity) return;

    const blob = new Blob([savedIdentity], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opinion-graph-identity-${Date.now()}.json`;
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
          const identity = JSON.parse(event.target?.result as string);
          if (identity.did && identity.displayName) {
            localStorage.setItem('narrativeIdentity', JSON.stringify(identity));
            window.location.reload();
          } else {
            alert('Invalid identity file');
          }
        } catch (error) {
          alert('Error reading identity file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


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

  // Wait for document to load
  if (!narrative) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-base-200 flex flex-col overflow-hidden">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg z-20 flex-shrink-0">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl flex items-center gap-2">
            <img src={logoUrl} alt="Narrative" className="h-12 pb-2 text-current" />
            <span>Narrative</span>
          </a>
        </div>
        <div className="flex-none gap-2">
          <div className="flex items-center gap-2">
            <button
              className="w-11 h-11 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setShowIdentityModal(true)}
              title="Profil öffnen"
            >
              <UserAvatar
                did={currentUserDid}
                avatarUrl={narrative?.doc?.identities?.[currentUserDid]?.avatarUrl}
                size={44}
              />
            </button>
            <span className="hidden lg:block font-medium">
              {narrative?.doc?.identities?.[currentUserDid]?.displayName || 'Anonymous'}
            </span>
          </div>
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Profil
                </a>
              </li>
              <li>
                <a onClick={() => setShowFriendsModal(true)}>
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Collaborators
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>



      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Main Content */}
        <div className="container mx-auto p-10 pt-8 pb-24 max-w-6xl w-full">
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap gap-2 mt-3">
                {activeTagFilter ? (
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
                ) : (
                  <p className="text-base-content/60 text-sm">Kein Filter aktiv</p>
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
          />
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
      </div>

            {/* Board Menu FAB */}
            <div className="fixed bottom-6 left-6 z-30">
        <div className="dropdown dropdown-top">
          <div tabIndex={0} role="button" className="btn btn-neutral shadow-lg shadow-black/30">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
            </svg>



          </div>
          <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mb-3 w-52 p-2 shadow-xl">
            <li>
              <a onClick={onNewBoard}>
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
                    d="M12 6v12m6-6H6"
                  />
                </svg>
                New Board
              </a>
            </li>
            <li>
              <a onClick={handleShareClick}>
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
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </a>
            </li>
            <li>
              <a onClick={() => setShowImportModal(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
  <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
</svg>

                Import
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Identity Modal */}
      <ProfileModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        currentUserDid={currentUserDid}
        doc={narrative.doc}
        onUpdateIdentity={narrative.updateIdentity}
        onExportIdentity={handleExportIdentity}
        onImportIdentity={handleImportIdentity}
        onResetId={onResetId}
        initialDisplayName={displayName}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportAssumptions}
      />

      {/* Friends Modal */}
      <CollaboratorsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        doc={narrative.doc}
        currentUserDid={currentUserDid}
        hiddenUserDids={hiddenUserDids}
        onToggleUserVisibility={toggleUserVisibility}
      />

      {/* Create Assumption Modal */}
      <CreateAssumptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={narrative.createAssumption}
        availableTags={narrative.tags}
      />

      {/* Toast for copied URL */}
      {showCopiedToast && (
        <div className="toast toast-end">
          <div className="alert alert-success">
            <span>✓ Link copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
}
