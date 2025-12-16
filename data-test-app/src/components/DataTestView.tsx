import { useState } from 'react';
import {
  useItems,
  useItemMutations,
  useRelations,
  useRelationMutations,
  useIdentity,
  useTrust,
  useWorkspace,
  useSyncStatus,
  type Item,
} from 'narrative-ui';

/**
 * Test-View für die Data Layer Abstraction
 *
 * Demonstriert alle Hooks und deren Funktionalität.
 */
export function DataTestView() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="text-xl font-bold px-4">Data Layer Test</span>
        </div>
        <SyncStatusBadge />
      </div>

      <div className="container mx-auto p-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Identity Section */}
          <IdentityCard />

          {/* Workspace Section */}
          <WorkspaceCard />

          {/* Trust Section */}
          <TrustCard />

          {/* Items Section */}
          <ItemsCard />

          {/* Relations Section */}
          <RelationsCard />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sync Status Badge
// =============================================================================

function SyncStatusBadge() {
  const { syncStatus, capabilities } = useSyncStatus();

  const statusColors: Record<string, string> = {
    synced: 'badge-success',
    syncing: 'badge-warning',
    offline: 'badge-error',
    error: 'badge-error',
  };

  return (
    <div className="flex items-center gap-2 px-4">
      <span className={`badge ${statusColors[syncStatus]}`}>{syncStatus}</span>
      <div className="text-xs opacity-70">
        {capabilities.offline && <span className="mr-2">📴 Offline</span>}
        {capabilities.realtime && <span className="mr-2">⚡ Realtime</span>}
      </div>
    </div>
  );
}

// =============================================================================
// Identity Card
// =============================================================================

function IdentityCard() {
  const { identity, isAuthenticated, signUp, signOut, updateProfile, capabilities } =
    useIdentity();
  const [newName, setNewName] = useState('');

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          🔐 Identity
          <span className={`badge ${isAuthenticated ? 'badge-success' : 'badge-error'}`}>
            {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
          </span>
        </h2>

        {identity ? (
          <div className="space-y-2">
            <p>
              <strong>ID:</strong>{' '}
              <code className="bg-base-200 px-1 rounded text-xs">{identity.id}</code>
            </p>
            <p>
              <strong>Display Name:</strong> {identity.displayName}
            </p>
            {identity.avatarUrl && (
              <p>
                <strong>Avatar:</strong>{' '}
                <img src={identity.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full inline" />
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <input
                type="text"
                placeholder="New display name"
                className="input input-bordered input-sm flex-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  if (newName.trim()) {
                    updateProfile({ displayName: newName.trim() });
                    setNewName('');
                  }
                }}
              >
                Update
              </button>
            </div>

            <button className="btn btn-sm btn-error mt-2" onClick={signOut}>
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm opacity-70">No identity. Sign up to create one.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Display name (optional)"
                className="input input-bordered input-sm flex-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => signUp({ displayName: newName || undefined })}
              >
                Sign Up
              </button>
            </div>
          </div>
        )}

        <div className="text-xs opacity-50 mt-4">
          <strong>Capabilities:</strong>{' '}
          {capabilities.signInMethods.join(', ')}
          {capabilities.canExportKeyFile && ' | Export Key'}
          {capabilities.canExportMnemonic && ' | Export Mnemonic'}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Workspace Card
// =============================================================================

function WorkspaceCard() {
  const { workspace, isLoaded, updateMetadata, setEnabledModules } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [newModule, setNewModule] = useState('');

  if (!isLoaded || !workspace) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">📁 Workspace</h2>
          <span className="loading loading-spinner"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">📁 Workspace</h2>

        <p>
          <strong>Name:</strong> {workspace.name}
        </p>
        <p>
          <strong>ID:</strong>{' '}
          <code className="bg-base-200 px-1 rounded text-xs">{workspace.id}</code>
        </p>
        <p>
          <strong>Members:</strong> {Object.keys(workspace.members).length}
        </p>
        <p>
          <strong>Enabled Modules:</strong>{' '}
          {workspace.enabledModules.length > 0
            ? workspace.enabledModules.join(', ')
            : 'None'}
        </p>

        <div className="flex gap-2 mt-4">
          <input
            type="text"
            placeholder="New workspace name"
            className="input input-bordered input-sm flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (newName.trim()) {
                updateMetadata({ name: newName.trim() });
                setNewName('');
              }
            }}
          >
            Rename
          </button>
        </div>

        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="Module name"
            className="input input-bordered input-sm flex-1"
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
          />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              if (newModule.trim()) {
                setEnabledModules([...workspace.enabledModules, newModule.trim()]);
                setNewModule('');
              }
            }}
          >
            Add Module
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Trust Card
// =============================================================================

function TrustCard() {
  const { trustGiven, trustReceived, setTrust, revokeTrust } = useTrust();
  const [trusteeId, setTrusteeId] = useState('');

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">🤝 Trust</h2>

        <div className="stats stats-vertical shadow">
          <div className="stat">
            <div className="stat-title">Trust Given</div>
            <div className="stat-value text-primary">{trustGiven.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Trust Received</div>
            <div className="stat-value text-secondary">{trustReceived.length}</div>
          </div>
        </div>

        {trustGiven.length > 0 && (
          <div className="mt-2">
            <strong className="text-sm">Trusted:</strong>
            <ul className="text-sm">
              {trustGiven.map((t) => (
                <li key={t.id} className="flex justify-between items-center">
                  <span>
                    {t.trusteeId.slice(0, 12)}... ({t.level})
                  </span>
                  <button
                    className="btn btn-xs btn-ghost text-error"
                    onClick={() => revokeTrust(t.trusteeId)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <input
            type="text"
            placeholder="User ID to trust"
            className="input input-bordered input-sm flex-1"
            value={trusteeId}
            onChange={(e) => setTrusteeId(e.target.value)}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (trusteeId.trim()) {
                setTrust(trusteeId.trim(), 'full');
                setTrusteeId('');
              }
            }}
          >
            Trust
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Items Card
// =============================================================================

function ItemsCard() {
  const { items, isLoading } = useItems();
  const { create, remove, isPending } = useItemMutations();
  const { identity } = useIdentity();
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('note');

  const handleCreate = async () => {
    if (!newTitle.trim() || !identity) return;

    await create({
      type: newType,
      title: newTitle.trim(),
      createdBy: identity.id,
      sharing: { visibility: 'private', sharedWith: [] },
      extensions: {},
    });
    setNewTitle('');
  };

  return (
    <div className="card bg-base-100 shadow-xl lg:col-span-2">
      <div className="card-body">
        <h2 className="card-title">
          📝 Items
          <span className="badge badge-neutral">{items.length}</span>
          {(isLoading || isPending) && <span className="loading loading-spinner loading-sm"></span>}
        </h2>

        <div className="flex gap-2 mb-4">
          <select
            className="select select-bordered select-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            <option value="note">Note</option>
            <option value="task">Task</option>
            <option value="assumption">Assumption</option>
            <option value="event">Event</option>
          </select>
          <input
            type="text"
            placeholder="Item title"
            className="input input-bordered input-sm flex-1"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={handleCreate}
            disabled={!newTitle.trim() || !identity}
          >
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm opacity-70">No items yet. Create one above!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} onDelete={() => remove(item.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, onDelete }: { item: Item; onDelete: () => void }) {
  const typeColors: Record<string, string> = {
    note: 'badge-info',
    task: 'badge-warning',
    assumption: 'badge-primary',
    event: 'badge-secondary',
  };

  return (
    <tr>
      <td>
        <span className={`badge badge-sm ${typeColors[item.type] || 'badge-ghost'}`}>
          {item.type}
        </span>
      </td>
      <td>{item.title || <span className="opacity-50">Untitled</span>}</td>
      <td className="text-xs opacity-70">
        {new Date(item.createdAt).toLocaleTimeString()}
      </td>
      <td>
        <button className="btn btn-xs btn-ghost text-error" onClick={onDelete}>
          Delete
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// Relations Card
// =============================================================================

function RelationsCard() {
  const { relations, isLoading } = useRelations();
  const { create, remove, isPending } = useRelationMutations();
  const { items } = useItems();
  const { identity } = useIdentity();

  const [subject, setSubject] = useState('');
  const [predicate, setPredicate] = useState('relates_to');
  const [object, setObject] = useState('');

  const handleCreate = async () => {
    if (!subject || !object || !identity) return;

    await create({
      subject,
      predicate,
      object,
      createdBy: identity.id,
    });
    setSubject('');
    setObject('');
  };

  return (
    <div className="card bg-base-100 shadow-xl lg:col-span-2">
      <div className="card-body">
        <h2 className="card-title">
          🔗 Relations
          <span className="badge badge-neutral">{relations.length}</span>
          {(isLoading || isPending) && <span className="loading loading-spinner loading-sm"></span>}
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <select
            className="select select-bordered select-sm flex-1 min-w-32"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">Select Subject</option>
            {identity && <option value={identity.id}>Me ({identity.displayName})</option>}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.id.slice(0, 12)}
              </option>
            ))}
          </select>

          <select
            className="select select-bordered select-sm"
            value={predicate}
            onChange={(e) => setPredicate(e.target.value)}
          >
            <option value="relates_to">relates_to</option>
            <option value="parent_of">parent_of</option>
            <option value="votes_on">votes_on</option>
            <option value="assigned_to">assigned_to</option>
            <option value="likes">likes</option>
          </select>

          <select
            className="select select-bordered select-sm flex-1 min-w-32"
            value={object}
            onChange={(e) => setObject(e.target.value)}
          >
            <option value="">Select Object</option>
            {identity && <option value={identity.id}>Me ({identity.displayName})</option>}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.id.slice(0, 12)}
              </option>
            ))}
          </select>

          <button
            className="btn btn-sm btn-primary"
            onClick={handleCreate}
            disabled={!subject || !object || !identity}
          >
            Add Relation
          </button>
        </div>

        {relations.length === 0 ? (
          <p className="text-sm opacity-70">No relations yet. Create items first, then link them!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Predicate</th>
                  <th>Object</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relations.map((rel) => (
                  <tr key={rel.id}>
                    <td className="text-xs">{rel.subject.slice(0, 12)}...</td>
                    <td>
                      <span className="badge badge-sm badge-outline">{rel.predicate}</span>
                    </td>
                    <td className="text-xs">{rel.object.slice(0, 12)}...</td>
                    <td>
                      <button
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => remove(rel.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
