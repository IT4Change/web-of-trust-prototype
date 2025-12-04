/**
 * WorkspaceSwitcher - Dropdown for switching between workspaces
 */

export interface WorkspaceInfo {
  id: string; // DocumentId as string
  name: string;
  avatar?: string;
  lastAccessed: number;
}

interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  logoUrl: string;
  onSwitchWorkspace: (workspaceId: string) => void;
  onNewWorkspace: () => void;
}

export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  logoUrl,
  onSwitchWorkspace,
  onNewWorkspace,
}: WorkspaceSwitcherProps) {
  const displayName = currentWorkspace?.name || 'Workspace';

  return (
    <div className="dropdown">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost text-xl flex items-center gap-2"
      >
        {currentWorkspace?.avatar ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden">
            <img
              src={currentWorkspace.avatar}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <img src={logoUrl} alt="Narrative" className="h-12 pb-2 text-current" />
        )}
        <span className="hidden sm:inline max-w-[150px] truncate">{displayName}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 opacity-70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-100 rounded-box z-[1000] mt-2 w-64 p-2 shadow-lg"
      >
        {/* Current workspace indicator */}
        {currentWorkspace && (
          <>
            <li className="menu-title text-xs opacity-50 px-2 pt-1">
              Aktueller Workspace
            </li>
            <li>
              <a className="flex items-center gap-3 bg-base-200">
                {currentWorkspace.avatar ? (
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={currentWorkspace.avatar}
                      alt={currentWorkspace.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">
                      {currentWorkspace.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="truncate font-medium">{currentWorkspace.name}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 ml-auto text-primary"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </li>
          </>
        )}

        {/* Other workspaces */}
        {workspaces.filter((w) => w.id !== currentWorkspace?.id).length > 0 && (
          <>
            <li className="menu-title text-xs opacity-50 px-2 pt-3">
              Andere Workspaces
            </li>
            {workspaces
              .filter((w) => w.id !== currentWorkspace?.id)
              .sort((a, b) => b.lastAccessed - a.lastAccessed)
              .map((workspace) => (
                <li key={workspace.id}>
                  <a
                    className="flex items-center gap-3"
                    onClick={() => onSwitchWorkspace(workspace.id)}
                  >
                    {workspace.avatar ? (
                      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={workspace.avatar}
                          alt={workspace.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-base-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">
                          {workspace.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="truncate">{workspace.name}</span>
                  </a>
                </li>
              ))}
          </>
        )}

        <div className="divider my-1"></div>

        {/* New workspace */}
        <li>
          <a
            className="flex items-center gap-3 text-primary"
            onClick={onNewWorkspace}
          >
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
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
            </div>
            <span>Neuer Workspace</span>
          </a>
        </li>
      </ul>
    </div>
  );
}

/**
 * Load workspace list from localStorage
 */
export function loadWorkspaceList(): WorkspaceInfo[] {
  try {
    const stored = localStorage.getItem('unifiedWorkspaces');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load workspace list:', e);
  }
  return [];
}

/**
 * Save workspace list to localStorage
 */
export function saveWorkspaceList(workspaces: WorkspaceInfo[]): void {
  try {
    localStorage.setItem('unifiedWorkspaces', JSON.stringify(workspaces));
  } catch (e) {
    console.error('Failed to save workspace list:', e);
  }
}

/**
 * Add or update workspace in the list
 */
export function upsertWorkspace(
  workspaces: WorkspaceInfo[],
  workspace: WorkspaceInfo
): WorkspaceInfo[] {
  const existingIndex = workspaces.findIndex((w) => w.id === workspace.id);
  if (existingIndex >= 0) {
    // Update existing
    const updated = [...workspaces];
    updated[existingIndex] = workspace;
    return updated;
  } else {
    // Add new
    return [...workspaces, workspace];
  }
}
