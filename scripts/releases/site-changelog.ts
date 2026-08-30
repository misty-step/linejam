import type { ChangelogEntry, ReleaseWithNotes } from '@/lib/releases/types';

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
  const notes = release.productNotes
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (notes.length > 0) return notes;

  return release.changes.map((change) => {
    const scope = change.scope ? `(${change.scope}) ` : '';
    return `${scope}${change.description}`;
  });
}

function renderReleaseSection(release: ReleaseWithNotes): string {
  const versionLabel = releaseVersionLabel(release.version);
  const bullets = noteBullets(release)
    .map((bullet) => `              <li>${escapeHtml(bullet)}</li>`)
    .join('\n');

  return `          <section class="msk-release">
            <p class="lj-kicker">${escapeHtml(release.date)} - ${escapeHtml(versionLabel)}</p>
            <h2>Version ${escapeHtml(release.version.replace(/^v/, ''))}</h2>
            <ul>
${bullets}
            </ul>
            <p class="lj-status">
              <svg class="lj-icon" data-lucide="circle-check">
                <use href="#i-circle-check" />
              </svg>
              <span>${escapeHtml(evidenceLabel(release.changes))}</span>
            </p>
          </section>`;
}

export function renderSiteChangelogHtml(
  releases: readonly ReleaseWithNotes[]
): string {
  const releaseSections = releases.map(renderReleaseSection).join('\n\n');

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
  </head>
  <body>
    <svg aria-hidden="true" width="0" height="0" style="position: absolute">
      <symbol id="i-scroll-text" viewBox="0 0 24 24">
        <path d="M15 12h-5" />
        <path d="M15 8h-5" />
        <path
          d="M19 17V5a2 2 0 0 0-2-2H4a2 2 0 0 0 0 4h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"
        />
      </symbol>
      <symbol id="i-palette" viewBox="0 0 24 24">
        <path
          d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
        />
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="6.5" cy="12.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
      </symbol>
      <symbol id="i-circle-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </symbol>
    </svg>

    <div class="lj-shell">
      <header class="lj-bar msk-bar">
        <a class="lj-wordmark" href="./" aria-label="Linejam home">
          <span class="lj-mark" aria-hidden="true">
            <svg class="lj-icon" data-lucide="scroll-text">
              <use href="#i-scroll-text" />
            </svg>
          </span>
          <span class="lj-wordmark-label">Linejam</span>
        </a>
        <span class="msk-actions">
          <nav class="lj-nav" aria-label="Site">
            <a href="./">home</a>
            <a href="changelog.html" aria-current="page">release notes</a>
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
            Linejam ships continuously. These notes are generated in plain
            language from the same
            <a href="https://github.com/misty-step/linejam/blob/master/CHANGELOG.md"
              >CHANGELOG.md</a
            >
            source that feeds the app's /releases page.
          </p>

${releaseSections}
        </article>
      </main>

      <footer class="lj-bar lj-footer msk-footer">
        <p class="lj-kicker">Linejam release notes are public by default.</p>
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
