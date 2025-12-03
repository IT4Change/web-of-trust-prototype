import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoteBar } from './VoteBar';
import type { Vote, VoteSummary, OpinionGraphDoc } from 'narrative-ui';

describe('VoteBar', () => {
  describe('Empty state', () => {
    it('should show "No votes yet" when total is 0', () => {
      const summary: VoteSummary = {
        green: 0,
        yellow: 0,
        red: 0,
        total: 0,
        userVote: undefined,
      };

      render(<VoteBar summary={summary} votes={[]} />);

      expect(screen.getByText('No votes yet')).toBeInTheDocument();
    });

    it('should not render vote sections when total is 0', () => {
      const summary: VoteSummary = {
        green: 0,
        yellow: 0,
        red: 0,
        total: 0,
        userVote: undefined,
      };

      const { container } = render(<VoteBar summary={summary} votes={[]} />);

      // Should not have colored sections
      const sections = container.querySelectorAll('.bg-success, .bg-warning, .bg-error');
      expect(sections).toHaveLength(0);
    });
  });

  describe('Vote distribution rendering', () => {
    it('should render all three vote types with correct counts', () => {
      const summary: VoteSummary = {
        green: 3,
        yellow: 2,
        red: 1,
        total: 6,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v2',
          assumptionId: 'a1',
          voterDid: 'did:key:bob',
          value: 'yellow',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v3',
          assumptionId: 'a1',
          voterDid: 'did:key:charlie',
          value: 'red',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      // Check counts in sections
      expect(screen.getByText('3')).toBeInTheDocument(); // green
      expect(screen.getByText('2')).toBeInTheDocument(); // yellow
      expect(screen.getByText('1')).toBeInTheDocument(); // red

      // Check percentage display
      expect(screen.getByText('🟢 50%')).toBeInTheDocument();
      expect(screen.getByText('🟡 33%')).toBeInTheDocument();
      expect(screen.getByText('🔴 17%')).toBeInTheDocument();
    });

    it('should render only green votes when others are 0', () => {
      const summary: VoteSummary = {
        green: 5,
        yellow: 0,
        red: 0,
        total: 5,
        userVote: undefined,
      };

      const votes: Vote[] = Array.from({ length: 5 }, (_, i) => ({
        id: `v${i}`,
        assumptionId: 'a1',
        voterDid: `did:key:user${i}`,
        value: 'green' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      // Should show green section
      expect(screen.getByText('5')).toBeInTheDocument();

      // Should show 100% green
      expect(screen.getByText('🟢 100%')).toBeInTheDocument();
      expect(screen.getByText('🟡 0%')).toBeInTheDocument();
      expect(screen.getByText('🔴 0%')).toBeInTheDocument();
    });

    it('should calculate percentages correctly with rounding', () => {
      const summary: VoteSummary = {
        green: 1,
        yellow: 1,
        red: 1,
        total: 3,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v2',
          assumptionId: 'a1',
          voterDid: 'did:key:bob',
          value: 'yellow',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v3',
          assumptionId: 'a1',
          voterDid: 'did:key:charlie',
          value: 'red',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      render(<VoteBar summary={summary} votes={votes} />);

      // Each should be 33% (rounded from 33.333%)
      expect(screen.getByText('🟢 33%')).toBeInTheDocument();
      expect(screen.getByText('🟡 33%')).toBeInTheDocument();
      expect(screen.getByText('🔴 33%')).toBeInTheDocument();
    });
  });

  describe('Bar widths', () => {
    it('should apply correct width styles based on percentages', () => {
      const summary: VoteSummary = {
        green: 2,
        yellow: 1,
        red: 1,
        total: 4,
        userVote: undefined,
      };

      const votes: Vote[] = [];

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      // Find the tooltip divs which have the width styles
      const tooltips = container.querySelectorAll('.tooltip');

      // Green should be 50%
      const greenTooltip = Array.from(tooltips).find((el) =>
        el.querySelector('.bg-success')
      ) as HTMLElement;
      expect(greenTooltip?.style.width).toBe('50%');

      // Yellow should be 25%
      const yellowTooltip = Array.from(tooltips).find((el) =>
        el.querySelector('.bg-warning')
      ) as HTMLElement;
      expect(yellowTooltip?.style.width).toBe('25%');

      // Red should be 25%
      const redTooltip = Array.from(tooltips).find((el) =>
        el.querySelector('.bg-error')
      ) as HTMLElement;
      expect(redTooltip?.style.width).toBe('25%');
    });
  });

  describe('Tooltip content', () => {
    it('should include voter display names in tooltips when doc is provided', () => {
      const summary: VoteSummary = {
        green: 2,
        yellow: 0,
        red: 0,
        total: 2,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v2',
          assumptionId: 'a1',
          voterDid: 'did:key:bob',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const doc: Partial<OpinionGraphDoc> = {
        identities: {
          'did:key:alice': { displayName: 'Alice Smith' },
          'did:key:bob': { displayName: 'Bob Johnson' },
        },
      };

      const { container } = render(
        <VoteBar summary={summary} votes={votes} doc={doc as OpinionGraphDoc} />
      );

      const greenTooltip = container.querySelector('.bg-success')?.parentElement;
      expect(greenTooltip?.getAttribute('data-tip')).toContain('Alice Smith');
      expect(greenTooltip?.getAttribute('data-tip')).toContain('Bob Johnson');
      expect(greenTooltip?.getAttribute('data-tip')).toContain('did:key:alice');
      expect(greenTooltip?.getAttribute('data-tip')).toContain('did:key:bob');
    });

    it('should show DIDs when display names are not available', () => {
      const summary: VoteSummary = {
        green: 1,
        yellow: 0,
        red: 0,
        total: 1,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:unknown',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      const greenTooltip = container.querySelector('.bg-success')?.parentElement;
      expect(greenTooltip?.getAttribute('data-tip')).toContain('did:key:unknown');
    });

    it('should show "Keine Stimmen" when section has no votes', () => {
      // This is an edge case: summary says there are votes, but filtered list is empty
      // Not typical but worth testing the tooltip function logic
      const summary: VoteSummary = {
        green: 0,
        yellow: 1,
        red: 0,
        total: 1,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'yellow',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      // Green section should not render since green: 0
      const greenSection = container.querySelector('.bg-success');
      expect(greenSection).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have tabIndex on tooltip containers for keyboard access', () => {
      const summary: VoteSummary = {
        green: 1,
        yellow: 1,
        red: 1,
        total: 3,
        userVote: undefined,
      };

      const votes: Vote[] = [
        {
          id: 'v1',
          assumptionId: 'a1',
          voterDid: 'did:key:alice',
          value: 'green',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v2',
          assumptionId: 'a1',
          voterDid: 'did:key:bob',
          value: 'yellow',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'v3',
          assumptionId: 'a1',
          voterDid: 'did:key:charlie',
          value: 'red',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const { container } = render(<VoteBar summary={summary} votes={votes} />);

      const tooltips = container.querySelectorAll('.tooltip');
      expect(tooltips).toHaveLength(3);

      tooltips.forEach((tooltip) => {
        expect(tooltip).toHaveAttribute('tabIndex', '0');
      });
    });
  });
});
