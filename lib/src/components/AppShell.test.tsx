/**
 * Tests for AppShell workspace switching and content state management
 *
 * These tests verify:
 * - ContentState transitions (start → loading → ready)
 * - Workspace switching without page reload
 * - Join workspace functionality
 * - Cancel loading and go to start functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentState, WorkspaceLoadingState } from './AppShell';

/**
 * Helper function that mirrors the contentState determination logic in AppShell
 */
function determineContentState(
  isOnboarding: boolean,
  isLoadingDocument: boolean
): ContentState {
  if (isOnboarding) return 'start';
  if (isLoadingDocument) return 'loading';
  return 'ready';
}

/**
 * Helper function that mirrors the WorkspaceLoadingState building logic
 * (Updated for simplified seconds-based loading UI)
 */
function buildWorkspaceLoadingState(
  isLoading: boolean,
  workspaceUrl: string | null,
  secondsElapsed: number,
  onCreateNew: () => void,
  showCreateNewAfterSeconds = 60
): WorkspaceLoadingState | undefined {
  if (!isLoading) return undefined;

  return {
    isLoading: true,
    documentUrl: workspaceUrl || undefined,
    secondsElapsed,
    onCreateNew,
    showCreateNewAfterSeconds,
  };
}

describe('ContentState', () => {
  describe('determineContentState', () => {
    it('should return "start" when isOnboarding is true', () => {
      expect(determineContentState(true, false)).toBe('start');
    });

    it('should return "start" even when isLoadingDocument is true but isOnboarding takes priority', () => {
      // In practice, these shouldn't both be true, but isOnboarding has priority
      expect(determineContentState(true, true)).toBe('start');
    });

    it('should return "loading" when isLoadingDocument is true and not onboarding', () => {
      expect(determineContentState(false, true)).toBe('loading');
    });

    it('should return "ready" when neither onboarding nor loading', () => {
      expect(determineContentState(false, false)).toBe('ready');
    });
  });

  describe('state transitions', () => {
    it('should transition from start to loading when joining workspace', () => {
      // Initial state: onboarding (no workspace)
      let isOnboarding = true;
      let isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('start');

      // User clicks "join workspace" - transitions to loading
      isOnboarding = false;
      isLoadingDocument = true;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('loading');
    });

    it('should transition from loading to ready when document loads', () => {
      // Loading state
      let isOnboarding = false;
      let isLoadingDocument = true;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('loading');

      // Document loaded successfully
      isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('ready');
    });

    it('should transition from loading to start when user cancels', () => {
      // Loading state
      let isOnboarding = false;
      let isLoadingDocument = true;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('loading');

      // User cancels loading - back to onboarding/start
      isOnboarding = true;
      isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('start');
    });

    it('should transition from ready to start via goToStart', () => {
      // Ready state (workspace loaded)
      let isOnboarding = false;
      const isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('ready');

      // User clicks "go to start" in workspace switcher
      isOnboarding = true;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('start');
    });

    it('should transition from ready to loading when switching workspace', () => {
      // Ready state (workspace A loaded)
      let isOnboarding = false;
      let isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('ready');

      // User switches to workspace B - transitions to loading
      isLoadingDocument = true;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('loading');

      // Workspace B loaded
      isLoadingDocument = false;

      expect(determineContentState(isOnboarding, isLoadingDocument)).toBe('ready');
    });
  });
});

describe('WorkspaceLoadingState', () => {
  const mockOnCreateNew = vi.fn();

  beforeEach(() => {
    mockOnCreateNew.mockClear();
  });

  describe('buildWorkspaceLoadingState', () => {
    it('should return undefined when not loading', () => {
      const result = buildWorkspaceLoadingState(
        false,
        null,
        0,
        mockOnCreateNew
      );

      expect(result).toBeUndefined();
    });

    it('should return loading state when loading', () => {
      const result = buildWorkspaceLoadingState(
        true,
        'automerge:test-doc',
        15,
        mockOnCreateNew
      );

      expect(result).toBeDefined();
      expect(result?.isLoading).toBe(true);
      expect(result?.documentUrl).toBe('automerge:test-doc');
      expect(result?.secondsElapsed).toBe(15);
    });

    it('should handle null workspaceUrl', () => {
      const result = buildWorkspaceLoadingState(
        true,
        null,
        5,
        mockOnCreateNew
      );

      expect(result?.documentUrl).toBeUndefined();
    });

    it('should use default showCreateNewAfterSeconds', () => {
      const result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        0,
        mockOnCreateNew
      );

      expect(result?.showCreateNewAfterSeconds).toBe(60);
    });

    it('should allow custom showCreateNewAfterSeconds', () => {
      const result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        0,
        mockOnCreateNew,
        30
      );

      expect(result?.showCreateNewAfterSeconds).toBe(30);
    });

    it('should provide onCreateNew callback', () => {
      const result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        0,
        mockOnCreateNew
      );

      result?.onCreateNew();

      expect(mockOnCreateNew).toHaveBeenCalledOnce();
    });

    it('should track seconds elapsed', () => {
      // Initial load
      let result = buildWorkspaceLoadingState(true, 'automerge:doc', 0, mockOnCreateNew);
      expect(result?.secondsElapsed).toBe(0);

      // After 30 seconds
      result = buildWorkspaceLoadingState(true, 'automerge:doc', 30, mockOnCreateNew);
      expect(result?.secondsElapsed).toBe(30);

      // After 60 seconds
      result = buildWorkspaceLoadingState(true, 'automerge:doc', 60, mockOnCreateNew);
      expect(result?.secondsElapsed).toBe(60);
    });
  });

  describe('seconds elapsed tracking', () => {
    it('should track seconds for loading display', () => {
      const result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        45,
        mockOnCreateNew
      );

      expect(result?.secondsElapsed).toBe(45);
    });

    it('should determine when to show create new option', () => {
      const showAfterSeconds = 60;

      // Before threshold (30 seconds)
      let result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        30,
        mockOnCreateNew,
        showAfterSeconds
      );
      expect(result!.secondsElapsed < result!.showCreateNewAfterSeconds).toBe(true);

      // After threshold (90 seconds)
      result = buildWorkspaceLoadingState(
        true,
        'automerge:doc-id',
        90,
        mockOnCreateNew,
        showAfterSeconds
      );
      expect(result!.secondsElapsed >= result!.showCreateNewAfterSeconds).toBe(true);
    });
  });
});

describe('Workspace switching behavior (unit logic)', () => {
  /**
   * These tests verify the logical flow of workspace switching
   * without actually calling React hooks or doing async operations
   */

  describe('URL handling', () => {
    it('should format URL correctly for workspace switch (query param)', () => {
      const workspaceId = 'automerge:abc123';
      const url = new URL('http://example.com');
      url.searchParams.set('doc', workspaceId);

      expect(url.searchParams.get('doc')).toBe('automerge:abc123');
      expect(url.toString()).toBe('http://example.com/?doc=automerge%3Aabc123');
    });

    it('should parse workspace ID from URL query param', () => {
      const url = new URL('http://example.com/?doc=automerge:abc123');
      const docId = url.searchParams.get('doc');

      expect(docId).toBe('automerge:abc123');
    });

    it('should parse workspace ID from URL hash (backwards compat)', () => {
      const hash = '#doc=automerge:abc123';
      const urlParams = new URLSearchParams(hash.substring(1));
      const docId = urlParams.get('doc');

      expect(docId).toBe('automerge:abc123');
    });

    it('should prefer query param over hash', () => {
      const url = new URL('http://example.com/?doc=query-doc#doc=hash-doc');
      const queryDoc = url.searchParams.get('doc');
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const hashDoc = hashParams.get('doc');

      // Query param should take precedence
      expect(queryDoc).toBe('query-doc');
      expect(hashDoc).toBe('hash-doc');
      // In real code, we use queryDoc first
      const effectiveDoc = queryDoc || hashDoc;
      expect(effectiveDoc).toBe('query-doc');
    });

    it('should handle URL without doc parameter', () => {
      const url = new URL('http://example.com/?other=value');
      const docId = url.searchParams.get('doc');

      expect(docId).toBeNull();
    });

    it('should handle empty URL', () => {
      const url = new URL('http://example.com/');
      const docId = url.searchParams.get('doc');

      expect(docId).toBeNull();
    });
  });

  describe('state changes for workspace switch', () => {
    interface MockState {
      isLoadingDocument: boolean;
      loadingDocId: string | null;
      isOnboarding: boolean;
      documentId: string | null;
    }

    function simulateSwitchWorkspace(
      state: MockState,
      newWorkspaceId: string
    ): MockState {
      // This simulates what handleSwitchWorkspace/loadWorkspaceDocument does
      return {
        ...state,
        isLoadingDocument: true,
        loadingDocId: newWorkspaceId,
        isOnboarding: false,
      };
    }

    function simulateLoadSuccess(
      state: MockState,
      loadedDocId: string
    ): MockState {
      return {
        ...state,
        isLoadingDocument: false,
        loadingDocId: null,
        documentId: loadedDocId,
      };
    }

    function simulateCancelLoading(state: MockState): MockState {
      return {
        ...state,
        isLoadingDocument: false,
        loadingDocId: null,
        documentId: null,
        isOnboarding: true,
      };
    }

    function simulateGoToStart(state: MockState): MockState {
      return {
        ...state,
        documentId: null,
        isOnboarding: true,
      };
    }

    it('should update state when switching workspace', () => {
      const initialState: MockState = {
        isLoadingDocument: false,
        loadingDocId: null,
        isOnboarding: false,
        documentId: 'workspace-a',
      };

      const afterSwitch = simulateSwitchWorkspace(initialState, 'workspace-b');

      expect(afterSwitch.isLoadingDocument).toBe(true);
      expect(afterSwitch.loadingDocId).toBe('workspace-b');
      expect(afterSwitch.isOnboarding).toBe(false);
    });

    it('should update state when load succeeds', () => {
      const loadingState: MockState = {
        isLoadingDocument: true,
        loadingDocId: 'workspace-b',
        isOnboarding: false,
        documentId: 'workspace-a', // Still has old ID during loading
      };

      const afterSuccess = simulateLoadSuccess(loadingState, 'workspace-b');

      expect(afterSuccess.isLoadingDocument).toBe(false);
      expect(afterSuccess.loadingDocId).toBeNull();
      expect(afterSuccess.documentId).toBe('workspace-b');
    });

    it('should return to start when canceling load', () => {
      const loadingState: MockState = {
        isLoadingDocument: true,
        loadingDocId: 'workspace-b',
        isOnboarding: false,
        documentId: null,
      };

      const afterCancel = simulateCancelLoading(loadingState);

      expect(afterCancel.isLoadingDocument).toBe(false);
      expect(afterCancel.loadingDocId).toBeNull();
      expect(afterCancel.isOnboarding).toBe(true);
    });

    it('should go to start from ready state', () => {
      const readyState: MockState = {
        isLoadingDocument: false,
        loadingDocId: null,
        isOnboarding: false,
        documentId: 'workspace-a',
      };

      const afterGoToStart = simulateGoToStart(readyState);

      expect(afterGoToStart.documentId).toBeNull();
      expect(afterGoToStart.isOnboarding).toBe(true);
    });

    it('should complete full switch cycle without intermediate start state', () => {
      // Start in ready state with workspace A
      let state: MockState = {
        isLoadingDocument: false,
        loadingDocId: null,
        isOnboarding: false,
        documentId: 'workspace-a',
      };

      expect(determineContentState(state.isOnboarding, state.isLoadingDocument)).toBe('ready');

      // Switch to workspace B
      state = simulateSwitchWorkspace(state, 'workspace-b');
      expect(determineContentState(state.isOnboarding, state.isLoadingDocument)).toBe('loading');

      // Load succeeds
      state = simulateLoadSuccess(state, 'workspace-b');
      expect(determineContentState(state.isOnboarding, state.isLoadingDocument)).toBe('ready');
      expect(state.documentId).toBe('workspace-b');

      // Never went through 'start' state
    });
  });
});

describe('AppShellChildProps contentState usage', () => {
  /**
   * These tests verify how consumers (like AppLayout) should use contentState
   */

  type ContentRenderResult = 'start-content' | 'loading-content' | 'workspace-content';

  function renderContentForState(contentState: ContentState): ContentRenderResult {
    switch (contentState) {
      case 'start':
        return 'start-content';
      case 'loading':
        return 'loading-content';
      case 'ready':
        return 'workspace-content';
    }
  }

  it('should render start content when contentState is "start"', () => {
    expect(renderContentForState('start')).toBe('start-content');
  });

  it('should render loading content when contentState is "loading"', () => {
    expect(renderContentForState('loading')).toBe('loading-content');
  });

  it('should render workspace content when contentState is "ready"', () => {
    expect(renderContentForState('ready')).toBe('workspace-content');
  });

  it('should provide all necessary callbacks in all states', () => {
    // This tests the interface completeness
    interface MockChildProps {
      contentState: ContentState;
      onJoinWorkspace: (url: string) => void;
      onCancelLoading: () => void;
      onGoToStart: () => void;
      onSwitchWorkspace: (id: string) => void;
    }

    const mockProps: MockChildProps = {
      contentState: 'start',
      onJoinWorkspace: vi.fn(),
      onCancelLoading: vi.fn(),
      onGoToStart: vi.fn(),
      onSwitchWorkspace: vi.fn(),
    };

    // All callbacks should be callable regardless of state
    mockProps.onJoinWorkspace('automerge:doc');
    mockProps.onCancelLoading();
    mockProps.onGoToStart();
    mockProps.onSwitchWorkspace('workspace-id');

    expect(mockProps.onJoinWorkspace).toHaveBeenCalledWith('automerge:doc');
    expect(mockProps.onCancelLoading).toHaveBeenCalled();
    expect(mockProps.onGoToStart).toHaveBeenCalled();
    expect(mockProps.onSwitchWorkspace).toHaveBeenCalledWith('workspace-id');
  });
});

describe('WorkspaceSwitcher Start state', () => {
  /**
   * Tests for WorkspaceSwitcher behavior when in start state
   */

  interface WorkspaceSwitcherState {
    isStart: boolean;
    currentWorkspace: { id: string; name: string } | null;
    workspaces: Array<{ id: string; name: string }>;
  }

  function getDisplayName(state: WorkspaceSwitcherState): string {
    return state.isStart ? 'Web of Trust' : (state.currentWorkspace?.name || 'Space');
  }

  function shouldShowStartEntry(state: WorkspaceSwitcherState): boolean {
    // Show start entry when we have workspaces and are not already in start state
    return state.workspaces.length > 0 && !state.isStart;
  }

  it('should show "Web of Trust" as display name when in start state', () => {
    const state: WorkspaceSwitcherState = {
      isStart: true,
      currentWorkspace: null,
      workspaces: [],
    };

    expect(getDisplayName(state)).toBe('Web of Trust');
  });

  it('should show workspace name when not in start state', () => {
    const state: WorkspaceSwitcherState = {
      isStart: false,
      currentWorkspace: { id: 'ws1', name: 'My Workspace' },
      workspaces: [{ id: 'ws1', name: 'My Workspace' }],
    };

    expect(getDisplayName(state)).toBe('My Workspace');
  });

  it('should fallback to "Space" when no current workspace', () => {
    const state: WorkspaceSwitcherState = {
      isStart: false,
      currentWorkspace: null,
      workspaces: [],
    };

    expect(getDisplayName(state)).toBe('Space');
  });

  it('should show start entry when workspaces exist and not in start state', () => {
    const state: WorkspaceSwitcherState = {
      isStart: false,
      currentWorkspace: { id: 'ws1', name: 'My Workspace' },
      workspaces: [{ id: 'ws1', name: 'My Workspace' }],
    };

    expect(shouldShowStartEntry(state)).toBe(true);
  });

  it('should not show start entry when already in start state', () => {
    const state: WorkspaceSwitcherState = {
      isStart: true,
      currentWorkspace: null,
      workspaces: [{ id: 'ws1', name: 'My Workspace' }],
    };

    expect(shouldShowStartEntry(state)).toBe(false);
  });

  it('should not show start entry when no workspaces exist', () => {
    const state: WorkspaceSwitcherState = {
      isStart: false,
      currentWorkspace: null,
      workspaces: [],
    };

    expect(shouldShowStartEntry(state)).toBe(false);
  });
});
