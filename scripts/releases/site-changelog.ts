import {
  NOTES_STATUS_LABELS,
  type ChangelogEntry,
  type ReleaseCatalog,
  type ReleaseWithNotes,
} from '@/lib/releases/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function releaseVersionLabel(version: string): string {
  return `v${version.replace(/^v/, '')}`;
}

function evidenceForChange(change: ChangelogEntry): string | null {
  if (change.pr) return `PR #${change.pr}`;
  if (change.commit) return `commit ${change.commit}`;
  return null;
}

function evidenceLabel(changes: ChangelogEntry[]): string {
  const evidence = Array.from(
    new Set(
      changes.map(evidenceForChange).filter((item): item is string => !!item)
    )
  );

  if (evidence.length === 0) return 'Evidence: CHANGELOG.md.';
  return `Evidence: ${evidence.join(', ')}.`;
}

function noteBullets(release: ReleaseWithNotes): string[] {
  return release.productNotes
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderReleaseSection(release: ReleaseWithNotes): string {
  const versionLabel = releaseVersionLabel(release.version);
  const bullets = noteBullets(release)
    .map((bullet) => `              <li>${escapeHtml(bullet)}</li>`)
    .join('\n');

  return `          <section class="msk-release" id="${escapeHtml(versionLabel)}">
            <p class="lj-kicker">${escapeHtml(release.date)} - ${escapeHtml(versionLabel)}</p>
            <h2>Version ${escapeHtml(release.version.replace(/^v/, ''))}</h2>
${bullets ? `            <ul>\n${bullets}\n            </ul>` : ''}
            <p>${escapeHtml(NOTES_STATUS_LABELS[release.notesStatus])}</p>
            <details>
              <summary>Technical history (${release.changes.length} changes)</summary>
              <ul>
${release.changes.map((change) => `                <li>${escapeHtml(`${change.scope ? `(${change.scope}) ` : ''}${change.description}`)}</li>`).join('\n')}
              </ul>
            </details>
            <p class="lj-status">
              <svg class="lj-icon" data-lucide="circle-check">
                <use href="#i-circle-check" />
              </svg>
              <span>${escapeHtml(evidenceLabel(release.changes))}</span>
            </p>
          </section>`;
}

export function renderSiteChangelogHtml(catalog: ReleaseCatalog): string {
  const releaseSections = catalog.releases
    .map(renderReleaseSection)
    .join('\n\n');
  const errors = catalog.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error'
  );
  const diagnostics =
    errors.length > 0
      ? `<aside aria-label="Release content status"><p>Some release content is out of sync.</p><ul>${errors.map((diagnostic) => `<li>${escapeHtml(diagnostic.message)}</li>`).join('')}</ul></aside>`
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Linejam release notes</title>
    <meta
      name="description"
      content="User-facing release notes for Linejam."
    />
    <script>
      try {
        var stored = localStorage.getItem('linejam-theme-mode');
        var mode =
          stored === 'dark' || stored === 'light'
            ? stored
            : window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        document.documentElement.classList.add(mode);
        document.documentElement.style.colorScheme = mode;
      } catch (e) {}
    </script>
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="linejam.css" />
    <link rel="stylesheet" href="marketing.css" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
  </head>
  <body>
    <svg aria-hidden="true" width="0" height="0" style="position: absolute">
      <symbol id="i-palette" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18a9 9 0 0 0 0-18" fill="currentColor" stroke="none" />
      </symbol>
      <symbol id="i-circle-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </symbol>
    </svg>

    <div class="lj-shell">
      <header class="lj-bar msk-bar">
        <a class="lj-wordmark" href="./" aria-label="Linejam home">
          <span class="lj-wordmark-label">Linejam</span>
        </a>
        <span class="msk-actions">
          <nav class="lj-nav" aria-label="Site">
            <a href="./">Home</a>
            <a href="changelog.html" aria-current="page">Release notes</a>
          </nav>
          <details class="lj-appearance">
            <summary class="lj-icon-button" aria-label="Color mode">
              <svg class="lj-icon" aria-hidden="true">
                <use href="#i-palette" />
              </svg>
            </summary>
            <fieldset class="lj-mode">
              <legend>Color mode</legend>
              <div class="lj-mode-options">
                <label>
                  <input type="radio" name="color-mode" value="light" />
                  <span>Light</span>
                </label>
                <label>
                  <input type="radio" name="color-mode" value="dark" />
                  <span>Dark</span>
                </label>
                <label>
                  <input type="radio" name="color-mode" value="system" />
                  <span>System</span>
                </label>
              </div>
            </fieldset>
          </details>
        </span>
      </header>

      <main class="lj-stage">
        <article class="lj-doc msk-page" aria-labelledby="release-notes-title">
          <h1 id="release-notes-title">Release notes</h1>
          <p class="lj-lede">
            What changed in Linejam. You can also read the
            <a href="https://www.linejam.app/releases">latest releases in the app</a>.
          </p>
          <p>Current application version: <strong>v${escapeHtml(catalog.currentVersion)}</strong>.</p>
          <p>Release history is ordered by date. Older version numbers are preserved, not treated as the current version.</p>
${diagnostics}

${releaseSections}
        </article>
      </main>

      <footer class="lj-bar lj-footer msk-footer">
        <p class="lj-muted">A game by Misty Step.</p>
        <nav class="lj-foot-links" aria-label="Footer">
          <a
            data-footer-link="github"
            href="https://github.com/misty-step/linejam"
            >GitHub</a
          >
          <a data-footer-link="misty-step" href="https://mistystep.io"
            >Misty Step</a
          >
        </nav>
      </footer>
    </div>

    <script src="mode.js"></script>
  </body>
</html>
`;
}
