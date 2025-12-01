import { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { useOpinionGraph, type OpinionGraphDoc } from 'narri-ui';
import { AssumptionList } from './AssumptionList';
import { CreateAssumptionModal } from './CreateAssumptionModal';
import { useEffect, useMemo, useState } from 'react';
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
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
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

  useEffect(() => {
    const name =
      narri?.doc.identities?.[currentUserDid]?.displayName ??
      narri?.doc.identity.displayName ??
      '';
    setNameInput(name);
  }, [narri?.doc.identities, narri?.doc.identity.displayName, currentUserDid]);

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

  const handleSaveName = () => {
    const next = nameInput.trim();
    if (!next) return;
    narri.updateIdentity({ displayName: next });
    const storedIdentity = localStorage.getItem('narriIdentity');
    if (storedIdentity) {
      const parsed = JSON.parse(storedIdentity);
      parsed.displayName = next;
      localStorage.setItem('narriIdentity', JSON.stringify(parsed));
    }
    setShowIdentityModal(false);
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
            className="btn btn-outline btn-sm"
            onClick={onNewBoard}
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
                d="M12 6v12m6-6H6"
              />
            </svg>
            New Board
          </button>
          <button
            className="btn btn-ghost btn-circle avatar"
            onClick={() => setShowIdentityModal(true)}
            title="Identity"
          >
            <div className="w-12 rounded-full overflow-hidden">
              <Avatar
                size={48}
                name={hashString(currentUserDid)}
                variant="marble"
                colors={["#fdbf5c", "#f69a0b", "#d43a00", "#9b0800", "#1d2440"]}
              />
            </div>
          </button>
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
          getVotesForAssumption={narri.getVotesForAssumption}
          onVote={narri.setVote}
          tags={narri.tags}
          currentUserId={narri.currentUserDid}
        />
      </div>

      {/* Floating New Assumption Button */}
      <button
        className="btn btn-primary gap-2 fixed bottom-6 right-6 shadow-lg shadow-primary/30"
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

      {/* Identity Modal */}
      {showIdentityModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden">
                <Avatar
                  size={56}
                  name={hashString(currentUserDid)}
                  variant="marble"
                  colors={["#fdbf5c", "#f69a0b", "#d43a00", "#9b0800", "#1d2440"]}
                />
              </div>
              <div>
                <div className="text-sm text-base-content/70">Deine DID</div>
                <code className="text-xs break-all">{currentUserDid}</code>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Anzeigename</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Dein Name"
              />
              <label className="label">
              <span className="label-text-alt text-base-content/60">
                Wird lokal gespeichert und mit deinem DID geteilt.
              </span>
              </label>
              <button className="btn btn-primary btn-sm w-fit mt-2" onClick={handleSaveName}>
                Speichern
              </button>
            </div>

            <div className="divider">Identity</div>
            <div className="flex flex-col gap-2">
              <button className="btn btn-outline btn-sm" onClick={handleExportIdentity}>
                Export Identity
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleImportIdentity}>
                Import Identity
              </button>
              <button className="btn btn-error btn-sm" onClick={onResetId}>
                Reset ID
              </button>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setShowIdentityModal(false)}>
                Schließen
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowIdentityModal(false)}></div>
        </div>
      )}

      {/* Create Assumption Modal */}
      <CreateAssumptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={narri.createAssumption}
        availableTags={narri.tags}
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
