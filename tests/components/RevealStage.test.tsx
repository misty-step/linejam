// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { RevealStage } from '@/components/stage/RevealStage';
import { Id } from '@/convex/_generated/dataModel';

const poems = [
  {
    _id: 'poem_old' as Id<'poems'>,
    indexInRoom: 0,
    readerName: 'Older Reader',
    readerStableId: 'stable_old',
    isRevealed: true,
  },
  {
    _id: 'poem_latest' as Id<'poems'>,
    indexInRoom: 1,
    readerName: 'Latest Reader',
    readerStableId: 'stable_latest',
    isRevealed: true,
  },
];

describe('RevealStage', () => {
  it('uses the earliest poem in running order when the host has no assigned poem', async () => {
    const user = userEvent.setup();

    render(
      <RevealStage
        poems={poems}
        myPoems={[]}
        revealedPoems={[
          {
            ...poems[0],
            preview: 'Old first line',
            lines: [{ text: 'Old', authorName: 'Older Reader' }],
          },
          {
            ...poems[1],
            preview: 'Latest first line',
            revealedAt: 3000,
            lines: [
              { text: 'Latest', authorName: 'Latest Reader' },
              { text: 'Second line', authorName: 'Older Reader' },
            ],
          },
        ]}
        allStableIds={['stable_old', 'stable_latest']}
        error={null}
        isRevealingId={null}
        onExit={vi.fn()}
        onRevealPoem={vi.fn()}
      />
    );

    const stage = screen.getByTestId('reveal-presentation-stage');
    expect(
      within(stage).getByRole('heading', {
        name: /Older Reader reads Poem 01/i,
      })
    ).toBeInTheDocument();

    await user.click(
      within(stage).getByRole('button', { name: /Read on stage/i })
    );

    expect(within(stage).getByText('Old')).toBeInTheDocument();
    expect(within(stage).queryByText('Latest')).not.toBeInTheDocument();
  });

  it('shows AI reader context, error feedback, and disabled reveal state', () => {
    const assignedPoem = {
      _id: 'poem_ai' as Id<'poems'>,
      indexInRoom: 0,
      readerName: 'Human Reader',
      readerStableId: 'stable_human',
      preview: 'Machine poem opens',
      isRevealed: false,
      isForAi: true,
      aiPersonaName: 'Gemini',
      lines: [{ text: 'One', authorName: 'Human Reader' }],
    };

    render(
      <RevealStage
        poems={[assignedPoem]}
        myPoems={[assignedPoem]}
        revealedPoems={[]}
        allStableIds={['stable_human']}
        error="Reveal failed"
        isRevealingId={assignedPoem._id}
        onExit={vi.fn()}
        onRevealPoem={vi.fn()}
      />
    );

    expect(screen.getByText('Read for Gemini')).toBeInTheDocument();
    expect(screen.getByText('Reveal failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unsealing/i })).toBeDisabled();
  });

  it('labels a fallback reveal without pretending the poem was reassigned', () => {
    const onRevealPoem = vi.fn().mockResolvedValue(undefined);
    const fallbackPoem = {
      _id: 'poem_fallback' as Id<'poems'>,
      indexInRoom: 0,
      readerName: 'Reader Away',
      readerStableId: 'stable_away',
      preview: 'Someone keeps the circle moving',
      isRevealed: false,
      isFallbackReader: true,
      lines: [{ text: 'Someone', authorName: 'Host' }],
    };

    render(
      <RevealStage
        poems={[fallbackPoem]}
        myPoems={[fallbackPoem]}
        revealedPoems={[]}
        allStableIds={['stable_away']}
        error={null}
        isRevealingId={null}
        onExit={vi.fn()}
        onRevealPoem={onRevealPoem}
      />
    );

    expect(screen.getByText('Step in for Reader Away')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Step in on stage' })
    ).toBeInTheDocument();
  });

  it('renders an empty stage state when no poems are ready', () => {
    render(
      <RevealStage
        poems={[]}
        myPoems={[]}
        revealedPoems={[]}
        allStableIds={[]}
        error={null}
        isRevealingId={null}
        onExit={vi.fn()}
        onRevealPoem={vi.fn()}
      />
    );

    expect(
      screen.getByText('No poems are ready for reveal yet.')
    ).toBeInTheDocument();
  });
});
