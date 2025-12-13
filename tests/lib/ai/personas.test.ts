import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    let originalGetRandomValues: typeof crypto.getRandomValues;

    beforeEach(() => {
      originalGetRandomValues = crypto.getRandomValues;
    });

    afterEach(() => {
      crypto.getRandomValues = originalGetRandomValues;
    });

    it('returns a valid persona', () => {
      const persona = pickRandomPersona();
      expect(persona.id).toBeTruthy();
      expect(persona.displayName).toBeTruthy();
      expect(persona.prompt).toBeTruthy();
      expect(getAllPersonaIds()).toContain(persona.id);
    });

    it('uses crypto.getRandomValues for randomness', () => {
      // Mock crypto to always return 0 -> first persona
      crypto.getRandomValues = vi.fn((arr) => {
        if (arr instanceof Uint32Array) {
          arr[0] = 0;
        }
        return arr;
      });

      const persona = pickRandomPersona();
      expect(crypto.getRandomValues).toHaveBeenCalled();
      // First persona in the list
      expect(persona.id).toBe('bashō');
    });

    it('picks different personas based on random value', () => {
      // Mock crypto to return value that picks second persona
      crypto.getRandomValues = vi.fn((arr) => {
        if (arr instanceof Uint32Array) {
          arr[0] = 1; // 1 % 6 = 1 -> second persona
        }
        return arr;
      });

      const persona = pickRandomPersona();
      expect(persona.id).toBe('dickinson');
    });
  });
});
