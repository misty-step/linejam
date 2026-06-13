import { defineTheme } from '../schema';
import { substrateTokens } from './aesthetic';

/**
 * Kenya — re-expressed as the aesthetic substrate
 *
 * Kenya was always philosophically aesthetic: Ma (間), ink on paper,
 * one persimmon stamp, confident restraint. The design system now
 * carries all of that for real — ink registers, hairlines, the
 * steered persimmon accent — so Kenya's tokens point at the same
 * --ae-* substrate as the default theme.
 *
 * Kept as a separate id so stored preferences ('linejam-theme-id' =
 * 'kenya') keep resolving. The operator may collapse it into
 * 'aesthetic' entirely in a follow-up (see docs/adoption/PR_BODY.md).
 */
export const kenyaTheme = defineTheme({
  id: 'kenya',
  label: 'Kenya',
  description: 'The persimmon stamp — now the substrate itself',
  tokens: {
    light: substrateTokens,
    dark: substrateTokens,
  },
});
