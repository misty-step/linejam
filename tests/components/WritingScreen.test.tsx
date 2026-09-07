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
import type { RoomQueryArgs } from '@/hooks/useRoomQueryArgs';

type MockQueryArgs = RoomQueryArgs | 'skip';

const mockSubmitLineMutation = vi.fn();
const mockEndGameMutation = vi.fn();
const mockUseQuery = vi.fn();

const mockUseRoomQueryArgs: WritingScreenDependencies['useRoomQueryArgs'] = (
  roomCode,
  propToken
) => {
  const guestToken = propToken ?? 'mock-token';
  return {
    guestToken,
    shouldSkip: false,
    queryArgs: { roomCode, guestToken },
  };
};

const waitingScreenDependencies: WaitingScreenDependencies = {
  useRoomQueryArgs: mockUseRoomQueryArgs,
  useRoundProgress: (args) => mockUseQuery('game:getRoundProgress', args),
  useEndGame: () => mockEndGameMutation,
};

const writingScreenDependencies: WritingScreenDependencies = {
  useRoomQueryArgs: mockUseRoomQueryArgs,
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

    mockUseQuery.mockImplementation((query: string, args: MockQueryArgs) => {
      if (args === 'skip') return undefined;
      if (query === 'game:getRoundProgress') {
        return mockRoundProgress;
      }
      return mockAssignment;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps pasted and typed input on a single editable line', async () => {
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'one\ntwo' } });
    expect(textarea).toHaveValue('one two');

    await user.type(textarea, '{Enter} tail');

    expect(textarea).toHaveValue('one two tail');
  });

  it('preserves an uncertain draft offline and offers recovery after its only retry fails', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mockSubmitLineMutation.mockRejectedValue(new Error('Network error'));
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);

    await user.type(screen.getByRole('textbox'), 'Verse');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    const disconnectedRetry = await screen.findByRole('button', {
      name: /waiting for connection/i,
    });
    expect(disconnectedRetry).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveValue('Verse');
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBe('Verse');
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled();
    await user.click(disconnectedRetry);
    expect(mockSubmitLineMutation).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event('online')));
    const retry = screen.getByRole('button', { name: /retry once/i });
    expect(retry).toBeEnabled();
    await user.click(retry);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/reload.*reconnect/i);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/draft.*saved/i);
    expect(
      screen.queryByRole('button', { name: /retry|waiting for connection/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Verse');
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBe('Verse');
    const failedSubmit = screen.getByRole('button', {
      name: /unable to confirm/i,
    });
    expect(failedSubmit).toBeDisabled();
    await user.click(failedSubmit);
    expect(mockSubmitLineMutation).toHaveBeenCalledTimes(2);
  });

  it('waits for server acknowledgement before showing the waiting state', async () => {
    const pending = Promise.withResolvers<{
      status: 'committed';
      text: string;
    }>();
    mockSubmitLineMutation.mockReturnValue(pending.promise);
    mockUseQuery.mockImplementation((query: string) =>
      query === 'game:getCurrentAssignment' ? mockAssignment : undefined
    );
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    await user.type(screen.getByRole('textbox'), 'Word');
    await user.click(screen.getByTestId(E2E_TEST_IDS.writingSubmitLineButton));
    expect(
      screen.getByTestId(E2E_TEST_IDS.writingSubmitLineButton)
    ).toBeDisabled();
    expect(
      screen.queryByTestId(E2E_TEST_IDS.waitingPhase)
    ).not.toBeInTheDocument();
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBe('Word');
    await act(async () =>
      pending.resolve({ status: 'committed', text: 'Word' })
    );
    expect(
      await screen.findByTestId(E2E_TEST_IDS.waitingPhase)
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/your line is in/i);
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy', 'true');
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBeNull();
  });

  it('keeps the round target, visible counter and accessible guidance in sync while editing', async () => {
    mockUseQuery.mockImplementation((query: string) =>
      query === 'game:getCurrentAssignment'
        ? mockAssignmentRound5
        : mockRoundProgress
    );
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox', {
      name: /round 5\. Target: 5 words\./i,
    });
    const submit = screen.getByRole('button', { name: /^Submit$/i });
    const guidance = screen.getByRole('status', { name: '' });

    expect(screen.getByText('Round 5 of 9')).toBeInTheDocument();
    expect(
      screen.getByText(mockAssignmentRound5.previousLineText)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: '0 of 5 words' })
    ).toHaveTextContent('0 / 5');
    expect(submit).toBeDisabled();

    await user.type(textarea, 'One two three');
    expect(
      screen.getByRole('status', { name: '3 of 5 words' })
    ).toHaveTextContent('3 / 5');
    expect(textarea).toHaveAccessibleDescription(/3\s*\/\s*5\s*words/);
    expect(submit).toBeDisabled();
    await waitFor(() => expect(guidance).toHaveTextContent(/add 2 words/i));

    await user.type(textarea, ' four');
    await waitFor(() => expect(guidance).toHaveTextContent(/add 1 word\b/i));

    await user.type(textarea, ' five');
    expect(
      screen.getByRole('status', { name: '5 of 5 words' })
    ).toHaveTextContent('5 / 5');
    expect(submit).toBeEnabled();
    expect(textarea).toHaveAttribute('aria-invalid', 'false');
    await waitFor(() => expect(guidance).toHaveTextContent(/ready to submit/i));

    await user.type(textarea, ' extra');
    expect(
      screen.getByRole('status', { name: '6 of 5 words' })
    ).toHaveTextContent('6 / 5');
    expect(textarea).toHaveAccessibleDescription(/6\s*\/\s*5\s*words/);
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(submit).toBeDisabled();
    await waitFor(() => expect(guidance).toHaveTextContent(/remove 1 word\b/i));

    await user.type(textarea, ' words');
    await waitFor(() => expect(guidance).toHaveTextContent(/remove 2 words/i));

    await user.clear(textarea);
    expect(
      screen.getByRole('status', { name: '0 of 5 words' })
    ).toHaveTextContent('0 / 5');
    expect(textarea).toHaveAttribute('aria-invalid', 'false');
    expect(submit).toBeDisabled();
    await waitFor(() => expect(guidance).toBeEmptyDOMElement());
  });

  it('uses a singular target label for a one-word round and enables submission at that target', async () => {
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox', {
      name: /round 1\. Target: 1 word\./i,
    });

    await user.type(textarea, 'Hello');

    expect(
      screen.getByRole('status', { name: '1 of 1 words' })
    ).toHaveTextContent('1 / 1');
    expect(textarea).toHaveAccessibleDescription(/1\s*\/\s*1\s*word/);
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeEnabled();
  });

  it('warns near the character limit and stops input at 500 characters', async () => {
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.paste('a'.repeat(449));
    expect(screen.queryByText(/\/500 characters/i)).not.toBeInTheDocument();

    await user.type(textarea, 'b');
    expect(screen.getByText('450/500 characters')).toBeInTheDocument();

    await user.type(textarea, 'c'.repeat(51));
    expect(textarea).toHaveValue(`${'a'.repeat(449)}b${'c'.repeat(50)}`);
    expect(screen.getByText('500/500 characters')).toBeInTheDocument();
  });

  it('preserves the draft when the browser goes offline', async () => {
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);
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

    renderWritingScreen(<WritingScreen roomCode="ABCD" />);

    expect(screen.getByRole('textbox')).toHaveValue('Recovered line');
  });

  it('resolves an uncertain submission through one idempotent retry', async () => {
    mockSubmitLineMutation
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        status: 'already_submitted',
        text: 'Stored line',
      });
    const user = setupUser();
    renderWritingScreen(<WritingScreen roomCode="ABCD" />);

    await user.type(screen.getByRole('textbox'), 'Draft');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));
    const retry = await screen.findByRole('button', { name: /Retry once/i });
    expect(screen.getAllByRole('button', { name: /Retry once/i })).toHaveLength(
      1
    );
    expect(screen.getByRole('textbox')).toHaveValue('Draft');
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(retry).toBeDisabled();
    await user.click(retry);
    expect(mockSubmitLineMutation).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('online')));
    expect(retry).toBeEnabled();
    await user.click(retry);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /line was already recorded/i })
      ).toBeInTheDocument();
    });
    expect(mockSubmitLineMutation.mock.calls).toEqual([
      [
        {
          poemId: mockAssignment.poemId,
          lineIndex: 0,
          text: 'Draft',
          guestToken: 'mock-token',
        },
      ],
      [
        {
          poemId: mockAssignment.poemId,
          lineIndex: 0,
          text: 'Draft',
          guestToken: 'mock-token',
        },
      ],
    ]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
    ).toBeNull();
  });

  it('submits a normalized line for the assigned round without a guest token for a signed-in player', async () => {
    const useSignedInRoomArgs: WritingScreenDependencies['useRoomQueryArgs'] = (
      roomCode
    ) => ({
      guestToken: null,
      shouldSkip: false,
      queryArgs: { roomCode },
    });
    const assignment = {
      ...mockAssignmentRound5,
      // SAFETY: Synthetic Convex room id fixture for WritingScreen tests.
      roomId: mockAssignmentRound5.roomId as Id<'rooms'>,
      lineIndex: 7,
      targetWordCount: 2 as const,
      totalRounds: 9,
      isFinalRound: false,
      roundStartedAt: Date.now(),
      previousLineText: mockAssignmentRound5.previousLineText ?? undefined,
    };
    mockSubmitLineMutation.mockResolvedValue({
      status: 'committed',
      text: 'Moon rises',
    });
    const user = setupUser();
    render(
      <WritingScreen
        roomCode="ABCD"
        showChrome
        dependencies={{
          ...writingScreenDependencies,
          useRoomQueryArgs: useSignedInRoomArgs,
          useCurrentAssignment: () => assignment,
          waitingScreenDependencies: {
            ...waitingScreenDependencies,
            useRoomQueryArgs: useSignedInRoomArgs,
          },
        }}
      />
    );
    const textarea = screen.getByRole('textbox', {
      name: /round 8\. Target: 2 words\./i,
    });
    expect(
      screen.getByRole('heading', { name: 'Round 8 of 9' })
    ).toBeInTheDocument();
    await user.type(textarea, '  Moon   rises  ');
    await user.click(screen.getByRole('button', { name: /^Submit$/i }));

    expect(
      await screen.findByRole('heading', { name: /your line is in/i })
    ).toBeInTheDocument();
    expect(mockSubmitLineMutation).toHaveBeenCalledExactlyOnceWith({
      poemId: assignment.poemId,
      lineIndex: 7,
      text: 'Moon rises',
      guestToken: undefined,
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('waits for room credentials before showing a composer', () => {
    const { rerender } = render(
      <WritingScreen
        roomCode="ABCD"
        dependencies={{
          ...writingScreenDependencies,
          useRoomQueryArgs: () => ({
            guestToken: null,
            shouldSkip: true,
            queryArgs: 'skip',
          }),
        }}
      />
    );

    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Submit$/i })
    ).not.toBeInTheDocument();

    rerender(
      <WritingScreen roomCode="ABCD" dependencies={writingScreenDependencies} />
    );
    expect(
      screen.getByRole('textbox', { name: /round 1\. Target: 1 word\./i })
    ).toHaveValue('');
    expect(
      screen.queryByRole('status', { busy: true })
    ).not.toBeInTheDocument();
  });

  it('keeps the composer hidden until the assignment arrives', () => {
    mockUseQuery.mockImplementation((query: string) =>
      query === 'game:getCurrentAssignment' ? undefined : mockRoundProgress
    );
    const { rerender } = renderWritingScreen(<WritingScreen roomCode="ABCD" />);

    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Submit$/i })
    ).not.toBeInTheDocument();

    mockUseQuery.mockImplementation((query: string) =>
      query === 'game:getCurrentAssignment'
        ? mockAssignmentRound5
        : mockRoundProgress
    );
    rerender(
      <WritingScreen roomCode="ABCD" dependencies={writingScreenDependencies} />
    );
    expect(
      screen.getByRole('textbox', { name: /round 5\. Target: 5 words\./i })
    ).toHaveValue('');
    expect(
      screen.queryByRole('status', { busy: true })
    ).not.toBeInTheDocument();
  });

  it('waits for the roster without exposing a composer when there is no assignment', () => {
    let rosterLoaded = false;
    mockUseQuery.mockImplementation((query: string, args: MockQueryArgs) => {
      if (args === 'skip') return undefined;
      if (query === 'game:getCurrentAssignment') return null;
      return rosterLoaded
        ? {
            round: 2,
            players: [
              {
                userId: 'alice',
                stableId: 'alice',
                displayName: 'Alice',
                submitted: false,
              },
            ],
          }
        : null;
    });
    const { rerender } = renderWritingScreen(<WritingScreen roomCode="ABCD" />);
    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rosterLoaded = true;
    rerender(
      <WritingScreen roomCode="ABCD" dependencies={writingScreenDependencies} />
    );

    expect(
      screen.getByRole('list', { name: 'Players this round' })
    ).toHaveTextContent('Alice');
    expect(screen.getByText('Writing')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Submit$/i })
    ).not.toBeInTheDocument();
  });

  it('shows a late joiner the spectator waiting state and current round instead of a composer', () => {
    mockUseQuery.mockImplementation((query: string) =>
      query === 'game:getCurrentAssignment'
        ? null
        : {
            round: 5,
            totalRounds: 9,
            isCurrentUserSpectator: true,
            players: [
              {
                userId: 'late',
                stableId: 'late',
                displayName: 'Late poet',
                submitted: false,
                isSpectator: true,
              },
            ],
          }
    );
    renderWritingScreen(<WritingScreen roomCode="ABCD" showChrome />);

    expect(
      screen.getByRole('heading', { name: /next game/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Round 6 of 9' })
    ).toBeInTheDocument();
    expect(screen.getByText('Late poet')).toBeInTheDocument();
    expect(screen.getByText('Watching')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Submit$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /your line is in/i })
    ).not.toBeInTheDocument();
  });

  describe('draft autosaving', () => {
    it('restores the current assignment draft after a reload', () => {
      sessionStorage.setItem(
        'linejam:writing-draft:ABCD:poem_123:0',
        'Recovered'
      );

      renderWritingScreen(<WritingScreen roomCode="ABCD" />);

      expect(screen.getByRole('textbox')).toHaveValue('Recovered');
      expect(screen.getByText('Draft restored')).toBeInTheDocument();
    });

    it('keeps an in-progress line in session storage for reload recovery', async () => {
      const user = setupUser();
      renderWritingScreen(<WritingScreen roomCode="ABCD" />);

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
      sessionStorage.setItem(
        'linejam:writing-draft:ABCD:poem_456:4',
        'Another assignment has its draft'
      );
      const user = setupUser();
      renderWritingScreen(<WritingScreen roomCode="ABCD" />);

      await user.click(screen.getByRole('button', { name: /^Submit$/i }));

      expect(
        await screen.findByTestId(E2E_TEST_IDS.waitingPhase)
      ).toBeInTheDocument();
      expect(
        sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
      ).toBeNull();
      expect(
        sessionStorage.getItem('linejam:writing-draft:ABCD:poem_456:4')
      ).toBe('Another assignment has its draft');
    });
  });

  describe('round transitions', () => {
    it('opens the waiting state when a submitted assignment reloads', () => {
      sessionStorage.setItem(
        'linejam:writing-draft:ABCD:poem_123:0',
        'Stale draft'
      );
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

      renderWritingScreen(<WritingScreen roomCode="ABCD" showChrome />);

      expect(screen.getByTestId(E2E_TEST_IDS.waitingPhase)).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(
        sessionStorage.getItem('linejam:writing-draft:ABCD:poem_123:0')
      ).toBeNull();
    });

    it('keeps drafts isolated by poem and round as assignments change', async () => {
      let assignment = mockAssignment;
      mockUseQuery.mockImplementation((query: string) =>
        query === 'game:getCurrentAssignment' ? assignment : mockRoundProgress
      );
      const user = setupUser();
      const { rerender } = renderWritingScreen(
        <WritingScreen roomCode="ABCD" />
      );
      const refreshAssignment = () =>
        rerender(
          <WritingScreen
            roomCode="ABCD"
            dependencies={writingScreenDependencies}
          />
        );

      await user.type(screen.getByRole('textbox'), 'Word');

      assignment = {
        ...mockAssignment,
        lineIndex: 1,
        targetWordCount: 2,
      };
      refreshAssignment();
      expect(
        screen.getByRole('textbox', { name: /round 2\. Target: 2 words\./i })
      ).toHaveValue('');
      await user.type(screen.getByRole('textbox'), 'Two words');

      assignment = { ...assignment, poemId: mockAssignmentRound5.poemId };
      refreshAssignment();
      expect(screen.getByRole('textbox')).toHaveValue('');
      await user.type(screen.getByRole('textbox'), 'Other poem');

      assignment = { ...assignment, poemId: mockAssignment.poemId };
      refreshAssignment();
      expect(screen.getByRole('textbox')).toHaveValue('Two words');

      assignment = mockAssignment;
      refreshAssignment();
      expect(
        screen.getByRole('textbox', { name: /round 1\. Target: 1 word\./i })
      ).toHaveValue('Word');
    });
  });
});
