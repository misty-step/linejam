import { describe, expect, it } from 'vitest';
import { linejamClerkAppearance } from '@/lib/clerk/appearance';

describe('Clerk appearance', () => {
  it('uses the Core 3 options key for social button layout', () => {
    expect(linejamClerkAppearance.options).toEqual({
      socialButtonsPlacement: 'top',
      socialButtonsVariant: 'blockButton',
    });
    expect(linejamClerkAppearance).not.toHaveProperty('layout');
  });
});
