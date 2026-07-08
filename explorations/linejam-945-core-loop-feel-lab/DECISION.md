# linejam-945 Core Loop Feel Lab

Winner: Option 3, "seal loaded".

Rationale: The defect is a readiness ambiguity, not a need for a new visual
language. The winning direction keeps the existing Kenya/editorial surface and
adds one clear signal at the commitment point: the button resolves through the
theme token directly, gains a small ready label, and stamps harder when valid.
It also gives transitions their missing beat without adding modal friction:
the carried line is labeled as received, and the final round becomes "Last
line" in the persistent room chrome.

Rejected options:

- Ink wash: attractive, but too much background motion around text entry.
- Countdown rail: increases pressure before the button defect is solved.
- Full card transition: slower than the core loop should be.
- Confetti reveal: off-tone for Linejam's editorial restraint.
- Progress drum: over-explains a simple 9-line pattern.
- Typewriter prompt: competes with the user's own line.
- Giant final overlay: blocks the writing task at the exact final moment.

Implementation notes:

- Primary button root cause: token-backed Tailwind color utilities were the
  fragile layer. The fix uses a named CSS class that resolves CSS variables at
  runtime, matching the surfaces that already rendered correctly.
- Readiness signal: valid input sets `data-ready=true`, shows "Ready", and
  applies a theme-aware ready pulse.
- Transition beat: incoming carried lines get a small "Received line" label.
- Final tension: final assignments render as "Last line" and final submission
  confirms "Last line sealed. Reveal is next."
- Share confirmation: per-poem share adds a visible live status below the
  action row.
