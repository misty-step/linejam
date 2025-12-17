import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPrompt,
  generateLine,
  getFallbackLine,
  type LLMConfig,
} from '../../../convex/lib/ai/llm';

// Shared test persona
const bashoPersona = {
  id: 'bashō' as const,
  displayName: 'Bashō',
  prompt:
    'You write in the style of Matsuo Bashō. Use concrete imagery: frogs, ponds, cicadas.',
  tags: ['real-poet' as const],
};

// Default test config
const testConfig: LLMConfig = {
  provider: 'openrouter',
  model: 'google/gemini-2.5-flash',
  apiKey: 'test-api-key',
  timeoutMs: 10000,
  maxRetries: 3,
};

describe('LLM Provider', () => {
  describe('buildPrompt', () => {
    it('builds prompt for first line (no previous line)', () => {
      const prompt = buildPrompt({
        persona: bashoPersona,
        previousLineText: undefined,
        targetWordCount: 3,
      });

      expect(prompt).toContain('Matsuo Bashō');
      expect(prompt).toContain('EXACTLY 3 words');
      expect(prompt).toContain('FIRST line');
      expect(prompt).not.toContain('previous line');
    });

    it('builds prompt with previous line context', () => {
      const prompt = buildPrompt({
        persona: bashoPersona,
        previousLineText: 'moonlight falls softly',
        targetWordCount: 4,
      });

      expect(prompt).toContain('EXACTLY 4 words');
      expect(prompt).toContain('moonlight falls softly');
      expect(prompt).toContain('previous line');
    });

    it('includes strict requirements', () => {
      const prompt = buildPrompt({
        persona: bashoPersona,
        previousLineText: undefined,
        targetWordCount: 1,
      });

      expect(prompt).toContain('EXACTLY 1 word');
      expect(prompt).toContain('no quotes');
      expect(prompt).toContain('no explanation');
    });

    it('uses persona prompt in output', () => {
      const prompt = buildPrompt({
        persona: bashoPersona,
        previousLineText: undefined,
        targetWordCount: 5,
      });

      expect(prompt).toContain(bashoPersona.prompt);
    });
  });

  describe('getFallbackLine', () => {
    it('returns "silence" for word count 1', () => {
      expect(getFallbackLine(1)).toBe('silence');
    });

    it('returns "words linger" for word count 2', () => {
      expect(getFallbackLine(2)).toBe('words linger');
    });

    it('returns "the path continues" for word count 3', () => {
      expect(getFallbackLine(3)).toBe('the path continues');
    });

    it('returns "we write in circles" for word count 4', () => {
      expect(getFallbackLine(4)).toBe('we write in circles');
    });

    it('returns "the poem finds its way" for word count 5', () => {
      expect(getFallbackLine(5)).toBe('the poem finds its way');
    });

    it('returns 5-word fallback for unknown word count (defensive)', () => {
      expect(getFallbackLine(10)).toBe('the poem finds its way');
      expect(getFallbackLine(0)).toBe('the poem finds its way');
      expect(getFallbackLine(-1)).toBe('the poem finds its way');
    });
  });

  describe('generateLine', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns text when API returns correct word count', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              model: 'google/gemini-2.5-flash',
              choices: [
                {
                  message: { content: 'cherry blossoms fall' },
                  finish_reason: 'stop',
                },
              ],
            }),
        })
      );

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(result.text).toBe('cherry blossoms fall');
      expect(result.fallbackUsed).toBe(false);
    });

    it('retries when word count is wrong, succeeds on second attempt', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: { content: 'too many words here now' },
                  finish_reason: 'stop',
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: { content: 'three words work' },
                  finish_reason: 'stop',
                },
              ],
            }),
        });

      vi.stubGlobal('fetch', fetchMock);

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.text).toBe('three words work');
      expect(result.fallbackUsed).toBe(false);
    });

    it('uses fallback when API returns non-200', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
      );

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(result.text).toBe('the path continues');
      expect(result.fallbackUsed).toBe(true);
    });

    it('uses fallback when fetch throws network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(result.text).toBe('the path continues');
      expect(result.fallbackUsed).toBe(true);
    });

    it('uses fallback after 3 failed word count attempts', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: { content: 'always wrong word count here' },
                finish_reason: 'stop',
              },
            ],
          }),
      });

      vi.stubGlobal('fetch', fetchMock);

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.text).toBe('the path continues');
      expect(result.fallbackUsed).toBe(true);
    });

    it('handles empty response content', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '' }, finish_reason: 'stop' }],
            }),
        })
      );

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 1,
        },
        testConfig
      );

      expect(result.fallbackUsed).toBe(true);
    });

    it('handles missing choices in response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ choices: [] }),
        })
      );

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 2,
        },
        testConfig
      );

      expect(result.fallbackUsed).toBe(true);
    });

    it('sends correct request to OpenRouter API', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              { message: { content: 'one word' }, finish_reason: 'stop' },
            ],
          }),
      });

      vi.stubGlobal('fetch', fetchMock);

      await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 2,
        },
        testConfig
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
          signal: expect.any(AbortSignal),
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.model).toBe('google/gemini-2.5-flash');
      expect(callBody.temperature).toBe(0.9);
      expect(callBody.max_tokens).toBe(100);
    });

    it('respects custom timeout from config', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'test' }, finish_reason: 'stop' }],
          }),
      });

      vi.stubGlobal('fetch', fetchMock);

      const customConfig: LLMConfig = {
        ...testConfig,
        timeoutMs: 5000,
      };

      await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 1,
        },
        customConfig
      );

      // Verify AbortSignal was passed (timeout is set)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('respects custom maxRetries from config', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: { content: 'wrong count' },
                finish_reason: 'stop',
              },
            ],
          }),
      });

      vi.stubGlobal('fetch', fetchMock);

      const customConfig: LLMConfig = {
        ...testConfig,
        maxRetries: 2,
      };

      await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 1,
        },
        customConfig
      );

      // Should only retry twice
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('uses fallback on timeout (AbortError)', async () => {
      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      const result = await generateLine(
        {
          persona: bashoPersona,
          previousLineText: undefined,
          targetWordCount: 3,
        },
        testConfig
      );

      expect(result.text).toBe('the path continues');
      expect(result.fallbackUsed).toBe(true);
    });
  });
});
