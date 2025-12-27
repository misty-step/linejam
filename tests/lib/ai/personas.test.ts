import { describe, it, expect } from 'vitest';
import {
  getPersona,
  pickRandomPersona,
  getAllPersonaIds,
  AiPersonaId,
} from '../../../convex/lib/ai/personas';

describe('AI Personas', () => {
  describe('getPersona', () => {
    it('returns bashō persona correctly', () => {
      const persona = getPersona('bashō');
      expect(persona.id).toBe('bashō');
      expect(persona.displayName).toBe('Bashō');
      expect(persona.tags).toContain('real-poet');
      expect(persona.prompt).toBeTruthy();
    });

    it('returns dickinson persona correctly', () => {
      const persona = getPersona('dickinson');
      expect(persona.id).toBe('dickinson');
      expect(persona.displayName).toBe('Emily');
      expect(persona.tags).toContain('real-poet');
    });

    it('returns chaotic-gremlin persona correctly', () => {
      const persona = getPersona('chaotic-gremlin');
      expect(persona.id).toBe('chaotic-gremlin');
      expect(persona.displayName).toBe('Gremlin');
      expect(persona.tags).toContain('chaotic');
    });

    it('throws for unknown persona', () => {
      expect(() => getPersona('unknown' as AiPersonaId)).toThrow(
        'Unknown persona: unknown'
      );
    });
  });

  describe('getAllPersonaIds', () => {
    it('returns all 6 personas', () => {
      const ids = getAllPersonaIds();
      expect(ids).toHaveLength(6);
      expect(ids).toContain('bashō');
      expect(ids).toContain('dickinson');
      expect(ids).toContain('cummings');
      expect(ids).toContain('chaotic-gremlin');
      expect(ids).toContain('overcaffeinated-pal');
      expect(ids).toContain('deadpan-oracle');
    });
  });

  describe('pickRandomPersona', () => {
    it('returns a valid persona', () => {
      const persona = pickRandomPersona();
      expect(persona.id).toBeTruthy();
      expect(persona.displayName).toBeTruthy();
      expect(persona.prompt).toBeTruthy();
      expect(getAllPersonaIds()).toContain(persona.id);
    });

    it('uses injected randomFn for deterministic selection', () => {
      // Value 0 % 6 = 0 -> first persona (bashō)
      const persona = pickRandomPersona(() => 0);
      expect(persona.id).toBe('bashō');
    });

    it('picks different personas based on random value', () => {
      // Value 1 % 6 = 1 -> second persona (dickinson)
      const persona = pickRandomPersona(() => 1);
      expect(persona.id).toBe('dickinson');
    });

    it('uses rejection sampling to avoid modulo bias', () => {
      // 6 personas, limit = floor(0xffffffff / 6) * 6 = 4294967292
      // Values >= 4294967292 should be rejected and retry
      let callCount = 0;
      const mockRandom = () => {
        callCount++;
        // First call returns value above limit (rejected), second returns valid value
        return callCount === 1 ? 0xffffffff : 2; // 2 % 6 = 2 -> cummings
      };

      const persona = pickRandomPersona(mockRandom);
      expect(callCount).toBe(2); // Had to retry once
      expect(persona.id).toBe('cummings');
    });

    it('throws after 100 failed attempts (bias detection)', () => {
      // Always return value above the rejection limit
      const alwaysAboveLimit = () => 0xffffffff;

      expect(() => pickRandomPersona(alwaysAboveLimit)).toThrow(
        'pickRandomPersona: Failed to generate unbiased random after 100 attempts'
      );
    });
  });
});
