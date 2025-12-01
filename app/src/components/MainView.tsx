import { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { useOpinionGraph, type OpinionGraphDoc } from 'narri-ui';
import { AssumptionList } from './AssumptionList';
import { CreateAssumptionModal } from './CreateAssumptionModal';
import { useMemo, useState } from 'react';
import Avatar from 'boring-avatars';

interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  onResetId: () => void;
  onNewBoard: () => void;
}

// Simple hash function to create more distinct avatar seeds
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Main application view with AppShell layout
 * Shows list of assumptions and allows creating new ones
 */
export function MainView({ documentId, currentUserDid, onResetId, onNewBoard }: MainViewProps) {
  const repo = useRepo();
  const docHandle = repo.find<OpinionGraphDoc>(documentId);
  const narri = useOpinionGraph(documentId, docHandle, currentUserDid);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [sortBy, setSortBy] = useState<'votes' | 'agree' | 'recent'>('recent');
  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  const sortedAssumptions = useMemo(() => {
    if (!narri) return [];

    const getLastVoteTs = (assumptionId: string) => {
      const votes = narri.doc.votes;
      return (
        narri.doc.assumptions[assumptionId]?.voteIds
          .map((id) => votes[id])
          .filter((v): v is NonNullable<typeof votes[string]> => Boolean(v))
          .reduce((latest, vote) => Math.max(latest, vote.updatedAt ?? vote.createdAt), 0) || 0
      );
    };

    return [...narri.assumptions].sort((a, b) => {
      const summaryA = narri.getVoteSummary(a.id);
      const summaryB = narri.getVoteSummary(b.id);

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
      // recent
      return lastVoteB - lastVoteA || totalB - totalA || agreeRateB - agreeRateA || b.createdAt - a.createdAt;
    });
  }, [narri, sortBy, narri?.doc?.lastModified]);

  const handleShareClick = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    });
  };

  const handleExportIdentity = () => {
    const savedIdentity = localStorage.getItem('narriIdentity');
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
            localStorage.setItem('narriIdentity', JSON.stringify(identity));
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

  // Wait for document to load
  if (!narri) {
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
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl flex items-center gap-2">
            <img src={logoUrl} alt="Narri" className="h-8 w-8" />
            <span>Narri</span>
          </a>
        </div>
        <div className="flex-none gap-2">
          <button
            className="btn btn-ghost"
            onClick={handleShareClick}
            title="Share this document"
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreateModalOpen(true)}
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
            New Assumption
          </button>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-12 rounded-full overflow-hidden">
                <Avatar
                  size={48}
                  name={hashString(currentUserDid)}
                  variant="marble"
                  colors={["#fdbf5c", "#f69a0b", "#d43a00", "#9b0800", "#1d2440"]}
                />
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li>
                <a className="justify-between flex-col items-start">
                  <div className="flex w-full justify-between items-center">
                    <span>Your Identity</span>
                    <span className="badge badge-sm">DID</span>
                  </div>
                  <code className="text-xs opacity-60 mt-1 break-all">
                    {currentUserDid.substring(0, 30)}...
                  </code>
                </a>
              </li>
              <li>
                <a onClick={handleExportIdentity}>
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export Identity
                </a>
              </li>
              <li>
                <a onClick={handleImportIdentity}>
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Import Identity
                </a>
              </li>
              <li className="menu-title">
                <span>Board & Identity</span>
              </li>
              <li>
                <a onClick={onResetId}>
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
                      d="M12 6v12m6-6H6"
                    />
                  </svg>
                  Reset ID
                </a>
              </li>
              <li>
                <a onClick={onNewBoard} className="text-error">
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  New Board
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content mb-2">
            Assumptions
          </h1>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-base-content opacity-70">
              Vote on single-sentence assumptions and see what others think
            </p>
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
              </select>
            </label>
          </div>
        </div>

        <AssumptionList
          assumptions={sortedAssumptions}
          getVoteSummary={narri.getVoteSummary}
          onVote={narri.setVote}
          tags={narri.tags}
          currentUserId={narri.currentUserDid}
        />
      </div>

      {/* Create Assumption Modal */}
      <CreateAssumptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={narri.createAssumption}
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
