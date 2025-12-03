import { UserAvatar } from './UserAvatar';
import type { OpinionGraphDoc } from 'narrative-ui';

interface CollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: OpinionGraphDoc;
  currentUserDid: string;
  hiddenUserDids: Set<string>;
  onToggleUserVisibility: (did: string) => void;
}

export function CollaboratorsModal({
  isOpen,
  onClose,
  doc,
  currentUserDid,
  hiddenUserDids,
  onToggleUserVisibility,
}: CollaboratorsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Collaborators in diesem Board</h3>
        <p className="text-sm text-base-content/60 mb-4">
          Deaktiviere die Checkbox, um alle Beiträge (Assumptions, Votes, Edits) eines Users auszublenden.
        </p>
        <div className="space-y-2">
          {Object.entries(doc.identities).map(([did, profile]) => (
            <div
              key={did}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                did === currentUserDid ? 'border-primary bg-primary/5' : 'border-base-300'
              } ${hiddenUserDids.has(did) ? 'opacity-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <UserAvatar
                  did={did}
                  avatarUrl={profile.avatarUrl}
                  size={48}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">
                    {profile.displayName || 'Anonymous'}
                  </div>
                  {did === currentUserDid && (
                    <span className="badge badge-primary badge-sm">Du</span>
                  )}
                </div>
                <code className="text-xs text-base-content/60 break-all">{did}</code>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer gap-2">
                  <span className="label-text">Anzeigen</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={!hiddenUserDids.has(did)}
                    onChange={() => onToggleUserVisibility(did)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(doc.identities).length === 0 && (
          <div className="text-center py-8 text-base-content/60">
            Noch keine Collaborators in diesem Board
          </div>
        )}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
