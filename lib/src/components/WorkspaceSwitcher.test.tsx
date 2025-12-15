/**
 * Tests for WorkspaceSwitcher component
 *
 * These tests verify:
 * - WorkspaceInfo helper functions (loadWorkspaceList, saveWorkspaceList, upsertWorkspace)
 * - Workspace state derivation from UserDocument
 * - Merge logic between localStorage and UserDocument
 * - Migration logic from localStorage to UserDocument
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkspaceInfo } from './WorkspaceSwitcher';
import { loadWorkspaceList, saveWorkspaceList, upsertWorkspace } from './WorkspaceSwitcher';
import type { WorkspaceRef } from '../schema/userDocument';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('WorkspaceSwitcher localStorage helpers', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('loadWorkspaceList', () => {
    it('should return empty array when no data stored', () => {
      const result = loadWorkspaceList();
      expect(result).toEqual([]);
    });

    it('should return empty array when data is invalid JSON', () => {
      localStorageMock.setItem('narrativeWorkspaces', 'invalid-json');
      const result = loadWorkspaceList();
      expect(result).toEqual([]);
    });

    it('should load valid workspace list', () => {
      const workspaces: WorkspaceInfo[] = [
        { id: 'doc1', name: 'Workspace 1', lastAccessed: 1000 },
        { id: 'doc2', name: 'Workspace 2', avatar: 'avatar.png', lastAccessed: 2000 },
      ];
      localStorageMock.setItem('narrativeWorkspaces', JSON.stringify(workspaces));

      const result = loadWorkspaceList();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc1');
      expect(result[1].avatar).toBe('avatar.png');
    });

    it('should use custom storage key', () => {
      const workspaces: WorkspaceInfo[] = [
        { id: 'custom1', name: 'Custom Workspace', lastAccessed: 1000 },
      ];
      localStorageMock.setItem('customWorkspaces', JSON.stringify(workspaces));

      const result = loadWorkspaceList('customWorkspaces');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('custom1');
    });
  });

  describe('saveWorkspaceList', () => {
    it('should save workspace list to localStorage', () => {
      const workspaces: WorkspaceInfo[] = [
        { id: 'doc1', name: 'Workspace 1', lastAccessed: 1000 },
      ];

      saveWorkspaceList(workspaces);

      const stored = JSON.parse(localStorageMock.getItem('narrativeWorkspaces')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Workspace 1');
    });

    it('should use custom storage key', () => {
      const workspaces: WorkspaceInfo[] = [
        { id: 'doc1', name: 'Workspace 1', lastAccessed: 1000 },
      ];

      saveWorkspaceList(workspaces, 'myWorkspaces');

      const stored = JSON.parse(localStorageMock.getItem('myWorkspaces')!);
      expect(stored).toHaveLength(1);
    });

    it('should handle empty array', () => {
      saveWorkspaceList([]);

      const stored = JSON.parse(localStorageMock.getItem('narrativeWorkspaces')!);
      expect(stored).toEqual([]);
    });
  });

  describe('upsertWorkspace', () => {
    it('should add new workspace to empty list', () => {
      const newWorkspace: WorkspaceInfo = {
        id: 'new1',
        name: 'New Workspace',
        lastAccessed: 1000,
      };

      const result = upsertWorkspace([], newWorkspace);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newWorkspace);
    });

    it('should add new workspace to existing list', () => {
      const existing: WorkspaceInfo[] = [
        { id: 'existing1', name: 'Existing', lastAccessed: 500 },
      ];
      const newWorkspace: WorkspaceInfo = {
        id: 'new1',
        name: 'New Workspace',
        lastAccessed: 1000,
      };

      const result = upsertWorkspace(existing, newWorkspace);

      expect(result).toHaveLength(2);
      expect(result.find(w => w.id === 'new1')).toBeDefined();
    });

    it('should update existing workspace by id', () => {
      const existing: WorkspaceInfo[] = [
        { id: 'ws1', name: 'Old Name', lastAccessed: 500 },
        { id: 'ws2', name: 'Other', lastAccessed: 600 },
      ];
      const updated: WorkspaceInfo = {
        id: 'ws1',
        name: 'New Name',
        avatar: 'new-avatar.png',
        lastAccessed: 1000,
      };

      const result = upsertWorkspace(existing, updated);

      expect(result).toHaveLength(2);
      const ws1 = result.find(w => w.id === 'ws1');
      expect(ws1?.name).toBe('New Name');
      expect(ws1?.avatar).toBe('new-avatar.png');
      expect(ws1?.lastAccessed).toBe(1000);
    });

    it('should not modify original array', () => {
      const existing: WorkspaceInfo[] = [
        { id: 'ws1', name: 'Original', lastAccessed: 500 },
      ];
      const updated: WorkspaceInfo = {
        id: 'ws1',
        name: 'Updated',
        lastAccessed: 1000,
      };

      upsertWorkspace(existing, updated);

      expect(existing[0].name).toBe('Original');
    });
  });
});

describe('WorkspaceSwitcher UserDocument integration', () => {
  /**
   * Tests for the logic that derives workspace state from UserDocument
   * These test the pure functions that mirror useAppContext behavior
   */

  /**
   * Convert UserDocument workspaces to WorkspaceInfo array
   * (mirrors workspacesFromUserDoc in useAppContext)
   */
  function workspacesFromUserDoc(
    workspaces: Record<string, WorkspaceRef> | undefined
  ): WorkspaceInfo[] {
    if (!workspaces) return [];
    return Object.values(workspaces).map(ws => ({
      id: ws.docId,
      name: ws.name,
      avatar: ws.avatar,
      lastAccessed: ws.lastAccessedAt ?? ws.addedAt,
    }));
  }

  /**
   * Merge UserDocument workspaces with localStorage workspaces
   * UserDocument takes priority, localStorage provides fallback
   * (mirrors workspaces merge logic in useAppContext)
   */
  function mergeWorkspaces(
    userDocWorkspaces: WorkspaceInfo[],
    localWorkspaces: WorkspaceInfo[]
  ): WorkspaceInfo[] {
    const fromUserDoc = new Map(userDocWorkspaces.map(w => [w.id, w]));
    for (const lw of localWorkspaces) {
      if (!fromUserDoc.has(lw.id)) {
        fromUserDoc.set(lw.id, lw);
      }
    }
    return Array.from(fromUserDoc.values());
  }

  /**
   * Get workspaces to migrate from localStorage to UserDocument
   * (mirrors migration logic in useAppContext)
   */
  function getWorkspacesToMigrate(
    localWorkspaces: WorkspaceInfo[],
    userDocWorkspaces: Record<string, WorkspaceRef>
  ): WorkspaceInfo[] {
    return localWorkspaces.filter(lw => !userDocWorkspaces[lw.id]);
  }

  describe('workspacesFromUserDoc', () => {
    it('should return empty array when workspaces is undefined', () => {
      const result = workspacesFromUserDoc(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array when workspaces is empty', () => {
      const result = workspacesFromUserDoc({});
      expect(result).toEqual([]);
    });

    it('should convert WorkspaceRef to WorkspaceInfo', () => {
      const workspaces: Record<string, WorkspaceRef> = {
        'doc1': {
          docId: 'doc1',
          name: 'My Workspace',
          avatar: 'avatar.png',
          addedAt: 1000,
          lastAccessedAt: 2000,
        },
      };

      const result = workspacesFromUserDoc(workspaces);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'doc1',
        name: 'My Workspace',
        avatar: 'avatar.png',
        lastAccessed: 2000,
      });
    });

    it('should use addedAt when lastAccessedAt is undefined', () => {
      const workspaces: Record<string, WorkspaceRef> = {
        'doc1': {
          docId: 'doc1',
          name: 'My Workspace',
          addedAt: 1000,
        },
      };

      const result = workspacesFromUserDoc(workspaces);

      expect(result[0].lastAccessed).toBe(1000);
    });

    it('should convert multiple workspaces', () => {
      const workspaces: Record<string, WorkspaceRef> = {
        'doc1': { docId: 'doc1', name: 'WS 1', addedAt: 1000 },
        'doc2': { docId: 'doc2', name: 'WS 2', addedAt: 2000 },
        'doc3': { docId: 'doc3', name: 'WS 3', addedAt: 3000 },
      };

      const result = workspacesFromUserDoc(workspaces);

      expect(result).toHaveLength(3);
      expect(result.map(w => w.id).sort()).toEqual(['doc1', 'doc2', 'doc3']);
    });
  });

  describe('mergeWorkspaces', () => {
    it('should return userDoc workspaces when localStorage is empty', () => {
      const userDocWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'From UserDoc', lastAccessed: 1000 },
      ];

      const result = mergeWorkspaces(userDocWs, []);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('From UserDoc');
    });

    it('should return localStorage workspaces when userDoc is empty', () => {
      const localWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'From localStorage', lastAccessed: 1000 },
      ];

      const result = mergeWorkspaces([], localWs);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('From localStorage');
    });

    it('should prefer userDoc over localStorage for same id', () => {
      const userDocWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'UserDoc Name', lastAccessed: 2000 },
      ];
      const localWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'Local Name', lastAccessed: 1000 },
      ];

      const result = mergeWorkspaces(userDocWs, localWs);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('UserDoc Name');
      expect(result[0].lastAccessed).toBe(2000);
    });

    it('should include localStorage workspaces not in userDoc', () => {
      const userDocWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'UserDoc WS', lastAccessed: 1000 },
      ];
      const localWs: WorkspaceInfo[] = [
        { id: 'doc2', name: 'Local Only WS', lastAccessed: 500 },
      ];

      const result = mergeWorkspaces(userDocWs, localWs);

      expect(result).toHaveLength(2);
      expect(result.find(w => w.id === 'doc1')?.name).toBe('UserDoc WS');
      expect(result.find(w => w.id === 'doc2')?.name).toBe('Local Only WS');
    });

    it('should handle complex merge scenario', () => {
      const userDocWs: WorkspaceInfo[] = [
        { id: 'shared1', name: 'Shared Updated', lastAccessed: 3000 },
        { id: 'udoc1', name: 'Only in UserDoc', lastAccessed: 2000 },
      ];
      const localWs: WorkspaceInfo[] = [
        { id: 'shared1', name: 'Shared Old', lastAccessed: 1000 },
        { id: 'local1', name: 'Only in Local', lastAccessed: 500 },
      ];

      const result = mergeWorkspaces(userDocWs, localWs);

      expect(result).toHaveLength(3);
      // UserDoc version wins for shared
      expect(result.find(w => w.id === 'shared1')?.name).toBe('Shared Updated');
      // Both exclusive workspaces are included
      expect(result.find(w => w.id === 'udoc1')?.name).toBe('Only in UserDoc');
      expect(result.find(w => w.id === 'local1')?.name).toBe('Only in Local');
    });
  });

  describe('getWorkspacesToMigrate', () => {
    it('should return all local workspaces when userDoc is empty', () => {
      const localWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'WS 1', lastAccessed: 1000 },
        { id: 'doc2', name: 'WS 2', lastAccessed: 2000 },
      ];

      const result = getWorkspacesToMigrate(localWs, {});

      expect(result).toHaveLength(2);
    });

    it('should return empty when all local workspaces exist in userDoc', () => {
      const localWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'WS 1', lastAccessed: 1000 },
      ];
      const userDocWs: Record<string, WorkspaceRef> = {
        'doc1': { docId: 'doc1', name: 'WS 1', addedAt: 1000 },
      };

      const result = getWorkspacesToMigrate(localWs, userDocWs);

      expect(result).toHaveLength(0);
    });

    it('should return only workspaces not in userDoc', () => {
      const localWs: WorkspaceInfo[] = [
        { id: 'doc1', name: 'Exists', lastAccessed: 1000 },
        { id: 'doc2', name: 'To Migrate', lastAccessed: 2000 },
        { id: 'doc3', name: 'Also Migrate', lastAccessed: 3000 },
      ];
      const userDocWs: Record<string, WorkspaceRef> = {
        'doc1': { docId: 'doc1', name: 'Exists', addedAt: 1000 },
      };

      const result = getWorkspacesToMigrate(localWs, userDocWs);

      expect(result).toHaveLength(2);
      expect(result.map(w => w.id)).toEqual(['doc2', 'doc3']);
    });

    it('should return empty when localStorage is empty', () => {
      const userDocWs: Record<string, WorkspaceRef> = {
        'doc1': { docId: 'doc1', name: 'WS 1', addedAt: 1000 },
      };

      const result = getWorkspacesToMigrate([], userDocWs);

      expect(result).toHaveLength(0);
    });
  });
});

describe('WorkspaceSwitcher display logic', () => {
  /**
   * Tests for the display logic used in the WorkspaceSwitcher component
   */

  /**
   * Get display name for workspace switcher header
   * (mirrors displayName logic in WorkspaceSwitcher)
   */
  function getDisplayName(
    isStart: boolean,
    currentWorkspace: WorkspaceInfo | null
  ): string {
    return isStart ? 'Web of Trust' : (currentWorkspace?.name || 'Space');
  }

  /**
   * Get first letter for avatar placeholder
   * (mirrors avatar placeholder logic in WorkspaceSwitcher)
   */
  function getAvatarLetter(workspace: WorkspaceInfo | null): string {
    return (workspace?.name || 'W').charAt(0).toUpperCase();
  }

  /**
   * Filter workspaces for "other workspaces" section
   * (mirrors filter logic in WorkspaceSwitcher)
   */
  function getOtherWorkspaces(
    workspaces: WorkspaceInfo[],
    currentWorkspaceId: string | undefined
  ): WorkspaceInfo[] {
    return workspaces
      .filter(w => w.id !== currentWorkspaceId)
      .sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  describe('getDisplayName', () => {
    it('should return "Web of Trust" when isStart is true', () => {
      expect(getDisplayName(true, null)).toBe('Web of Trust');
    });

    it('should return "Web of Trust" even with workspace when isStart is true', () => {
      const workspace: WorkspaceInfo = { id: 'ws1', name: 'My Workspace', lastAccessed: 1000 };
      expect(getDisplayName(true, workspace)).toBe('Web of Trust');
    });

    it('should return workspace name when not in start state', () => {
      const workspace: WorkspaceInfo = { id: 'ws1', name: 'My Workspace', lastAccessed: 1000 };
      expect(getDisplayName(false, workspace)).toBe('My Workspace');
    });

    it('should return "Space" when no workspace and not in start state', () => {
      expect(getDisplayName(false, null)).toBe('Space');
    });
  });

  describe('getAvatarLetter', () => {
    it('should return first letter uppercased', () => {
      const workspace: WorkspaceInfo = { id: 'ws1', name: 'My Workspace', lastAccessed: 1000 };
      expect(getAvatarLetter(workspace)).toBe('M');
    });

    it('should return "W" for null workspace', () => {
      expect(getAvatarLetter(null)).toBe('W');
    });

    it('should handle lowercase first letter', () => {
      const workspace: WorkspaceInfo = { id: 'ws1', name: 'lowercase', lastAccessed: 1000 };
      expect(getAvatarLetter(workspace)).toBe('L');
    });

    it('should handle special char at start', () => {
      // Note: charAt(0) doesn't handle emoji surrogate pairs correctly
      // This test documents actual behavior with ASCII special chars
      const workspace: WorkspaceInfo = { id: 'ws1', name: '# Hashtag', lastAccessed: 1000 };
      expect(getAvatarLetter(workspace)).toBe('#');
    });
  });

  describe('getOtherWorkspaces', () => {
    const workspaces: WorkspaceInfo[] = [
      { id: 'ws1', name: 'First', lastAccessed: 1000 },
      { id: 'ws2', name: 'Second', lastAccessed: 3000 },
      { id: 'ws3', name: 'Third', lastAccessed: 2000 },
    ];

    it('should exclude current workspace', () => {
      const result = getOtherWorkspaces(workspaces, 'ws1');

      expect(result).toHaveLength(2);
      expect(result.find(w => w.id === 'ws1')).toBeUndefined();
    });

    it('should sort by lastAccessed descending', () => {
      const result = getOtherWorkspaces(workspaces, 'ws1');

      expect(result[0].id).toBe('ws2'); // 3000
      expect(result[1].id).toBe('ws3'); // 2000
    });

    it('should return all workspaces when currentWorkspaceId is undefined', () => {
      const result = getOtherWorkspaces(workspaces, undefined);

      expect(result).toHaveLength(3);
    });

    it('should return empty array when workspaces is empty', () => {
      const result = getOtherWorkspaces([], 'ws1');

      expect(result).toHaveLength(0);
    });

    it('should return all when currentWorkspaceId does not match any', () => {
      const result = getOtherWorkspaces(workspaces, 'nonexistent');

      expect(result).toHaveLength(3);
    });
  });
});

describe('WorkspaceSwitcher visibility conditions', () => {
  /**
   * Tests for the visibility logic of various WorkspaceSwitcher sections
   */

  interface SwitcherState {
    isStart: boolean;
    showStartEntry: boolean;
    currentWorkspace: WorkspaceInfo | null;
    hasOtherWorkspaces: boolean;
    hasOnGoToStart: boolean;
  }

  /**
   * Should show current workspace section
   */
  function shouldShowCurrentWorkspace(state: SwitcherState): boolean {
    return !state.isStart && state.currentWorkspace !== null;
  }

  /**
   * Should show start entry in dropdown
   */
  function shouldShowStartInDropdown(state: SwitcherState): boolean {
    return state.isStart;
  }

  /**
   * Should show "Go to Start" option
   */
  function shouldShowGoToStart(state: SwitcherState): boolean {
    return state.showStartEntry && !state.isStart && state.hasOnGoToStart;
  }

  describe('shouldShowCurrentWorkspace', () => {
    it('should return false when in start state', () => {
      const state: SwitcherState = {
        isStart: true,
        showStartEntry: false,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: false,
      };
      expect(shouldShowCurrentWorkspace(state)).toBe(false);
    });

    it('should return false when no current workspace', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: false,
        currentWorkspace: null,
        hasOtherWorkspaces: false,
        hasOnGoToStart: false,
      };
      expect(shouldShowCurrentWorkspace(state)).toBe(false);
    });

    it('should return true when not start and has workspace', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: false,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: false,
      };
      expect(shouldShowCurrentWorkspace(state)).toBe(true);
    });
  });

  describe('shouldShowStartInDropdown', () => {
    it('should return true when in start state', () => {
      const state: SwitcherState = {
        isStart: true,
        showStartEntry: false,
        currentWorkspace: null,
        hasOtherWorkspaces: false,
        hasOnGoToStart: false,
      };
      expect(shouldShowStartInDropdown(state)).toBe(true);
    });

    it('should return false when not in start state', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: true,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: true,
      };
      expect(shouldShowStartInDropdown(state)).toBe(false);
    });
  });

  describe('shouldShowGoToStart', () => {
    it('should return true when all conditions met', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: true,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: true,
      };
      expect(shouldShowGoToStart(state)).toBe(true);
    });

    it('should return false when in start state', () => {
      const state: SwitcherState = {
        isStart: true,
        showStartEntry: true,
        currentWorkspace: null,
        hasOtherWorkspaces: false,
        hasOnGoToStart: true,
      };
      expect(shouldShowGoToStart(state)).toBe(false);
    });

    it('should return false when showStartEntry is false', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: false,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: true,
      };
      expect(shouldShowGoToStart(state)).toBe(false);
    });

    it('should return false when no onGoToStart handler', () => {
      const state: SwitcherState = {
        isStart: false,
        showStartEntry: true,
        currentWorkspace: { id: 'ws1', name: 'WS', lastAccessed: 1000 },
        hasOtherWorkspaces: false,
        hasOnGoToStart: false,
      };
      expect(shouldShowGoToStart(state)).toBe(false);
    });
  });
});
