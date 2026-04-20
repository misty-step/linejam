# Apollo-Specific Accessibility Gotchas

These are failure modes specific to the Adminifi Apollo codebase that generic
accessibility skills miss. Read this before auditing or remediating.

## Architecture

Apollo has **two frontends**:

- **Web App** (`/web`) — Remix v2, admin dashboard, 56 Radix UI components
- **Consumer Portal** (`/consumer-portal`) — React Router v7, public-facing, 22 UI components

Both use: Radix UI primitives, TailwindCSS, React Hook Form + Zod, Clerk auth.

Changes to shared patterns (forms, tables, buttons) must be applied to BOTH apps.

## Gotchas

### 1. Radix Dialog focus restoration is broken

`/web/app/components/ui/dialog.tsx` has `onCloseAutoFocus={(e) => e.preventDefault()}`
which kills Radix's default focus restoration. Fix: remove the `preventDefault()` or
explicitly focus the trigger element.

### 2. Radix portals escape jsdom

Radix renders popovers, tooltips, dropdowns, and dialogs via React portals. These
render outside the component tree. `vitest-axe` in jsdom may miss portal content.
**Always verify portal-based components with Playwright**, not just unit tests.

### 3. Formation wizard's fixed header obscures focus

The formation wizard (`/web/app/routes/_app.tasks.wizard/route.tsx`) has a fixed
120px header. Focused elements below it can be hidden. This violates WCAG 2.4.11
(Focus Not Obscured). Fix: add `scroll-margin-top: 120px` to focusable elements,
or ensure the wizard scrolls focused elements into view.

### 4. Terminology system makes labels dynamic

The `useTerminology()` hook + `t("places.level_1")` pattern means visible text is
dynamic per organization. Verify that:

- `aria-label` values use terminology too (or are term-agnostic)
- Alt text doesn't hardcode domain terms
- Form labels remain associated after terminology overrides

### 5. cmdk manages its own ARIA

The combobox uses `cmdk` (Command component) which manages `aria-activedescendant`,
`role="listbox"`, and keyboard navigation internally. Don't wrap it with redundant
ARIA. Instead, verify it works by testing with a screen reader.

### 6. dnd-kit drag/reorder needs keyboard alternatives

Some views use `@dnd-kit/core` for drag/reorder. WCAG 2.5.7 requires a non-drag
alternative. Add move-up/move-down buttons or a menu with "Move earlier/later" actions.

### 7. Multiple navigation regions need distinct labels

The web app has Sidenav, WizardNavbar, and FormationProgressBar — potentially three
`<nav>` elements. Each needs a unique `aria-label` so screen readers can distinguish them.

### 8. SPA route changes don't manage focus

Neither Remix nor React Router v7 natively move focus on route change. Without
`useFocusOnNavigate`, keyboard users are stranded at the previous focus position
after navigation. The hook must wait for `navigation.state === "idle"` before focusing.

### 9. Dark mode contrast is untested

`tailwind.config.ts` has `darkMode: ["class"]` but no contrast tests for dark mode
color pairs. If dark mode is enabled, audit contrast for all foreground/background
combinations in both themes.

### 10. Required field indicator is visual-only

The `RequiredIndicator` component renders a visual asterisk but doesn't apply
`aria-required="true"` or `required` to the associated input. Screen reader users
don't know which fields are required.

### 11. ESLint a11y is configured but may not block

`.eslintrc.cjs` extends `plugin:jsx-a11y/recommended` but violations may be warnings,
not errors. Verify that a11y lint rules are set to `error` level to actually block
commits with a11y issues.

### 12. AI assistant sidebar position

The Voltagen AI sidebar renders at a fixed position (400px wide, absolute). WCAG 3.2.6
(Consistent Help) requires help mechanisms to be in the same relative position across
pages. Verify the sidebar is consistently positioned and doesn't interfere with focus
order.
