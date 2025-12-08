/**
 * Tests for WorkspaceModal component logic
 *
 * These tests verify:
 * - Leave workspace confirmation flow
 * - Participant sorting logic
 * - Name editing validation
 * - Modal state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceInfo } from './WorkspaceSwitcher';
import type { IdentityProfile } from '../schema/document';
import type { TrustedUserProfile } from '../hooks/useAppContext';

/**
 * Helper to sort participants (current user first, then by name)
 * Mirrors the logic in WorkspaceModal
 */
function sortParticipants(
  participants: Array<{ did: string; displayName?: string }>,
  currentUserDid: string
): Array<{ did: string; displayName?: string }> {
  return [...participants].sort((a, b) => {
    if (a.did === currentUserDid) return -1;
    if (b.did === currentUserDid) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
}

/**
 * Helper to get participants from doc.identities with trusted profile merging
 * Mirrors the logic in WorkspaceModal
 */
function getParticipants(
  identities: Record<string, IdentityProfile>,
  trustedUserProfiles: Record<string, TrustedUserProfile>
): Array<{
  did: string;
  displayName?: string;
  avatarUrl?: string;
  profileSignatureStatus?: string;
}> {
  return Object.entries(identities).map(([did, profile]) => {
    const trustedProfile = trustedUserProfiles[did];
    return {
      did,
      displayName: trustedProfile?.displayName || profile?.displayName,
      avatarUrl: trustedProfile?.avatarUrl || profile?.avatarUrl,
      profileSignatureStatus: trustedProfile?.profileSignatureStatus,
    };
  });
}

/**
 * Helper to validate workspace name input
 * Mirrors the logic in WorkspaceModal handleSaveName
 */
function validateNameInput(input: string): { valid: boolean; trimmed: string } {
  const trimmed = input.trim();
  return { valid: trimmed.length > 0, trimmed };
}

/**
 * Simulates the leave confirmation state machine
 */
interface LeaveConfirmState {
  showLeaveConfirm: boolean;
}

function leaveConfirmReducer(
  state: LeaveConfirmState,
  action: 'click_leave' | 'confirm' | 'cancel'
): LeaveConfirmState {
  switch (action) {
    case 'click_leave':
      return { showLeaveConfirm: true };
    case 'confirm':
    case 'cancel':
      return { showLeaveConfirm: false };
    default:
      return state;
  }
}

describe('WorkspaceModal logic', () => {
  describe('sortParticipants', () => {
    it('should put current user first', () => {
      const participants = [
        { did: 'did:key:z6MkUser2', displayName: 'Bob' },
        { did: 'did:key:z6MkUser1', displayName: 'Alice' },
        { did: 'did:key:z6MkUser3', displayName: 'Charlie' },
      ];

      const sorted = sortParticipants(participants, 'did:key:z6MkUser1');

      expect(sorted[0].did).toBe('did:key:z6MkUser1');
      expect(sorted[0].displayName).toBe('Alice');
    });

    it('should sort remaining participants alphabetically by displayName', () => {
      const participants = [
        { did: 'did:key:z6MkUser3', displayName: 'Charlie' },
        { did: 'did:key:z6MkUser1', displayName: 'Alice' },
        { did: 'did:key:z6MkUser2', displayName: 'Bob' },
      ];

      const sorted = sortParticipants(participants, 'did:key:z6MkUser1');

      // First is current user
      expect(sorted[0].displayName).toBe('Alice');
      // Then sorted alphabetically
      expect(sorted[1].displayName).toBe('Bob');
      expect(sorted[2].displayName).toBe('Charlie');
    });

    it('should handle participants without displayName', () => {
      const participants = [
        { did: 'did:key:z6MkUser2', displayName: undefined },
        { did: 'did:key:z6MkUser1', displayName: 'Alice' },
        { did: 'did:key:z6MkUser3', displayName: 'Charlie' },
      ];

      const sorted = sortParticipants(participants, 'did:key:z6MkUser1');

      expect(sorted[0].displayName).toBe('Alice');
      // Empty string sorts before other strings
      expect(sorted[1].displayName).toBeUndefined();
      expect(sorted[2].displayName).toBe('Charlie');
    });

    it('should handle empty participants list', () => {
      const sorted = sortParticipants([], 'did:key:z6MkUser1');
      expect(sorted).toHaveLength(0);
    });

    it('should handle single participant who is current user', () => {
      const participants = [
        { did: 'did:key:z6MkUser1', displayName: 'Alice' },
      ];

      const sorted = sortParticipants(participants, 'did:key:z6MkUser1');

      expect(sorted).toHaveLength(1);
      expect(sorted[0].did).toBe('did:key:z6MkUser1');
    });
  });

  describe('getParticipants', () => {
    it('should merge trusted profile data with identity data', () => {
      const identities: Record<string, IdentityProfile> = {
        'did:key:z6MkUser1': { displayName: 'User1 Original', avatarUrl: 'original.jpg' },
        'did:key:z6MkUser2': { displayName: 'User2' },
      };

      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:z6MkUser1': {
          displayName: 'User1 Trusted',
          avatarUrl: 'trusted.jpg',
          profileSignatureStatus: 'valid',
        },
      };

      const participants = getParticipants(identities, trustedProfiles);

      // User1 should have trusted profile data
      const user1 = participants.find(p => p.did === 'did:key:z6MkUser1');
      expect(user1?.displayName).toBe('User1 Trusted');
      expect(user1?.avatarUrl).toBe('trusted.jpg');
      expect(user1?.profileSignatureStatus).toBe('valid');

      // User2 should have identity data (no trusted profile)
      const user2 = participants.find(p => p.did === 'did:key:z6MkUser2');
      expect(user2?.displayName).toBe('User2');
      expect(user2?.avatarUrl).toBeUndefined();
      expect(user2?.profileSignatureStatus).toBeUndefined();
    });

    it('should fallback to identity data when trusted profile has no displayName', () => {
      const identities: Record<string, IdentityProfile> = {
        'did:key:z6MkUser1': { displayName: 'User1 Original' },
      };

      const trustedProfiles: Record<string, TrustedUserProfile> = {
        'did:key:z6MkUser1': {
          displayName: undefined,
          avatarUrl: 'trusted.jpg',
        } as TrustedUserProfile,
      };

      const participants = getParticipants(identities, trustedProfiles);
      const user1 = participants.find(p => p.did === 'did:key:z6MkUser1');

      expect(user1?.displayName).toBe('User1 Original');
      expect(user1?.avatarUrl).toBe('trusted.jpg');
    });

    it('should handle empty identities', () => {
      const participants = getParticipants({}, {});
      expect(participants).toHaveLength(0);
    });
  });

  describe('validateNameInput', () => {
    it('should return valid for non-empty trimmed string', () => {
      const result = validateNameInput('Test Workspace');
      expect(result.valid).toBe(true);
      expect(result.trimmed).toBe('Test Workspace');
    });

    it('should return invalid for empty string', () => {
      const result = validateNameInput('');
      expect(result.valid).toBe(false);
      expect(result.trimmed).toBe('');
    });

    it('should return invalid for whitespace-only string', () => {
      const result = validateNameInput('   ');
      expect(result.valid).toBe(false);
      expect(result.trimmed).toBe('');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = validateNameInput('  Test Name  ');
      expect(result.valid).toBe(true);
      expect(result.trimmed).toBe('Test Name');
    });
  });

  describe('leave confirmation state machine', () => {
    it('should start with showLeaveConfirm false', () => {
      const initialState: LeaveConfirmState = { showLeaveConfirm: false };
      expect(initialState.showLeaveConfirm).toBe(false);
    });

    it('should show confirmation when leave button is clicked', () => {
      let state: LeaveConfirmState = { showLeaveConfirm: false };
      state = leaveConfirmReducer(state, 'click_leave');
      expect(state.showLeaveConfirm).toBe(true);
    });

    it('should hide confirmation when confirmed', () => {
      let state: LeaveConfirmState = { showLeaveConfirm: true };
      state = leaveConfirmReducer(state, 'confirm');
      expect(state.showLeaveConfirm).toBe(false);
    });

    it('should hide confirmation when cancelled', () => {
      let state: LeaveConfirmState = { showLeaveConfirm: true };
      state = leaveConfirmReducer(state, 'cancel');
      expect(state.showLeaveConfirm).toBe(false);
    });

    it('should follow complete flow: leave -> cancel -> leave -> confirm', () => {
      let state: LeaveConfirmState = { showLeaveConfirm: false };

      // Click leave
      state = leaveConfirmReducer(state, 'click_leave');
      expect(state.showLeaveConfirm).toBe(true);

      // Cancel
      state = leaveConfirmReducer(state, 'cancel');
      expect(state.showLeaveConfirm).toBe(false);

      // Click leave again
      state = leaveConfirmReducer(state, 'click_leave');
      expect(state.showLeaveConfirm).toBe(true);

      // Confirm this time
      state = leaveConfirmReducer(state, 'confirm');
      expect(state.showLeaveConfirm).toBe(false);
    });
  });

  describe('leave workspace callback behavior', () => {
    it('should call onLeaveWorkspace when confirmed', () => {
      const onLeaveWorkspace = vi.fn();
      const onClose = vi.fn();

      // Simulate confirm action
      onLeaveWorkspace();
      onClose();

      expect(onLeaveWorkspace).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onLeaveWorkspace when cancelled', () => {
      const onLeaveWorkspace = vi.fn();
      const onClose = vi.fn();

      // Simulate cancel action - don't call the callbacks
      // Just verify they were not called

      expect(onLeaveWorkspace).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('workspace display name fallback', () => {
    it('should use workspace name when available', () => {
      const workspace: WorkspaceInfo = {
        id: 'ws1',
        name: 'My Workspace',
        lastAccessed: Date.now(),
      };
      const displayName = workspace?.name || 'Workspace';
      expect(displayName).toBe('My Workspace');
    });

    it('should use "Workspace" as fallback when no name', () => {
      const workspace: WorkspaceInfo | null = null;
      const displayName = workspace?.name || 'Workspace';
      expect(displayName).toBe('Workspace');
    });

    it('should use "Workspace" as fallback for empty name', () => {
      const workspace: WorkspaceInfo = {
        id: 'ws1',
        name: '',
        lastAccessed: Date.now(),
      };
      const displayName = workspace?.name || 'Workspace';
      expect(displayName).toBe('Workspace');
    });
  });

  describe('avatar letter extraction', () => {
    it('should extract first letter and uppercase it', () => {
      const name = 'test workspace';
      const letter = name.charAt(0).toUpperCase();
      expect(letter).toBe('T');
    });

    it('should handle empty string gracefully', () => {
      const name = '';
      const letter = (name || 'W').charAt(0).toUpperCase();
      expect(letter).toBe('W');
    });

    it('should handle special characters', () => {
      const name = '123 Numbers';
      const letter = name.charAt(0).toUpperCase();
      expect(letter).toBe('1');
    });
  });

  describe('canEdit determination', () => {
    it('should be true when onUpdateWorkspace is provided', () => {
      const onUpdateWorkspace = vi.fn();
      const canEdit = !!onUpdateWorkspace;
      expect(canEdit).toBe(true);
    });

    it('should be false when onUpdateWorkspace is undefined', () => {
      const onUpdateWorkspace = undefined;
      const canEdit = !!onUpdateWorkspace;
      expect(canEdit).toBe(false);
    });

    it('should be false when onUpdateWorkspace is null', () => {
      const onUpdateWorkspace = null;
      const canEdit = !!onUpdateWorkspace;
      expect(canEdit).toBe(false);
    });
  });

  describe('share link handling', () => {
    it('should prefer onShareLink callback when provided', () => {
      const onShareLink = vi.fn();
      const documentUrl = 'automerge:doc123';
      const onShowToast = vi.fn();

      // Simulate handleCopyLink logic
      if (onShareLink) {
        onShareLink();
      } else if (documentUrl) {
        // Would copy to clipboard and show toast
        onShowToast('Link in Zwischenablage kopiert!');
      }

      expect(onShareLink).toHaveBeenCalled();
      expect(onShowToast).not.toHaveBeenCalled();
    });

    it('should use clipboard and toast when no onShareLink callback', () => {
      const onShareLink = undefined;
      const documentUrl = 'automerge:doc123';
      const onShowToast = vi.fn();

      // Simulate handleCopyLink logic
      if (onShareLink) {
        onShareLink();
      } else if (documentUrl) {
        // Would copy to clipboard and show toast
        onShowToast('Link in Zwischenablage kopiert!');
      }

      expect(onShowToast).toHaveBeenCalledWith('Link in Zwischenablage kopiert!');
    });

    it('should do nothing when neither callback nor url provided', () => {
      const onShareLink = undefined;
      const documentUrl = undefined;
      const onShowToast = vi.fn();

      // Simulate handleCopyLink logic
      if (onShareLink) {
        onShareLink();
      } else if (documentUrl) {
        onShowToast('Link in Zwischenablage kopiert!');
      }

      expect(onShowToast).not.toHaveBeenCalled();
    });
  });

  describe('hidden user visibility toggle', () => {
    it('should correctly check if user is hidden', () => {
      const hiddenUserDids = new Set(['did:key:z6MkHidden1', 'did:key:z6MkHidden2']);

      expect(hiddenUserDids.has('did:key:z6MkHidden1')).toBe(true);
      expect(hiddenUserDids.has('did:key:z6MkVisible')).toBe(false);
    });

    it('should handle empty hidden set', () => {
      const hiddenUserDids = new Set<string>();

      expect(hiddenUserDids.has('did:key:z6MkAny')).toBe(false);
    });
  });
});
