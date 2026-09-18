import type { DesignTokens } from './types';

type ContrastRequirement = {
  foreground: keyof DesignTokens;
  background: keyof DesignTokens;
  minimum: number;
  label: string;
};

/** Semantic pairs rendered by shipped UI and generated artifacts. */
export const DESIGN_CONTRAST_REQUIREMENTS = [
  {
    foreground: 'color-text-primary',
    background: 'color-background',
    minimum: 4.5,
    label: 'body text on the app background',
  },
  {
    foreground: 'color-text-primary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'body text on elevated surfaces',
  },
  {
    foreground: 'color-text-secondary',
    background: 'color-background',
    minimum: 4.5,
    label: 'secondary text on the app background',
  },
  {
    foreground: 'color-text-secondary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'secondary text on elevated surfaces',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-background',
    minimum: 4.5,
    label: 'muted text on the app background',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-surface',
    minimum: 4.5,
    label: 'muted text on elevated surfaces',
  },
  {
    foreground: 'color-text-muted',
    background: 'color-muted',
    minimum: 4.5,
    label: 'muted text on muted controls',
  },
  {
    foreground: 'color-primary',
    background: 'color-background',
    minimum: 4.5,
    label: 'primary links on the app background',
  },
  {
    foreground: 'color-primary',
    background: 'color-surface',
    minimum: 4.5,
    label: 'primary links on elevated surfaces',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary',
    minimum: 4.5,
    label: 'primary action label',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary-hover',
    minimum: 4.5,
    label: 'primary action label on hover',
  },
  {
    foreground: 'color-text-inverse',
    background: 'color-primary-active',
    minimum: 4.5,
    label: 'primary action label while pressed',
  },
  {
    foreground: 'color-focus-ring',
    background: 'color-background',
    minimum: 3,
    label: 'focus ring on the app background',
  },
  {
    foreground: 'color-focus-ring',
    background: 'color-surface',
    minimum: 3,
    label: 'focus ring on elevated surfaces',
  },
  {
    foreground: 'color-success',
    background: 'color-background',
    minimum: 4.5,
    label: 'success status text on the app background',
  },
  {
    foreground: 'color-error',
    background: 'color-background',
    minimum: 4.5,
    label: 'error status text on the app background',
  },
  {
    foreground: 'color-warning',
    background: 'color-background',
    minimum: 4.5,
    label: 'warning status text on the app background',
  },
  {
    foreground: 'color-info',
    background: 'color-background',
    minimum: 4.5,
    label: 'info status text on the app background',
  },
  {
    foreground: 'color-success',
    background: 'color-surface',
    minimum: 4.5,
    label: 'success status text on elevated surfaces',
  },
  {
    foreground: 'color-error',
    background: 'color-surface',
    minimum: 4.5,
    label: 'error status text on elevated surfaces',
  },
  {
    foreground: 'color-warning',
    background: 'color-surface',
    minimum: 4.5,
    label: 'warning status text on elevated surfaces',
  },
  {
    foreground: 'color-info',
    background: 'color-surface',
    minimum: 4.5,
    label: 'info status text on elevated surfaces',
  },
] as const satisfies readonly ContrastRequirement[];
