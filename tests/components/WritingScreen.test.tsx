// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { cloneElement } from 'react';
import {
  WritingScreen,
  type WritingScreenDependencies,
} from '@/components/WritingScreen';
import type { WaitingScreenDependencies } from '@/components/WaitingScreen';
import type { Id } from '@/convex/_generated/dataModel';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { buildRoomQueryArgs } from '@/lib/roomQueryArgs';

const mockSubmitLineMutation = vi.fn();
const mockEndGameMutation = vi.fn();
const mockUseQuery = vi.fn();

const waitingScreenDependencies: WaitingScreenDependencies = {
  buildRoomQueryArgs,
  useRoundProgress: (args) => mockUseQuery('game:getRoundProgress', args),
  useEndGame: () => mockEndGameMutation,
};

const writingScreenDependencies: WritingScreenDependencies = {
  buildRoomQueryArgs,
  useCurrentAssignment: (args) =>
    mockUseQuery('game:getCurrentAssignment', args),
  useRoundProgress: (args) => mockUseQuery('game:getRoundProgress', args),
  useSubmitLine: () => mockSubmitLineMutation,
  waitingScreenDependencies,
};

function renderWritingScreen(
  ui: React.ReactElement<React.ComponentProps<typeof WritingScreen>>
) {
  return render(
    cloneElement(ui, {
      dependencies: writingScreenDependencies,
    })
  );
}

describe('WritingScreen component', () => {
  const setupUser = () => userEvent.setup();
  const flushTimers = async (ms: number) => {
    await act(async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, ms);
      await promise;
    });
  };
  const flushDebounce = () => flushTimers(600);
  const flushSubmitTransition = () => flushTimers(1600);

  // SAFETY: Synthetic assignment fixture for WritingScreen tests.
  const mockAssignment = {
    // SAFETY: Synthetic Convex poem ID for WritingScreen test fixture.
    poemId: 'poem_123' as Id<'poems'>,
    roomId: 'room_123',
    cycle: 1,
    lineIndex: 0, // First round, requires 1 word
    targetWordCount: 1,
    previousLineText: null,
    hasSubmitted: false,
  };

  const mockAssignmentRound5 = {
    // SAFETY: Synthetic Convex poem ID for WritingScreen test fixture.
    poemId: 'poem_456' as Id<'poems'>,
    roomId: 'room_456',
    cycle: 1,
    lineIndex: 4, // Fifth round, requires 5 words (peak of diamond)
    targetWordCount: 5,
    previousLineText: 'The moon rises silently tonight',
    hasSubmitted: false,
  };
  const mockRoundProgress = {
    round: 0,
    players: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockUseQuery.mockReset();
    mockSubmitLineMutation.mockReset();
    mockSubmitLineMutation.mockResolvedValue({
      status: 'committed',
      text: 'Word',
    });
    mockEndGameMutation.mockReset();
    mockEndGameMutation.mockResolvedValue({ abandoned: true });

    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'game:getRoundProgress') {
        return mockRoundProgress;
      }
      return mockAssignment;
    });
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the word counter visible in the composer flow', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    const wordSlots = document.getElementById('word-slots');
    expect(wordSlots).toBeInTheDocument();
  });

  it('declares the one-line 500-character mobile input contract', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    const textarea = screen.getByTestId(E2E_TEST_IDS.writingLineInput);
    expect(textarea).toHaveAttribute('maxlength', '500');
    expect(textarea).toHaveAttribute('inputmode', 'text');
    expect(textarea).toHaveAttribute('autocapitalize', 'sentences');
    expect(textarea).toHaveAttribute('autocorrect', 'on');
    expect(textarea).toHaveAttribute('enterkeyhint', 'done');
    expect(textarea).toHaveAttribute('wrap', 'soft');
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'one\ntwo' } });
    expect(textarea).toHaveValue('one two');
    expect(screen.getByText('7/500 characters')).toBeInTheDocument();
  });

  it('shows textarea with correct aria label for word count', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-label',
      'Write your line for round 1. Target: 1 word.'
    );
  });

  it('calls submitLine mutation with correct args on submit', async () => {
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Poetry');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    await waitFor(() => {
      expect(mockSubmitLineMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        lineIndex: 0,
        text: 'Poetry',
        guestToken: 'mock-token',
      });
    });
    await flushSubmitTransition();
  });

  it('shows error message when submission fails', async () => {
    mockSubmitLineMutation.mockRejectedValue(new Error('Network error'));
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Verse');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unable to connect/i)).toBeInTheDocument();
    });
    await flushDebounce();
  });

  it('shows "Submitting…" during submission', async () => {
    mockSubmitLineMutation.mockImplementation(() => {
      const { promise, resolve } = Promise.withResolvers<undefined>();
      setTimeout(resolve, 1000);
      return promise;
    });
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Word');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submitting/i })
      ).toBeInTheDocument();
    });
    await flushSubmitTransition();
  });

  it('shows word count validation via WordSlots', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByText('words')).toBeInTheDocument();
    const wordSlots = document.getElementById('word-slots');
    expect(wordSlots).toHaveAttribute('aria-label', '0 of 1 words');
  });

  it('shows the first-run writing coachmark inline without opening help', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(
      screen.getByText(/you only see one carried line/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/match the word slots/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not repeat the writing coachmark after this device has seen it', () => {
    localStorage.setItem('linejam:writing-coachmark-seen', '1');

    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(
      screen.queryByText(/you only see one carried line/i)
    ).not.toBeInTheDocument();
  });

  it('resets scroll when the active assignment changes', () => {
    const scrollToSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    let activeAssignment: typeof mockAssignment | typeof mockAssignmentRound5 =
      mockAssignment;

    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'game:getRoundProgress') {
        return mockRoundProgress;
      }
      return activeAssignment;
    });

    const { rerender } = renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });

    scrollToSpy.mockClear();
    activeAssignment = mockAssignmentRound5;
    rerender(
      <WritingScreen
        guestToken="mock-token"
        roomCode="ABCD"
        dependencies={writingScreenDependencies}
      />
    );

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
    scrollToSpy.mockRestore();
  });

  it('enforces correct round constraint (diamond pattern: 1,2,3,4,5,4,3,2,1)', async () => {
    mockUseQuery.mockReturnValue(mockAssignmentRound5);
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'One two three');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled();
    });

    await user.type(textarea, ' four five');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^Submit$/i })
      ).not.toBeDisabled();
    });
    await flushDebounce();
  });

  it('renders the loading state while the assignment query is unresolved', () => {
    mockUseQuery.mockReturnValue(undefined);

    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(
      screen.getByText(/Preparing your writing desk/i)
    ).toBeInTheDocument();
  });

  it('displays previous line when available', () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'game:getRoundProgress') {
        return mockRoundProgress;
      }
      return mockAssignmentRound5;
    });

    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(
      screen.getByText('The moon rises silently tonight')
    ).toBeInTheDocument();
    expect(screen.getByText('Received line')).toBeInTheDocument();
  });

  it('names the final-round reveal handoff after the last submission', async () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'game:getRoundProgress') return { round: 8, players: [] };
      return {
        ...mockAssignment,
        lineIndex: 8,
        targetWordCount: 1,
        isFinalRound: true,
        totalRounds: 9,
      };
    });
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Final');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    expect(await screen.findByText(/Last line sealed/i)).toBeInTheDocument();
    expect(screen.getByText(/Reveal is next/i)).toBeInTheDocument();
    await flushSubmitTransition();
  });

  it('owns the dynamic game viewport and reserves a non-overlapping action zone', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    const phase = screen.getByTestId(E2E_TEST_IDS.writingPhase);
    const submit = screen.getByTestId(E2E_TEST_IDS.writingSubmitLineButton);
    const actionZone = submit.parentElement;
    const composer = actionZone?.parentElement;
    const scrollRegion = screen.getByTestId(E2E_TEST_IDS.writingScrollRegion);

    expect(phase).toHaveClass('lj-game-frame');
    expect(phase).not.toHaveClass('overflow-hidden');
    expect(scrollRegion).toHaveClass(
      'min-h-0',
      'overflow-x-hidden',
      'overflow-y-auto'
    );
    expect(composer).toHaveClass(
      'grid',
      'grid-rows-[minmax(0,1fr)_minmax(0,auto)]'
    );
    expect(actionZone).toHaveClass('min-h-0', 'overflow-x-hidden');
    expect(actionZone).toHaveClass(
      'gap-[12px]',
      'pt-[12px]',
      'pb-[max(12px,env(safe-area-inset-bottom))]'
    );
    expect(actionZone).not.toHaveClass('flex-[0_1_auto]', 'flex-none');
    expect(actionZone).not.toHaveClass('fixed', 'sticky');
    expect(submit).toHaveClass(
      'h-[64px]',
      'w-full',
      'min-w-0',
      'max-w-[240px]',
      'md:h-[80px]',
      'md:w-auto',
      'md:min-w-[240px]'
    );
    expect(submit).not.toHaveClass(
      'h-auto',
      'min-h-[64px]',
      'min-w-[240px]',
      'py-[12px]'
    );
    expect(screen.getByRole('textbox')).toHaveClass(
      'min-w-0',
      'max-w-full',
      'overflow-x-hidden'
    );
  });

  it('updates word count as user types', async () => {
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Hello');
    await waitFor(() => {
      expect(document.getElementById('word-slots')).toHaveAttribute(
        'aria-label',
        '1 of 1 words'
      );
    });
    await flushDebounce();
  });

  it('preserves the draft when the browser goes offline', async () => {
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'Still here');
    act(() => window.dispatchEvent(new Event('offline')));

    expect(textarea).toHaveValue('Still here');
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBe('Still here');
  });

  it('normalizes a legacy multiline draft before rendering', () => {
    sessionStorage.setItem(
      'linejam:writing-draft:ABCD:poem_123:0',
      '  Recovered\nline  '
    );

    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByRole('textbox')).toHaveValue('Recovered line');
  });

  it('submit button disabled when word count is wrong', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled();
  });

  it('submit button enabled when word count is correct', async () => {
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Word');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^Submit$/i })
      ).not.toBeDisabled();
    });
    await flushDebounce();
  });

  it('shows a visible ready signal when the target word count is reached', async () => {
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Word');

    const submitButton = await screen.findByRole('button', {
      name: /^Submit$/i,
    });
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveAttribute('data-ready', 'true');
    expect(screen.getByText('Ready')).toBeInTheDocument();
    await flushDebounce();
  });

  it('submits guestToken as undefined when no guest session is established yet', async () => {
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = setupUser();
    render(
      <WritingScreen
        roomCode="ABCD"
        guestToken={null}
        dependencies={writingScreenDependencies}
      />
    );

    await user.type(screen.getByRole('textbox'), 'Poetry');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    await waitFor(() => {
      expect(mockSubmitLineMutation).toHaveBeenCalledWith({
        poemId: 'poem_123',
        lineIndex: 0,
        text: 'Poetry',
        guestToken: undefined,
      });
    });
    await flushSubmitTransition();
  });

  it('shows confirmation message after successful submit', async () => {
    mockSubmitLineMutation.mockResolvedValue(undefined);
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Beautiful');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your Line Submitted/i)).toBeInTheDocument();
      expect(screen.getByText(/\u201cBeautiful\u201d/)).toBeInTheDocument();
    });
    await flushSubmitTransition();
  });

  it('offers one safe retry and displays the stored line outcome', async () => {
    mockSubmitLineMutation
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        status: 'already_submitted',
        text: 'Stored line',
      });
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    await user.type(screen.getByRole('textbox'), 'Draft');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));
    const retry = await screen.findByRole('button', { name: /Retry once/i });
    await user.click(retry);

    await waitFor(() => {
      expect(mockSubmitLineMutation).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText(/Your line was already recorded/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Stored line/)).toBeInTheDocument();
    });
    await flushSubmitTransition();
  });

  it('renders WaitingScreen when no assignment', () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'game:getRoundProgress') return mockRoundProgress;
      return null;
    });

    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByText(/Ready|Others are writing/i)).toBeInTheDocument();
  });

  it('textarea has aria-invalid when word count is wrong', () => {
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('textarea has aria-invalid=false when word count is correct', async () => {
    const user = setupUser();
    renderWritingScreen(
      <WritingScreen guestToken="mock-token" roomCode="ABCD" />
    );
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'Perfect');
    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'false');
    });
    await flushDebounce();
  });

  describe('round-aware placeholders', () => {
    const renderRound = (lineIndex: number, targetWordCount: number) => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') return mockRoundProgress;
        return { ...mockAssignment, lineIndex, targetWordCount };
      });
      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );
    };

    it('shows "write one word…" for round 1 (singular)', () => {
      renderRound(0, 1);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write one word…'
      );
    });

    it('shows "write two words…" for round 2 (plural)', () => {
      renderRound(1, 2);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write two words…'
      );
    });

    it('shows "write five words…" for round 5 (peak of diamond)', () => {
      renderRound(4, 5);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write five words…'
      );
    });

    it('shows "write three words…" for round 3', () => {
      renderRound(2, 3);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write three words…'
      );
    });

    it('shows "write four words…" for round 4', () => {
      renderRound(3, 4);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write four words…'
      );
    });

    it('falls back to the numeral when target word count exceeds the known number words', () => {
      renderRound(5, 6);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'write 6 words…'
      );
    });
  });

  describe('live region announcements', () => {
    const getLiveRegion = (container: HTMLElement) =>
      container.querySelector('[aria-live="polite"][class*="sr-only"]');

    const renderTarget = (targetWordCount: number) => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') return mockRoundProgress;
        return { ...mockAssignment, targetWordCount };
      });
      return renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );
    };

    it('announces "Remove 1 word" when exactly 1 word over target', async () => {
      const user = setupUser();
      const { container } = renderTarget(1);
      await user.type(screen.getByRole('textbox'), 'Hello world');
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent('Remove 1 word');
    });

    it('announces "Remove X words" when multiple words over target', async () => {
      const user = setupUser();
      const { container } = renderTarget(1);
      await user.type(screen.getByRole('textbox'), 'One two three');
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent('Remove 2 words');
    });

    it('announces "Ready to submit" when word count is valid', async () => {
      const user = setupUser();
      const { container } = renderTarget(1);
      await user.type(screen.getByRole('textbox'), 'Poetry');
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent('Ready to submit');
    });

    it('announces "Add X words" when under target', async () => {
      const user = setupUser();
      const { container } = renderTarget(5);
      await user.type(screen.getByRole('textbox'), 'Two words');
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent('Add 3 words');
    });

    it('announces "Add 1 word" (singular) when exactly one word under target', async () => {
      const user = setupUser();
      const { container } = renderTarget(5);
      await user.type(screen.getByRole('textbox'), 'One two three four');
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent(/^Add 1 word$/);
    });

    it('keeps the live region silent before the player starts typing', async () => {
      const { container } = renderTarget(1);
      await flushDebounce();
      expect(getLiveRegion(container)).toHaveTextContent('');
    });
  });

  describe('draft autosaving', () => {
    it('restores the current assignment draft after a reload', () => {
      sessionStorage.setItem(
        'linejam:writing-draft:ABCD:poem_123:0',
        'Recovered'
      );

      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );

      expect(screen.getByRole('textbox')).toHaveValue('Recovered');
      expect(screen.getByText('Draft restored')).toBeInTheDocument();
    });

    it('keeps an in-progress line in session storage for reload recovery', async () => {
      const user = setupUser();
      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );

      await user.type(screen.getByRole('textbox'), 'Hello');

      expect(
        sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
      ).toBe('Hello');
    });

    it('clears the saved draft once Convex confirms the line', async () => {
      mockSubmitLineMutation.mockResolvedValue(undefined);
      sessionStorage.setItem(
        'linejam:writing-draft:ABCD:poem_123:0',
        'Recovered'
      );
      const user = setupUser();
      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );

      await user.click(screen.getByRole('button', { name: /^Submit$/i }));

      await waitFor(() => expect(mockSubmitLineMutation).toHaveBeenCalled());
      expect(
        sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
      ).toBeNull();
    });
  });

  describe('round transitions', () => {
    it('opens the waiting state when a submitted assignment reloads', () => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') {
          return {
            round: 0,
            players: [
              {
                stableId: 'stable_alice',
                displayName: 'Alice',
                submitted: true,
                userId: 'user_alice',
              },
              {
                stableId: 'stable_bob',
                displayName: 'Bob',
                submitted: false,
                userId: 'user_bob',
              },
            ],
          };
        }
        return { ...mockAssignment, hasSubmitted: true };
      });

      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" showChrome />
      );

      expect(screen.getByTestId(E2E_TEST_IDS.waitingPhase)).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('resets the draft when the assignment advances to the next round', async () => {
      const user = setupUser();
      const { rerender } = renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" />
      );
      const textarea = screen.getByRole('textbox');
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('Expected HTMLTextAreaElement');
      }

      await user.type(textarea, 'Word');
      expect(textarea.value).toBe('Word');

      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') {
          return { round: 1, players: [] };
        }
        return {
          ...mockAssignmentRound5,
          lineIndex: 1,
          targetWordCount: 2,
        };
      });

      rerender(
        <WritingScreen
          guestToken="mock-token"
          roomCode="ABCD"
          dependencies={writingScreenDependencies}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveAttribute(
          'aria-label',
          'Write your line for round 2. Target: 2 words.'
        );
        const nextTextarea = screen.getByRole('textbox');
        if (!(nextTextarea instanceof HTMLTextAreaElement)) {
          throw new Error('Expected HTMLTextAreaElement');
        }
        expect(nextTextarea.value).toBe('');
      });
    });
  });

  describe('room chrome', () => {
    it('shows the round chrome header above the composer when showChrome is set', () => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') {
          return mockRoundProgress;
        }
        return mockAssignment;
      });

      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" showChrome />
      );

      expect(screen.getByText('Round 1 · 1 word')).toBeInTheDocument();
    });

    it('names the final round in the chrome when showChrome is set', () => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') {
          return mockRoundProgress;
        }
        return {
          ...mockAssignment,
          lineIndex: 8,
          targetWordCount: 1,
          totalRounds: 9,
          isFinalRound: true,
        };
      });

      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" showChrome />
      );

      expect(screen.getByText('Last line · 1 word')).toBeInTheDocument();
    });

    it('shows the round chrome above the late-joiner waiting screen when showChrome is set', () => {
      mockUseQuery.mockImplementation((query: string) => {
        if (query === 'game:getRoundProgress') {
          return {
            round: 2,
            isCurrentUserSpectator: true,
            players: [
              { stableId: 'stable_alice', submitted: true },
              { stableId: 'stable_bob', submitted: false },
            ],
          };
        }
        return null;
      });

      renderWritingScreen(
        <WritingScreen guestToken="mock-token" roomCode="ABCD" showChrome />
      );

      expect(screen.getByText('Round 3 of 9')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 ready.')).toBeInTheDocument();
      expect(screen.getByText('Game in progress')).toBeInTheDocument();
      expect(
        screen.getByText(/You're watching this game/i)
      ).toBeInTheDocument();
      const waitingPhase = screen.getByTestId(E2E_TEST_IDS.waitingPhase);
      expect(waitingPhase).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
      expect(waitingPhase).not.toHaveClass('lj-game-viewport');
      expect(waitingPhase.parentElement).toHaveClass(
        'lj-game-frame',
        'lj-viewport-offset',
        'overflow-hidden'
      );
    });
  });
});
