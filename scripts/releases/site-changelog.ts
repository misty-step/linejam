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
            <p class="ae-chrome">${escapeHtml(release.date)} - ${escapeHtml(versionLabel)}</p>
            <h2>Version ${escapeHtml(release.version.replace(/^v/, ''))}</h2>
            <ul>
${bullets}
            </ul>
            <p class="ae-status">
              <svg class="ae-icon ae-ok" data-lucide="circle-check">
                <use href="#i-circle-check" />
              </svg>
              <span class="ae-status-label">${escapeHtml(evidenceLabel(release.changes))}</span>
            </p>
          </section>`;
}

export function renderSiteChangelogHtml(
  releases: readonly ReleaseWithNotes[]
): string {
  const releaseSections = releases.map(renderReleaseSection).join('\n\n');

  return `<!doctype html>
<html lang="en" data-ae-theme="ember">
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
        var m = localStorage.getItem('ae-mode');
        if (m === 'dark' || m === 'light') {
          document.documentElement.classList.add(m);
          document.documentElement.style.colorScheme = m;
        }
      } catch (e) {}
    </script>
    <link rel="stylesheet" href="aesthetic.css" />
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
      <symbol id="i-sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </symbol>
      <symbol id="i-moon" viewBox="0 0 24 24">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </symbol>
      <symbol id="i-circle-check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </symbol>
    </svg>

    <div class="ae-screen ae-wide">
      <header class="ae-bar msk-bar">
        <a class="ae-logo" href="./" aria-label="Linejam home">
          <span class="ae-app-mark" aria-hidden="true">
            <svg class="ae-icon" data-lucide="scroll-text">
              <use href="#i-scroll-text" />
            </svg>
          </span>
          <span class="ae-name">Linejam</span>
        </a>
        <span class="msk-actions">
          <nav class="ae-chrome msk-nav" aria-label="Site">
            <a href="./">home</a>
            <a href="changelog.html" aria-current="page">release notes</a>
          </nav>
          <button class="ae-mode" aria-label="toggle color mode">
            <svg class="ae-icon ae-sun"><use href="#i-sun" /></svg>
            <svg class="ae-icon ae-moon"><use href="#i-moon" /></svg>
          </button>
        </span>
      </header>

      <main class="ae-stage ae-stage-scroll">
        <article class="ae-doc msk-page" aria-labelledby="release-notes-title">
          <h1 id="release-notes-title">Release notes</h1>
          <p class="ae-lede">
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

      <footer class="ae-bar msk-footer">
        <p class="ae-chrome">Linejam release notes are public by default.</p>
        <nav class="ae-foot-links ae-chrome" aria-label="Footer">
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
    <script src="theme.js"></script>
  </body>
</html>
`;
}
