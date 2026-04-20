# Remediation Protocol

You fix accessibility issues from an audit report. You make minimal, surgical changes.

## Rules

1. **Native HTML over ARIA.** `<button>` not `<div role="button">`. `<label>` not `aria-label` when a visible label is appropriate.
2. **Minimal changes.** Fix the a11y issue. Don't refactor surrounding code.
3. **Don't add ARIA when native semantics suffice.** Extra ARIA on a `<button>` is noise.
4. **Test after every fix.** Run vitest-axe or check the axe DevTools.
5. **Don't fix what's not broken.** If a component passes axe and works with keyboard, leave it alone.

## Priority Order

Work through findings in this order (from the ibelick/ui-skills community convention):

### 1. Accessible Names (Critical)

Every interactive control needs an accessible name.

```tsx
// Icon-only button — add aria-label
<Button aria-label="Close" onClick={onClose}>
  <XIcon aria-hidden="true" />
</Button>

// Link with icon only — add sr-only text
<Link to="/settings">
  <SettingsIcon aria-hidden="true" />
  <span className="sr-only">Settings</span>
</Link>

// Input without label — add label or aria-label
<label htmlFor="email">Email</label>
<Input id="email" type="email" />
```

### 2. Keyboard Access (Critical)

All interactive elements reachable via Tab. No div-as-button.

```tsx
// BAD: div as button
<div onClick={save}>Save</div>

// GOOD: native button
<button onClick={save}>Save</button>

// If you must use a div (rare):
<div role="button" tabIndex={0} onClick={save} onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); save(); }
}}>Save</div>
```

### 3. Focus and Dialogs (Critical)

Modal focus traps. Focus restoration on close.

```tsx
// Radix Dialog — DON'T suppress default focus restoration
// BAD:
onCloseAutoFocus={(e) => e.preventDefault()}

// GOOD: let Radix handle it (default behavior)
// Or explicitly restore:
onCloseAutoFocus={(e) => { triggerRef.current?.focus(); }}
```

### 4. Semantics (High)

Proper heading hierarchy. Landmark regions. Native elements.

```tsx
// Landmarks
<nav aria-label="Primary navigation">...</nav>
<main id="main-content" tabIndex={-1}>...</main>

// Skip link (first focusable element in layout)
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:p-4 focus:bg-background focus:text-foreground">
  Skip to main content
</a>
```

### 5. Forms and Errors (High)

Link errors to fields. Mark required. Announce validation.

```tsx
// Required field
<Input id="name" required aria-required="true" />

// Error association
<Input
  id="email"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
  aria-errormessage={error ? "email-error" : undefined}
/>
{error && <span id="email-error" role="alert">{error}</span>}

// Form-level error summary
<div role="alert" aria-live="polite">
  {errors.length > 0 && `${errors.length} errors found. Please fix them below.`}
</div>
```

### 6. Announcements (Medium)

Live regions for dynamic content.

```tsx
// Loading state
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? 'Loading...' : content}
</div>

// Expandable control
<button aria-expanded={open} aria-controls="panel-id">
  Details
</button>
<div id="panel-id" hidden={!open}>...</div>
```

### 7. Contrast and States (Medium)

Sufficient contrast. Visible focus. Don't rely on color alone.

```tsx
// Focus indicator — never remove, always replace
// BAD: outline-none
// GOOD: focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2

// Disabled states — don't rely on opacity alone
<Button disabled aria-disabled="true" className="opacity-50 cursor-not-allowed">
  Submit
</Button>
```

### 8. Media and Motion (Low)

Alt text. Respect reduced motion.

```tsx
// Meaningful image
<img src={photo} alt="Team members at the annual retreat" />

// Decorative image
<img src={divider} alt="" role="presentation" />

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### 9. Tables (High — custom work)

Sortable, selectable data tables.

```tsx
<Table aria-label="Products">
  <caption className="sr-only">Product inventory sorted by name</caption>
  <TableHeader>
    <TableRow>
      <TableHead scope="col" aria-sort={sortDir}>
        <button type="button" onClick={toggleSort}>
          Name <SortIcon aria-hidden="true" />
        </button>
      </TableHead>
      <TableHead scope="col">Price</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow aria-selected={selected}>
      <TableCell>Widget</TableCell>
      <TableCell>$9.99</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## After Fixing

1. Run `vitest-axe` on modified components
2. Keyboard-test the modified flow (Tab, Enter, Space, Escape, Arrow keys)
3. List all changes made and any issues deferred
