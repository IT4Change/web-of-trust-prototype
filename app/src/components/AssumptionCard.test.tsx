import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssumptionCard } from './AssumptionCard';
import type { Assumption, Tag, Vote, VoteSummary, EditEntry, OpinionGraphDoc } from 'narrative-ui';

// Mock CreateAssumptionModal since it's a complex modal component
vi.mock('./CreateAssumptionModal', () => ({
  CreateAssumptionModal: ({
    isOpen,
    onClose,
    onSubmit,
    initialSentence,
    submitLabel,
  }: any) =>
    isOpen ? (
      <div data-testid="edit-modal">
        <div>Modal: {submitLabel}</div>
        <div>Initial: {initialSentence}</div>
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => onSubmit('Edited sentence', ['Tag1'])}>
          Save
        </button>
      </div>
    ) : null,
}));

// Mock VoteBar to simplify testing
vi.mock('./VoteBar', () => ({
  VoteBar: ({ summary }: any) => (
    <div data-testid="vote-bar">
      VoteBar: {summary.green}/{summary.yellow}/{summary.red}
    </div>
  ),
}));

describe('AssumptionCard', () => {
  const mockAssumption: Assumption = {
    id: 'a1',
    sentence: 'React is better than Vue',
    createdBy: 'did:key:alice',
    createdAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
    updatedAt: Date.now() - 1000 * 60 * 60,
    tagIds: ['t1', 't2'],
    voteIds: ['v1', 'v2'],
    editLogIds: ['e1'],
  };

  const mockTags: Tag[] = [
    {
      id: 't1',
      name: 'Frontend',
      color: '#3b82f6',
      createdBy: 'did:key:alice',
      createdAt: Date.now(),
    },
    {
      id: 't2',
      name: 'Opinion',
      color: '#8b5cf6',
      createdBy: 'did:key:bob',
      createdAt: Date.now(),
    },
  ];

  const mockVotes: Vote[] = [
    {
      id: 'v1',
      assumptionId: 'a1',
      voterDid: 'did:key:alice',
      value: 'green',
      createdAt: Date.now() - 1000 * 60 * 30, // 30 min ago
      updatedAt: Date.now() - 1000 * 60 * 30,
    },
    {
      id: 'v2',
      assumptionId: 'a1',
      voterDid: 'did:key:bob',
      value: 'red',
      createdAt: Date.now() - 1000 * 60 * 15, // 15 min ago
      updatedAt: Date.now() - 1000 * 60 * 15,
    },
  ];

  const mockEdits: EditEntry[] = [
    {
      id: 'e1',
      assumptionId: 'a1',
      editorDid: 'did:key:alice',
      type: 'create',
      previousSentence: '',
      newSentence: 'React is better than Vue',
      previousTags: [],
      newTags: ['Frontend', 'Opinion'],
      createdAt: Date.now() - 1000 * 60 * 60,
    },
  ];

  const mockVoteSummary: VoteSummary = {
    green: 1,
    yellow: 0,
    red: 1,
    total: 2,
    userVote: undefined,
  };

  const mockDoc: Partial<OpinionGraphDoc> = {
    identities: {
      'did:key:alice': { displayName: 'Alice Smith' },
      'did:key:bob': { displayName: 'Bob Johnson' },
    },
  };

  const defaultProps = {
    assumption: mockAssumption,
    tags: mockTags,
    availableTags: mockTags,
    votes: mockVotes,
    edits: mockEdits,
    voteSummary: mockVoteSummary,
    onVote: vi.fn(),
    onEdit: vi.fn(),
    doc: mockDoc as OpinionGraphDoc,
  };

  describe('Rendering', () => {
    it('should render assumption sentence', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByText('React is better than Vue')).toBeInTheDocument();
    });

    it('should render tags', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Opinion')).toBeInTheDocument();
    });

    it('should not render tags section when no tags', () => {
      render(<AssumptionCard {...defaultProps} tags={[]} />);

      expect(screen.queryByText('Frontend')).not.toBeInTheDocument();
    });

    it('should render VoteBar with vote summary', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByTestId('vote-bar')).toBeInTheDocument();
      expect(screen.getByText('VoteBar: 1/0/1')).toBeInTheDocument();
    });

    it('should render vote count text', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByText('2 votes')).toBeInTheDocument();
    });

    it('should show singular "vote" when total is 1', () => {
      const summary: VoteSummary = {
        green: 1,
        yellow: 0,
        red: 0,
        total: 1,
        userVote: undefined,
      };

      render(<AssumptionCard {...defaultProps} voteSummary={summary} votes={[mockVotes[0]]} />);

      expect(screen.getByText('1 vote')).toBeInTheDocument();
    });

    it('should render edit button', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe('Vote buttons', () => {
    it('should render all three vote buttons', () => {
      render(<AssumptionCard {...defaultProps} />);

      // Find buttons by their emoji content
      const buttons = screen.getAllByRole('button');
      const voteButtons = buttons.filter(
        (btn) =>
          btn.textContent?.includes('🟢') ||
          btn.textContent?.includes('🟡') ||
          btn.textContent?.includes('🔴')
      );

      expect(voteButtons).toHaveLength(3);
    });

    it('should show vote counts on buttons', () => {
      render(<AssumptionCard {...defaultProps} />);

      const buttons = screen.getAllByRole('button');

      // Green button should show count 1
      const greenButton = buttons.find((btn) => btn.textContent?.includes('🟢'));
      expect(greenButton?.textContent).toContain('1');

      // Red button should show count 1
      const redButton = buttons.find((btn) => btn.textContent?.includes('🔴'));
      expect(redButton?.textContent).toContain('1');

      // Yellow button should show count 0
      const yellowButton = buttons.find((btn) => btn.textContent?.includes('🟡'));
      expect(yellowButton?.textContent).toContain('0');
    });

    it('should call onVote with green when green button is clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<AssumptionCard {...defaultProps} onVote={onVote} />);

      const buttons = screen.getAllByRole('button');
      const greenButton = buttons.find((btn) => btn.textContent?.includes('🟢'));

      await user.click(greenButton!);

      expect(onVote).toHaveBeenCalledWith('a1', 'green');
    });

    it('should call onVote with yellow when yellow button is clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<AssumptionCard {...defaultProps} onVote={onVote} />);

      const buttons = screen.getAllByRole('button');
      const yellowButton = buttons.find((btn) => btn.textContent?.includes('🟡'));

      await user.click(yellowButton!);

      expect(onVote).toHaveBeenCalledWith('a1', 'yellow');
    });

    it('should call onVote with red when red button is clicked', async () => {
      const user = userEvent.setup();
      const onVote = vi.fn();

      render(<AssumptionCard {...defaultProps} onVote={onVote} />);

      const buttons = screen.getAllByRole('button');
      const redButton = buttons.find((btn) => btn.textContent?.includes('🔴'));

      await user.click(redButton!);

      expect(onVote).toHaveBeenCalledWith('a1', 'red');
    });

    it('should highlight green button when user has voted green', () => {
      const summary: VoteSummary = {
        ...mockVoteSummary,
        userVote: 'green',
      };

      const { container } = render(
        <AssumptionCard {...defaultProps} voteSummary={summary} />
      );

      // Find green button and check for active styling
      const buttons = container.querySelectorAll('button');
      const greenButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('🟢')
      );

      // Should have tw:btn-success class (active state)
      expect(greenButton?.className).toContain('tw:btn-success');
      expect(greenButton?.className).not.toContain('tw:btn-outline');

      // Should show checkmark
      expect(greenButton?.textContent).toContain('✔︎');
    });

    it('should highlight yellow button when user has voted yellow', () => {
      const summary: VoteSummary = {
        ...mockVoteSummary,
        userVote: 'yellow',
      };

      const { container } = render(
        <AssumptionCard {...defaultProps} voteSummary={summary} />
      );

      const buttons = container.querySelectorAll('button');
      const yellowButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('🟡')
      );

      expect(yellowButton?.className).toContain('tw:btn-warning');
      expect(yellowButton?.className).not.toContain('tw:btn-outline');
      expect(yellowButton?.textContent).toContain('✔︎');
    });

    it('should highlight red button when user has voted red', () => {
      const summary: VoteSummary = {
        ...mockVoteSummary,
        userVote: 'red',
      };

      const { container } = render(
        <AssumptionCard {...defaultProps} voteSummary={summary} />
      );

      const buttons = container.querySelectorAll('button');
      const redButton = Array.from(buttons).find((btn) =>
        btn.textContent?.includes('🔴')
      );

      expect(redButton?.className).toContain('tw:btn-error');
      expect(redButton?.className).not.toContain('tw:btn-outline');
      expect(redButton?.textContent).toContain('✔︎');
    });
  });

  describe('Edit functionality', () => {
    it('should open edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
      expect(screen.getByText('Modal: Speichern')).toBeInTheDocument();
      expect(screen.getByText('Initial: React is better than Vue')).toBeInTheDocument();
    });

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} />);

      // Open modal
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(screen.getByTestId('edit-modal')).toBeInTheDocument();

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
      });
    });

    it('should call onEdit when save is clicked in modal', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(<AssumptionCard {...defaultProps} onEdit={onEdit} />);

      // Open modal
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onEdit).toHaveBeenCalledWith('a1', 'Edited sentence', ['Tag1']);
    });

    it('should close modal after saving', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} />);

      // Open modal
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Activity log', () => {
    it('should show Details button when activities exist', () => {
      render(<AssumptionCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
    });

    it('should not show Details button when no activities', () => {
      render(<AssumptionCard {...defaultProps} votes={[]} edits={[]} />);

      expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument();
    });

    it('should toggle activity log when Details is clicked', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} />);

      // Initially hidden
      expect(screen.queryByText('Aktivität')).not.toBeInTheDocument();

      // Click Details
      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      // Should show activity log
      expect(screen.getByText('Aktivität')).toBeInTheDocument();

      // Click again to hide
      await user.click(detailsButton);

      await waitFor(() => {
        expect(screen.queryByText('Aktivität')).not.toBeInTheDocument();
      });
    });

    it('should display vote activities with voter names', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} />);

      // Open activity log
      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      // Should show voter names from identities map (multiple occurrences expected)
      const aliceNames = screen.getAllByText('Alice Smith');
      const bobNames = screen.getAllByText('Bob Johnson');

      expect(aliceNames.length).toBeGreaterThan(0);
      expect(bobNames.length).toBeGreaterThan(0);
    });

    it('should display edit activities with editor names', async () => {
      const user = userEvent.setup();

      const edits: EditEntry[] = [
        {
          id: 'e1',
          assumptionId: 'a1',
          editorDid: 'did:key:alice',
          type: 'create',
          previousSentence: '',
          newSentence: 'React is better than Vue',
          previousTags: [],
          newTags: ['Frontend'],
          createdAt: Date.now() - 1000 * 60 * 60,
        },
      ];

      render(<AssumptionCard {...defaultProps} edits={edits} votes={[]} />);

      // Open activity log
      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      // Should show editor name (only one edit, so should be unique)
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('should show relative time for activities', async () => {
      const user = userEvent.setup();

      const now = Date.now();
      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: now - 1000 * 60 * 5, // 5 minutes ago
          updatedAt: now - 1000 * 60 * 5,
        },
      ];

      render(<AssumptionCard {...defaultProps} votes={votes} />);

      // Open activity log
      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      // Should show "vor X Minuten"
      expect(screen.getByText(/vor \d+ Minuten/i)).toBeInTheDocument();
    });

    it('should sort activities by timestamp (newest first)', async () => {
      const user = userEvent.setup();

      const now = Date.now();
      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: now - 1000 * 60 * 30, // 30 min ago
          updatedAt: now - 1000 * 60 * 30,
        },
        {
          id: 'v2',
          assumptionId: 'a1',
          voterDid: 'did:key:bob',
          value: 'red',
          createdAt: now - 1000 * 60 * 10, // 10 min ago (newer)
          updatedAt: now - 1000 * 60 * 10,
        },
      ];

      render(<AssumptionCard {...defaultProps} votes={votes} />);

      // Open activity log
      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      // Get all activity items
      const activitySection = screen.getByText('Aktivität').parentElement;
      const names = within(activitySection!).getAllByText(/Smith|Johnson/);

      // Bob (newer) should appear before Alice
      expect(names[0]).toHaveTextContent('Bob Johnson');
      expect(names[1]).toHaveTextContent('Alice Smith');
    });
  });

  describe('Tag interactions', () => {
    it('should call onTagClick when tag is clicked', async () => {
      const user = userEvent.setup();
      const onTagClick = vi.fn();

      render(<AssumptionCard {...defaultProps} onTagClick={onTagClick} />);

      const frontendTag = screen.getByText('Frontend');
      await user.click(frontendTag);

      expect(onTagClick).toHaveBeenCalledWith('t1');
    });

    it('should not crash when onTagClick is undefined', async () => {
      const user = userEvent.setup();

      render(<AssumptionCard {...defaultProps} onTagClick={undefined} />);

      const frontendTag = screen.getByText('Frontend');

      // Should not throw error
      await expect(user.click(frontendTag)).resolves.not.toThrow();
    });
  });

  describe('Relative time formatting', () => {
    it('should show "gerade eben" for timestamps < 30 seconds', async () => {
      const user = userEvent.setup();

      const now = Date.now();
      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: now - 1000 * 10, // 10 seconds ago
          updatedAt: now - 1000 * 10,
        },
      ];

      render(<AssumptionCard {...defaultProps} votes={votes} />);

      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      expect(screen.getByText('gerade eben')).toBeInTheDocument();
    });

    it('should show "vor 1 Minute" for timestamps around 1 minute', async () => {
      const user = userEvent.setup();

      const now = Date.now();
      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: now - 1000 * 70, // 70 seconds ago
          updatedAt: now - 1000 * 70,
        },
      ];

      render(<AssumptionCard {...defaultProps} votes={votes} />);

      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      expect(screen.getByText('vor 1 Minute')).toBeInTheDocument();
    });

    it('should show "vor X Minuten" for multiple minutes', async () => {
      const user = userEvent.setup();

      const now = Date.now();
      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: now - 1000 * 60 * 15, // 15 minutes ago
          updatedAt: now - 1000 * 60 * 15,
        },
      ];

      render(<AssumptionCard {...defaultProps} votes={votes} />);

      const detailsButton = screen.getByRole('button', { name: /details/i });
      await user.click(detailsButton);

      expect(screen.getByText('vor 15 Minuten')).toBeInTheDocument();
    });
  });
});
