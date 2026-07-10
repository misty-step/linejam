// Round-1 baseline: the shipped app, captured live at 390x844 on 2026-07-09.
// Screenshots, not a rebuild — this is the truthful current state.
(function () {
  const SHOTS = {
    home: 'baseline/01-home.png',
    join: 'baseline/02-host.png',
    lobby: 'baseline/04-lobby-with-bot.png',
    write: 'baseline/06-writing-filled.png',
    wait: 'baseline/07-waiting.png',
    reveal: 'baseline/08-reveal.png',
  };
  const NOTES = {
    join: 'Host Session screen shown; Join is the mirror of it.',
  };
  const screens = {};
  Object.keys(SHOTS).forEach((k) => {
    screens[k] = (el) => {
      el.innerHTML = `
        <div class="base-shot">
          <img src="${SHOTS[k]}" alt="current shipped ${k} screen" />
          ${NOTES[k] ? `<p class="base-note">${NOTES[k]}</p>` : ''}
        </div>`;
    };
  });
  window.LANE_SPECS = window.LANE_SPECS || {};
  window.LANE_SPECS['BASE-1'] = {
    lane: 'baseline',
    title: 'Shipped app (Kenya theme)',
    move: 'Current production state, captured live 2026-07-09.',
    css: `
      .opt-BASE-1 .base-shot { height: 100%; overflow-y: auto; background: #faf8f5; }
      .opt-BASE-1 .base-shot img { width: 100%; display: block; }
      .opt-BASE-1 .base-note { font: 12px/1.4 ui-monospace, monospace; color: #8a8580; padding: 8px 12px; margin: 0; }
    `,
    screens,
  };
})();
