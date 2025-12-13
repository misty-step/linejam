import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../../convex/lib/ai/gemini';

describe('Gemini Line Generator', () => {
  describe('buildPrompt', () => {
    const bashoPersona = {
      id: 'bashō' as const,
      displayName: 'Bashō',
      prompt:
        'You write in the style of Matsuo Bashō. Use concrete imagery: frogs, ponds, cicadas.',
      tags: ['real-poet' as const],
    };

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
});
