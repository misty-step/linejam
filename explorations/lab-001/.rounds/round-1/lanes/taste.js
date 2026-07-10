// TASTE lane — three complete system propositions for Linejam, each obeying the
// leon-taste-skill philosophy end to end: metric-based rules, asymmetric layout
// (VARIANCE mid-high), a single desaturated accent on a neutral base (max 1
// accent, saturation < 80%, no AI purple/blue, no pure black), mono numerals,
// tactile :active feedback, motion only on game moments, editorial serif
// reserved for the poetry itself. Airy density. Mobile-first at 390x844 with the
// primary action parked in the bottom thumb zone.
//
// TASTE-1 COUNTHOUSE  — the word-count spine is the persistent skeleton.
// TASTE-2 OVERHEARD   — the printed page is the whole interface (inverts reveal).
// TASTE-3 SEATS       — the room is a table (inverts lobby-as-list, top chrome).
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // Small trusted-content helpers (corpus is fixed, no user input to escape).
  const seatMark = (p) =>
    p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? '' : 'away';

  /* ============================================================= *
   * TASTE-1 · COUNTHOUSE
   * The constraint is the identity. Every screen carries the count
   * spine 1·2·3·4·5·4·3·2·1 as a mono skeleton; the accent marks your
   * position. Warm paper, vermillion seal, hairline rules, no cards.
   * ============================================================= */
  window.LANE_SPECS['TASTE-1'] = {
    lane: 'taste',
    title: 'Counthouse',
    move: 'The word-count spine (1·2·3·4·5·4·3·2·1) is the persistent skeleton on every screen; the accent marks your position in it.',
    css: `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.opt-TASTE-1 {
  --paper: #faf8f4; --ink: #1b1714; --soft: #6f675e; --line: #e4ded4;
  --seal: #b8402c; --seal-ink: #fbf6f1;
  background: var(--paper); color: var(--ink);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}
.opt-TASTE-1 * { box-sizing: border-box; }
.opt-TASTE-1 .t1-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.opt-TASTE-1 .t1-scroll { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.opt-TASTE-1 .t1-foot { flex: none; padding: 14px 20px 22px; border-top: 1px solid var(--line); }

/* the spine — mono numerals, current position sealed */
.opt-TASTE-1 .t1-spine { display: flex; gap: 6px; align-items: baseline; font-family: 'JetBrains Mono', monospace; }
.opt-TASTE-1 .t1-spine b { font-weight: 500; font-size: 13px; color: var(--soft); font-feature-settings: 'tnum'; transition: color .25s; }
.opt-TASTE-1 .t1-spine b.on { color: var(--seal); font-weight: 700; position: relative; }
.opt-TASTE-1 .t1-spine b.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 2px; background: var(--seal); }

.opt-TASTE-1 .t1-kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-1 .t1-serif { font-family: 'Fraunces', Georgia, serif; }

/* buttons */
.opt-TASTE-1 .t1-btn { width: 100%; min-height: 54px; border: none; border-radius: 4px; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 16px; letter-spacing: .01em; cursor: pointer; transition: transform .12s ease, background .2s, opacity .2s; }
.opt-TASTE-1 .t1-btn:active { transform: translateY(1px); }
.opt-TASTE-1 .t1-fill { background: var(--seal); color: var(--seal-ink); }
.opt-TASTE-1 .t1-ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
.opt-TASTE-1 .t1-btn:disabled { opacity: .4; cursor: default; }

.opt-TASTE-1 h1.t1-brand { font-family: 'Fraunces', serif; font-weight: 400; font-size: 52px; line-height: .92; letter-spacing: -.02em; margin: 0; }
.opt-TASTE-1 .t1-hero-spine { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 40px; letter-spacing: .04em; color: var(--ink); display: flex; flex-wrap: wrap; gap: 4px 12px; }
.opt-TASTE-1 .t1-hero-spine span { color: var(--soft); }
.opt-TASTE-1 .t1-hero-spine span.peak { color: var(--seal); }

/* form */
.opt-TASTE-1 label.t1-lab { display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--soft); margin: 0 0 8px; }
.opt-TASTE-1 .t1-code { display: flex; gap: 8px; }
.opt-TASTE-1 .t1-code .cell { flex: 1; aspect-ratio: 3/4; border: 1.5px solid var(--line); border-radius: 4px; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 500; }
.opt-TASTE-1 .t1-code .cell.set { border-color: var(--ink); }
.opt-TASTE-1 input.t1-in { width: 100%; min-height: 52px; padding: 0 14px; border: 1.5px solid var(--line); border-radius: 4px; background: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 17px; color: var(--ink); }
.opt-TASTE-1 input.t1-in:focus { outline: none; border-color: var(--seal); }

/* roster rows — hairlines, no cards */
.opt-TASTE-1 .t1-row { display: flex; align-items: center; gap: 12px; padding: 15px 0; border-top: 1px solid var(--line); }
.opt-TASTE-1 .t1-row .who { flex: 1; font-size: 17px; font-weight: 500; }
.opt-TASTE-1 .t1-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.opt-TASTE-1 .t1-dot.here { background: var(--seal); }
.opt-TASTE-1 .t1-dot.gone { background: transparent; box-shadow: inset 0 0 0 1.5px var(--soft); }
.opt-TASTE-1 .t1-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-1 .t1-tag.host { color: var(--seal); }

/* the code display */
.opt-TASTE-1 .t1-bigcode { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 76px; letter-spacing: .12em; line-height: 1; }

/* write slots */
.opt-TASTE-1 .t1-prev { font-family: 'Fraunces', serif; font-weight: 400; font-size: 30px; line-height: 1.15; letter-spacing: -.01em; }
.opt-TASTE-1 .t1-slots { display: flex; gap: 7px; }
.opt-TASTE-1 .t1-slot { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; }
.opt-TASTE-1 .t1-slot .n { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--soft); }
.opt-TASTE-1 .t1-slot .bar { width: 100%; height: 44px; border-radius: 4px; border: 1.5px solid var(--line); display: grid; place-items: center; font-family: 'Fraunces', serif; font-size: 15px; padding: 0 2px; text-align: center; overflow: hidden; }
.opt-TASTE-1 .t1-slot.full .bar { border-color: var(--ink); background: #fff; }
.opt-TASTE-1 .t1-slot.next .bar { border-color: var(--seal); border-style: dashed; }
.opt-TASTE-1 .t1-count { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }
.opt-TASTE-1 .t1-count b { color: var(--seal); }

/* reveal poem */
.opt-TASTE-1 .t1-pline { display: flex; align-items: baseline; gap: 14px; padding: 9px 0; border-top: 1px solid var(--line); }
.opt-TASTE-1 .t1-pline .idx { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--soft); width: 34px; flex: none; }
.opt-TASTE-1 .t1-pline .txt { flex: 1; font-family: 'Fraunces', serif; font-size: 21px; line-height: 1.25; }
.opt-TASTE-1 .t1-pline .by { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--soft); flex: none; }

.opt-TASTE-1 .t1-fade { animation: t1up .5s cubic-bezier(.16,1,.3,1) both; }
@keyframes t1up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.opt-TASTE-1 .t1-pulse { animation: t1pulse 1.7s ease-in-out infinite; }
@keyframes t1pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .opt-TASTE-1 *, .opt-TASTE-1 *::after { animation: none !important; transition: none !important; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:44px 24px 24px;">
              <p class="t1-kicker t1-fade">a poem, nine hands</p>
              <h1 class="t1-brand t1-fade" style="margin-top:14px;">Linejam</h1>
              <p class="t1-serif t1-fade" style="font-size:19px;color:var(--soft);margin:16px 0 40px;max-width:24ch;line-height:1.35;">You write one line, pass it on, and never see the whole thing until the end.</p>
              <p class="t1-kicker" style="margin-bottom:14px;">nine lines, this many words each</p>
              <div class="t1-hero-spine t1-fade">
                <span>1</span><span>2</span><span>3</span><span>4</span><span class="peak">5</span><span>4</span><span>3</span><span>2</span><span>1</span>
              </div>
            </div>
            <div class="t1-foot">
              <button class="t1-btn t1-fill" style="margin-bottom:10px;">Start a game</button>
              <button class="t1-btn t1-ghost">Join a room</button>
            </div>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:40px 24px 24px;">
              <p class="t1-kicker">step in</p>
              <h2 class="t1-serif" style="font-weight:400;font-size:34px;margin:10px 0 34px;letter-spacing:-.01em;">Join a room</h2>
              <label class="t1-lab">room code</label>
              <div class="t1-code" style="margin-bottom:26px;">
                <div class="cell set">P</div><div class="cell set">L</div><div class="cell set">U</div><div class="cell set">M</div>
              </div>
              <label class="t1-lab">your pen name</label>
              <input class="t1-in" value="Wren" aria-label="pen name" />
            </div>
            <div class="t1-foot">
              <button class="t1-btn t1-fill">Join the room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        const rows = corpus.players.map((p) => {
          const mark = seatMark(p);
          const tag = mark === 'host' ? `<span class="t1-tag host">host</span>`
            : mark === 'ghost' ? `<span class="t1-tag">ghost</span>`
            : mark === 'away' ? `<span class="t1-tag">away</span>` : '';
          return `<div class="t1-row"><span class="t1-dot ${p.present ? 'here' : 'gone'}"></span><span class="who">${p.name}</span>${tag}</div>`;
        }).join('');
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:34px 24px 20px;">
              <p class="t1-kicker">read this out to the table</p>
              <div class="t1-bigcode t1-fade" style="margin:10px 0 6px;">${corpus.roomCode}</div>
              <p class="t1-serif" style="color:var(--soft);font-size:17px;margin:0 0 26px;">Four friends in, one still finding the app.</p>
              <div>${rows}
                <button class="t1-row" style="width:100%;background:none;cursor:pointer;text-align:left;">
                  <span class="t1-dot" style="box-shadow:inset 0 0 0 1.5px var(--seal);"></span>
                  <span class="who" style="color:var(--seal);">Add a ghostwriter</span>
                  <span class="t1-tag host">+ bot</span>
                </button>
              </div>
            </div>
            <div class="t1-foot">
              <div class="t1-spine" style="justify-content:center;margin-bottom:14px;">
                <b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>4</b><b>3</b><b>2</b><b>1</b>
              </div>
              <button class="t1-btn t1-fill">Start the game</button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const drafted = g.draft.split(' '); // 4 words
        const total = g.wordsThisRound; // 5
        const slots = Array.from({ length: total }, (_, i) => {
          const w = drafted[i];
          const cls = w ? 'full' : i === drafted.length ? 'next' : '';
          return `<div class="t1-slot ${cls}"><span class="n">${i + 1}</span><span class="bar">${w || ''}</span></div>`;
        }).join('');
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:26px 22px 16px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <p class="t1-kicker">round 05 / 09</p>
                <div class="t1-spine"><b>1</b><b>2</b><b>3</b><b>4</b><b class="on">5</b><b>4</b><b>3</b><b>2</b><b>1</b></div>
              </div>
              <p class="t1-kicker" style="margin:24px 0 8px;">all you get to see</p>
              <p class="t1-prev">"${g.previousLine}"</p>
              <p class="t1-kicker" style="margin:28px 0 12px;">your line, exactly five words</p>
              <div class="t1-slots" id="t1slots">${slots}</div>
              <p class="t1-count" style="margin-top:12px;"><b id="t1n">${drafted.length}</b> / ${total} words</p>
            </div>
            <div class="t1-foot">
              <input class="t1-in" id="t1write" value="${g.draft} " aria-label="your line" style="margin-bottom:10px;" />
              <button class="t1-btn t1-fill" id="t1send" disabled>Add one more word</button>
            </div>
          </div>`;
        const input = el.querySelector('#t1write');
        const slotWrap = el.querySelector('#t1slots');
        const nEl = el.querySelector('#t1n');
        const send = el.querySelector('#t1send');
        const paint = () => {
          const words = input.value.trim().split(/\s+/).filter(Boolean).slice(0, total);
          slotWrap.querySelectorAll('.t1-slot').forEach((s, i) => {
            const bar = s.querySelector('.bar');
            s.classList.remove('full', 'next');
            if (words[i]) { bar.textContent = words[i]; s.classList.add('full'); }
            else { bar.textContent = ''; if (i === words.length) s.classList.add('next'); }
          });
          nEl.textContent = String(words.length);
          if (words.length === total) { send.disabled = false; send.textContent = 'Pass it on'; }
          else { send.disabled = true; send.textContent = 'Add one more word'; }
        };
        input.addEventListener('input', paint);
        paint();
      },
      wait(el, corpus) {
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:44px 24px 24px;display:flex;flex-direction:column;">
              <p class="t1-kicker t1-fade">line sent</p>
              <h2 class="t1-serif t1-fade" style="font-weight:400;font-size:38px;margin:12px 0 8px;letter-spacing:-.01em;">Off it goes.</h2>
              <p class="t1-serif" style="color:var(--soft);font-size:18px;margin:0 0 40px;max-width:22ch;line-height:1.35;">It lands on the next desk with only your five words showing.</p>
              <div style="border-top:1px solid var(--line);padding-top:22px;">
                <p class="t1-kicker" style="margin-bottom:16px;">still writing</p>
                <div style="display:flex;align-items:center;gap:12px;">
                  <span class="t1-dot here t1-pulse"></span>
                  <span style="font-size:22px;font-weight:500;">${corpus.game.waitingOn[0]}</span>
                  <span class="t1-tag" style="margin-left:auto;">round 05</span>
                </div>
              </div>
              <div class="t1-spine" style="justify-content:center;margin-top:auto;padding-top:36px;">
                <b>1</b><b>2</b><b>3</b><b>4</b><b class="on">5</b><b>4</b><b>3</b><b>2</b><b>1</b>
              </div>
            </div>
            <div class="t1-foot">
              <button class="t1-btn t1-ghost" disabled>Waiting on the table</button>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const cur = corpus.revealQueue[0];
        const lines = corpus.poem.lines.map((ln, i) => {
          const words = ln.text.split(' ').length;
          return `<div class="t1-pline t1-fade" style="animation-delay:${i * 55}ms;"><span class="idx">${i + 1}·${words}w</span><span class="txt">${ln.text}</span><span class="by">${ln.author}</span></div>`;
        }).join('');
        const queue = corpus.revealQueue.map((q, i) =>
          `<div class="t1-row" style="border-top:${i ? '1px solid var(--line)' : 'none'};padding:11px 0;"><span class="t1-tag ${i ? '' : 'host'}">${i ? 'up next' : 'now'}</span><span class="who" style="font-size:15px;font-weight:500;">${q.reader} reads ${q.poem}</span><span class="t1-tag">"${q.firstWord}"</span></div>`
        ).join('');
        el.innerHTML = `
          <div class="t1-body">
            <div class="t1-scroll" style="padding:30px 22px 20px;">
              <p class="t1-kicker">the reading</p>
              <div style="margin:12px 0 26px;">${queue}</div>
              <div style="border-top:2px solid var(--ink);padding-top:18px;">
                <p class="t1-kicker" style="color:var(--seal);margin-bottom:4px;">${cur.reader}, read this one out loud</p>
                <h2 class="t1-serif" style="font-weight:400;font-size:28px;margin:0 0 14px;letter-spacing:-.01em;">${corpus.poem.title}</h2>
                ${lines}
              </div>
            </div>
            <div class="t1-foot">
              <button class="t1-btn t1-fill">Read the next poem</button>
            </div>
          </div>`;
      },
    },
  };

  /* ============================================================= *
   * TASTE-2 · OVERHEARD
   * The page is the whole interface. Almost pure typography on bone
   * paper, one vermillion seal dot, giant Fraunces. Chrome shrinks to
   * mono footnotes in the thumb zone. Inverts the reveal: it is ONE
   * continuous printed page you scroll, not a tap-per-poem stack.
   * ============================================================= */
  window.LANE_SPECS['TASTE-2'] = {
    lane: 'taste',
    title: 'Overheard',
    move: 'Every screen is a printed page: one giant line of type is the whole interface, chrome demoted to mono footnotes, and the reveal is one scrollable page instead of a tap-per-poem stack.',
    css: `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0,300;9..144,0,400;9..144,0,500;9..144,1,400&family=JetBrains+Mono:wght@400;500&display=swap');

.opt-TASTE-2 {
  --paper: #f6f3ec; --ink: #16130d; --soft: #857c6c; --line: #dcd5c6; --seal: #b23a24;
  background: var(--paper); color: var(--ink);
  font-family: 'Fraunces', Georgia, serif;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}
.opt-TASTE-2 * { box-sizing: border-box; }
.opt-TASTE-2 .t2-page { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 46px 30px 20px; display: flex; flex-direction: column; }
.opt-TASTE-2 .t2-foot { flex: none; padding: 12px 30px 24px; }

.opt-TASTE-2 .t2-note { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-2 .t2-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
.opt-TASTE-2 .t2-seal { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--seal); vertical-align: middle; }

.opt-TASTE-2 .t2-big { font-weight: 300; font-size: 56px; line-height: .98; letter-spacing: -.025em; }
.opt-TASTE-2 .t2-mid { font-weight: 400; font-size: 34px; line-height: 1.08; letter-spacing: -.015em; }

/* text-button — the whole vocabulary; no filled boxes */
.opt-TASTE-2 .t2-act { display: inline-flex; align-items: baseline; gap: 12px; background: none; border: none; cursor: pointer; padding: 16px 0; font-family: 'Fraunces', serif; font-weight: 400; font-size: 26px; letter-spacing: -.01em; color: var(--ink); transition: gap .18s ease, opacity .2s; min-height: 48px; }
.opt-TASTE-2 .t2-act .arw { font-family: 'JetBrains Mono', monospace; color: var(--seal); font-size: 20px; }
.opt-TASTE-2 .t2-act:active { gap: 18px; }
.opt-TASTE-2 .t2-act.mute { color: var(--soft); font-size: 20px; }
.opt-TASTE-2 .t2-act:disabled { opacity: .4; cursor: default; }

.opt-TASTE-2 .t2-rule { border: none; border-top: 1px solid var(--line); margin: 0; }

/* code as headline */
.opt-TASTE-2 .t2-code { font-weight: 400; font-size: 92px; letter-spacing: .04em; line-height: 1; }

/* roster as running text */
.opt-TASTE-2 .t2-name { font-weight: 400; font-size: 30px; line-height: 1.5; letter-spacing: -.01em; display: flex; align-items: baseline; gap: 10px; }
.opt-TASTE-2 .t2-name .st { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-2 .t2-name .st.here { color: var(--seal); }
.opt-TASTE-2 .t2-name.away { color: var(--soft); }

/* write field on the page */
.opt-TASTE-2 .t2-write { width: 100%; border: none; background: transparent; font-family: 'Fraunces', serif; font-weight: 400; font-size: 34px; line-height: 1.12; letter-spacing: -.015em; color: var(--ink); resize: none; padding: 0; }
.opt-TASTE-2 .t2-write:focus { outline: none; }
.opt-TASTE-2 .t2-write::placeholder { color: var(--line); }
.opt-TASTE-2 .t2-ruler { display: flex; gap: 8px; margin-top: 14px; }
.opt-TASTE-2 .t2-tick { flex: 1; height: 2px; background: var(--line); border-radius: 2px; transition: background .25s; }
.opt-TASTE-2 .t2-tick.on { background: var(--seal); }
.opt-TASTE-2 .t2-tick.over { background: var(--ink); }

/* reveal — one printed page */
.opt-TASTE-2 .t2-poemline { font-weight: 400; font-size: 30px; line-height: 1.34; letter-spacing: -.015em; margin: 0; }
.opt-TASTE-2 .t2-margin { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }

.opt-TASTE-2 .t2-in { animation: t2in .6s cubic-bezier(.16,1,.3,1) both; }
@keyframes t2in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .opt-TASTE-2 * { animation: none !important; transition: none !important; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="t2-page">
            <p class="t2-note t2-in">a party game of borrowed lines</p>
            <div style="margin-top:auto;">
              <p class="t2-big t2-in">Line<br>jam<span class="t2-seal" style="margin-left:8px;"></span></p>
              <p class="t2-in" style="font-weight:400;font-size:21px;color:var(--soft);line-height:1.4;margin:22px 0 0;max-width:22ch;">Nine of you write one poem, one line at a time, half-blind, out loud at the end.</p>
            </div>
          </div>
          <div class="t2-foot">
            <hr class="t2-rule" />
            <button class="t2-act"><span class="arw">01</span> Start a game</button><br>
            <button class="t2-act mute"><span class="arw">02</span> Join a room</button>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="t2-page">
            <p class="t2-note t2-in">someone read you a code</p>
            <div style="margin-top:44px;">
              <p class="t2-note" style="margin-bottom:6px;">room</p>
              <p class="t2-code t2-num t2-in">PLUM</p>
            </div>
            <div style="margin-top:40px;">
              <p class="t2-note" style="margin-bottom:10px;">sign it</p>
              <input class="t2-write" value="Wren" aria-label="pen name" />
              <hr class="t2-rule" style="margin-top:6px;" />
            </div>
          </div>
          <div class="t2-foot">
            <button class="t2-act"><span class="arw">→</span> Take my seat</button>
          </div>`;
      },
      lobby(el, corpus) {
        const names = corpus.players.map((p) => {
          const mark = seatMark(p);
          const st = mark === 'host' ? `<span class="st here">host</span>`
            : mark === 'ghost' ? `<span class="st">ghost</span>`
            : mark === 'away' ? `<span class="st">finding the app</span>` : `<span class="st here">in</span>`;
          return `<p class="t2-name ${p.present ? '' : 'away'} t2-in">${p.name} ${st}</p>`;
        }).join('');
        el.innerHTML = `
          <div class="t2-page">
            <p class="t2-note">show the table</p>
            <p class="t2-code t2-num t2-in" style="margin:8px 0 4px;">${corpus.roomCode}</p>
            <p class="t2-note">everyone types those four letters</p>
            <hr class="t2-rule" style="margin:26px 0 18px;" />
            ${names}
            <button class="t2-act mute" style="margin-top:4px;"><span class="arw">+</span> Seat a ghostwriter</button>
          </div>
          <div class="t2-foot">
            <hr class="t2-rule" />
            <button class="t2-act"><span class="arw">→</span> Start the poem</button>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        el.innerHTML = `
          <div class="t2-page">
            <div style="display:flex;justify-content:space-between;">
              <p class="t2-note">round <span class="t2-num">05</span> of <span class="t2-num">09</span></p>
              <p class="t2-note">exactly <span class="t2-num">5</span> words</p>
            </div>
            <div style="margin:34px 0 auto;">
              <p class="t2-note" style="margin-bottom:12px;">the line before yours</p>
              <p class="t2-mid t2-in">${g.previousLine}</p>
            </div>
            <div>
              <p class="t2-note" style="margin-bottom:8px;">now yours</p>
              <textarea class="t2-write" id="t2w" rows="2" aria-label="your line">${g.draft}</textarea>
              <div class="t2-ruler" id="t2ruler"></div>
              <p class="t2-note" style="margin-top:10px;"><span class="t2-num" id="t2n">4</span> of 5 words</p>
            </div>
          </div>
          <div class="t2-foot">
            <hr class="t2-rule" />
            <button class="t2-act" id="t2send" disabled><span class="arw">→</span> Pass it on</button>
          </div>`;
        const ta = el.querySelector('#t2w');
        const ruler = el.querySelector('#t2ruler');
        const nEl = el.querySelector('#t2n');
        const send = el.querySelector('#t2send');
        const total = g.wordsThisRound;
        for (let i = 0; i < total; i++) ruler.appendChild(document.createElement('span')).className = 't2-tick';
        const paint = () => {
          const c = ta.value.trim().split(/\s+/).filter(Boolean).length;
          ruler.querySelectorAll('.t2-tick').forEach((t, i) => {
            t.className = 't2-tick' + (i < Math.min(c, total) ? (c > total ? ' over' : ' on') : '');
          });
          nEl.textContent = String(c);
          send.disabled = c !== total;
        };
        ta.addEventListener('input', paint);
        paint();
      },
      wait(el, corpus) {
        el.innerHTML = `
          <div class="t2-page">
            <p class="t2-note t2-in">it left your hands</p>
            <div style="margin-top:auto;">
              <p class="t2-big t2-in" style="font-size:48px;">and nobody<br>asks it<br>why<span class="t2-seal" style="margin-left:10px;"></span></p>
              <p class="t2-note" style="margin-top:18px;">your five words, now the next writer's whole world</p>
            </div>
            <hr class="t2-rule" style="margin:36px 0 16px;" />
            <p class="t2-name t2-in">${corpus.game.waitingOn[0]} <span class="st here">still writing</span></p>
          </div>
          <div class="t2-foot">
            <button class="t2-act mute" disabled>Holding the table</button>
          </div>`;
      },
      reveal(el, corpus) {
        const cur = corpus.revealQueue[0];
        const next = corpus.revealQueue[1];
        const lines = corpus.poem.lines.map((ln, i) =>
          `<div class="t2-in" style="animation-delay:${i * 60}ms;margin-bottom:14px;">
             <p class="t2-poemline">${ln.text}</p>
             <p class="t2-margin">${ln.author}</p>
           </div>`
        ).join('');
        el.innerHTML = `
          <div class="t2-page">
            <p class="t2-note">now: ${cur.reader} reads · up next: ${next.reader}</p>
            <hr class="t2-rule" style="margin:14px 0 22px;" />
            <p class="t2-note" style="color:var(--seal);margin-bottom:6px;">${cur.reader}, read this out loud</p>
            <h2 class="t2-mid" style="margin:0 0 26px;">${corpus.poem.title}</h2>
            ${lines}
            <hr class="t2-rule" style="margin:8px 0 14px;" />
            <p class="t2-margin">one poem of ${corpus.revealQueue.length}. keep reading.</p>
          </div>
          <div class="t2-foot">
            <button class="t2-act"><span class="arw">→</span> Turn the page to ${next.poem}</button>
          </div>`;
      },
    },
  };

  /* ============================================================= *
   * TASTE-3 · SEATS
   * The room is a table. Warm charcoal dark, single amber accent,
   * rounded seat tokens arranged as an arc, chrome in the bottom
   * thumb zone. Inverts lobby-as-list (a ring of seats) and top
   * chrome; the reveal deals poems out like a toast round.
   * ============================================================= */
  window.LANE_SPECS['TASTE-3'] = {
    lane: 'taste',
    title: 'Seats',
    move: 'The room is a table: players are seat tokens in an arc (not a list), all chrome lives in the bottom thumb zone, and the reveal deals poems out one toast at a time.',
    css: `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Newsreader:opsz,ital,wght@6..72,0,300;6..72,0,400;6..72,1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

.opt-TASTE-3 {
  --tbl: #1c1a17; --tbl2: #242019; --ink: #efe8da; --soft: #a99e8b; --line: #35302a;
  --amber: #e0a63f; --amber-ink: #1c1a17;
  background: radial-gradient(120% 80% at 50% 0%, #262119 0%, var(--tbl) 62%);
  color: var(--ink);
  font-family: 'Outfit', system-ui, sans-serif;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}
.opt-TASTE-3 * { box-sizing: border-box; }
.opt-TASTE-3 .t3-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 40px 22px 14px; display: flex; flex-direction: column; }
.opt-TASTE-3 .t3-dock { flex: none; padding: 14px 22px 24px; border-top: 1px solid var(--line); background: rgba(20,18,15,.6); }

.opt-TASTE-3 .t3-kick { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--amber); }
.opt-TASTE-3 .t3-mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
.opt-TASTE-3 .t3-serif { font-family: 'Newsreader', Georgia, serif; }

.opt-TASTE-3 .t3-btn { width: 100%; min-height: 54px; border: none; border-radius: 999px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 16px; cursor: pointer; transition: transform .16s cubic-bezier(.34,1.56,.64,1), background .2s, opacity .2s; }
.opt-TASTE-3 .t3-btn:active { transform: scale(.97); }
.opt-TASTE-3 .t3-amber { background: var(--amber); color: var(--amber-ink); }
.opt-TASTE-3 .t3-line { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--line); }
.opt-TASTE-3 .t3-btn:disabled { opacity: .45; cursor: default; }

.opt-TASTE-3 h1.t3-brand { font-family: 'Newsreader', serif; font-weight: 300; font-size: 58px; line-height: .95; letter-spacing: -.02em; margin: 0; }

/* seat tokens */
.opt-TASTE-3 .t3-arc { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.opt-TASTE-3 .t3-seat { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border-radius: 16px; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); }
.opt-TASTE-3 .t3-seat.me { box-shadow: inset 0 0 0 1.5px var(--amber); }
.opt-TASTE-3 .t3-seat.empty { background: transparent; box-shadow: inset 0 0 0 1.5px var(--line); border-style: dashed; opacity: .8; }
.opt-TASTE-3 .t3-av { width: 34px; height: 34px; border-radius: 50%; flex: none; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 15px; color: var(--amber-ink); }
.opt-TASTE-3 .t3-seat .nm { font-size: 15px; font-weight: 500; line-height: 1.1; }
.opt-TASTE-3 .t3-seat .rl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-3 .t3-seat.away .nm { color: var(--soft); }
.opt-TASTE-3 .t3-live { width: 7px; height: 7px; border-radius: 50%; background: var(--amber); margin-left: auto; flex: none; }

.opt-TASTE-3 .t3-code { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 60px; letter-spacing: .18em; color: var(--ink); }

/* passed card */
.opt-TASTE-3 .t3-card { background: var(--tbl2); border-radius: 22px; box-shadow: inset 0 0 0 1px var(--line), 0 20px 40px -24px #000; padding: 24px 22px; }
.opt-TASTE-3 .t3-prev { font-family: 'Newsreader', serif; font-weight: 400; font-size: 27px; line-height: 1.2; letter-spacing: -.01em; }

/* beads (write) */
.opt-TASTE-3 .t3-beads { display: flex; gap: 8px; flex-wrap: wrap; }
.opt-TASTE-3 .t3-bead { min-height: 40px; padding: 7px 14px; border-radius: 999px; display: grid; place-items: center; font-family: 'Newsreader', serif; font-size: 16px; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); }
.opt-TASTE-3 .t3-bead.set { background: var(--ink); color: var(--tbl); box-shadow: none; }
.opt-TASTE-3 .t3-bead.next { box-shadow: inset 0 0 0 1.5px var(--amber); color: var(--amber); }
.opt-TASTE-3 .t3-in { width: 100%; min-height: 50px; padding: 0 16px; border-radius: 14px; border: none; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); font-family: 'Outfit', sans-serif; font-size: 17px; }
.opt-TASTE-3 .t3-in:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--amber); }
.opt-TASTE-3 .t3-cnt { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }
.opt-TASTE-3 .t3-cnt b { color: var(--amber); }

/* reveal poem on stage */
.opt-TASTE-3 .t3-verse { font-family: 'Newsreader', serif; font-weight: 400; font-size: 25px; line-height: 1.32; letter-spacing: -.01em; }
.opt-TASTE-3 .t3-verse .by { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); margin-left: 8px; }

.opt-TASTE-3 .t3-deal { animation: t3deal .5s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes t3deal { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
.opt-TASTE-3 .t3-glow { animation: t3glow 2s ease-in-out infinite; }
@keyframes t3glow { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .opt-TASTE-3 * { animation: none !important; transition: none !important; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="t3-body" style="justify-content:flex-end;">
            <p class="t3-kick t3-deal">pass the phone around the table</p>
            <h1 class="t3-brand t3-deal" style="margin:14px 0 0;">Linejam</h1>
            <p class="t3-serif t3-deal" style="font-weight:300;font-size:20px;color:var(--soft);line-height:1.4;margin:18px 0 0;max-width:24ch;">A poem nine of you build blind, then read aloud when the last line lands.</p>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber" style="margin-bottom:10px;">Start a game</button>
            <button class="t3-btn t3-line">Join a room</button>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick">pull up a chair</p>
            <h2 class="t3-serif" style="font-weight:300;font-size:36px;margin:10px 0 32px;">Join the table</h2>
            <p class="t3-mono" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-bottom:10px;">room code</p>
            <div class="t3-code t3-deal" style="margin-bottom:32px;">PLUM</div>
            <p class="t3-mono" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-bottom:10px;">your pen name</p>
            <input class="t3-in" value="Wren" aria-label="pen name" />
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber">Take a seat</button>
          </div>`;
      },
      lobby(el, corpus) {
        const initial = (n) => n.slice(0, 1).toUpperCase();
        const hue = (n) => 'hsl(' + ((n.charCodeAt(0) * 47) % 360) + ' 46% 62%)';
        const seats = corpus.players.map((p, i) => {
          const mark = seatMark(p);
          const role = mark === 'host' ? 'host' : mark === 'ghost' ? 'ghostwriter' : p.present ? 'seated' : 'away';
          return `<div class="t3-seat ${p.present ? '' : 'away'}${i === 0 ? ' me' : ''} t3-deal" style="animation-delay:${i * 70}ms;">
              <span class="t3-av" style="background:${p.kind === 'ai' ? 'var(--soft)' : hue(p.name)};">${initial(p.name)}</span>
              <span><span class="nm">${p.name}</span><br><span class="rl">${role}</span></span>
              ${p.present ? '<span class="t3-live"></span>' : ''}
            </div>`;
        }).join('');
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick">table code</p>
            <div class="t3-code t3-deal" style="margin:6px 0 4px;">${corpus.roomCode}</div>
            <p class="t3-serif" style="font-weight:300;font-size:17px;color:var(--soft);margin:0 0 24px;">Call it out so everyone can join.</p>
            <div class="t3-arc">
              ${seats}
              <button class="t3-seat empty t3-deal" style="animation-delay:280ms;cursor:pointer;justify-content:center;color:var(--amber);font-weight:500;">+ Add a ghostwriter</button>
            </div>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber">Deal the first line</button>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const drafted = g.draft.split(' ');
        const total = g.wordsThisRound;
        const beads = Array.from({ length: total }, (_, i) => {
          const w = drafted[i];
          const cls = w ? 'set' : i === drafted.length ? 'next' : '';
          return `<span class="t3-bead ${cls}">${w || (i + 1)}</span>`;
        }).join('');
        el.innerHTML = `
          <div class="t3-body">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <p class="t3-kick">it's your turn</p>
              <p class="t3-mono" style="font-size:12px;color:var(--soft);">round <b style="color:var(--ink);">05</b>/09</p>
            </div>
            <div class="t3-card t3-deal">
              <p class="t3-mono" style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin:0 0 10px;">passed to you</p>
              <p class="t3-prev">${g.previousLine}</p>
            </div>
            <p class="t3-mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);margin:26px 0 12px;">answer in five words</p>
            <div class="t3-beads" id="t3beads">${beads}</div>
            <p class="t3-cnt" style="margin-top:14px;"><b id="t3n">${drafted.length}</b> / ${total}</p>
          </div>
          <div class="t3-dock">
            <input class="t3-in" id="t3w" value="${g.draft} " aria-label="your line" style="margin-bottom:10px;" />
            <button class="t3-btn t3-amber" id="t3send" disabled>One more word</button>
          </div>`;
        const input = el.querySelector('#t3w');
        const wrap = el.querySelector('#t3beads');
        const nEl = el.querySelector('#t3n');
        const send = el.querySelector('#t3send');
        const paint = () => {
          const words = input.value.trim().split(/\s+/).filter(Boolean).slice(0, total);
          wrap.querySelectorAll('.t3-bead').forEach((b, i) => {
            b.className = 't3-bead';
            if (words[i]) { b.textContent = words[i]; b.classList.add('set'); }
            else { b.textContent = String(i + 1); if (i === words.length) b.classList.add('next'); }
          });
          nEl.textContent = String(words.length);
          if (words.length === total) { send.disabled = false; send.textContent = 'Pass it on'; }
          else { send.disabled = true; send.textContent = 'One more word'; }
        };
        input.addEventListener('input', paint);
        paint();
      },
      wait(el, corpus) {
        el.innerHTML = `
          <div class="t3-body" style="justify-content:center;text-align:center;align-items:center;">
            <div class="t3-glow" style="width:12px;height:12px;border-radius:50%;background:var(--amber);margin-bottom:26px;"></div>
            <h2 class="t3-serif t3-deal" style="font-weight:300;font-size:40px;margin:0 0 12px;">Passed on.</h2>
            <p class="t3-serif" style="font-weight:300;font-size:19px;color:var(--soft);max-width:22ch;line-height:1.4;margin:0 0 34px;">Your line is on its way around the table.</p>
            <div class="t3-seat t3-deal" style="max-width:210px;">
              <span class="t3-av" style="background:hsl(210 46% 62%);">${corpus.game.waitingOn[0].slice(0, 1)}</span>
              <span><span class="nm">${corpus.game.waitingOn[0]}</span><br><span class="rl">still writing</span></span>
              <span class="t3-live t3-glow"></span>
            </div>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-line" disabled>Waiting on the table</button>
          </div>`;
      },
      reveal(el, corpus) {
        const cur = corpus.revealQueue[0];
        const next = corpus.revealQueue[1];
        const verses = corpus.poem.lines.map((ln, i) =>
          `<p class="t3-verse t3-deal" style="animation-delay:${i * 55}ms;margin:0 0 10px;">${ln.text}<span class="by">${ln.author}</span></p>`
        ).join('');
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick">the reading</p>
            <div class="t3-card t3-deal" style="margin:12px 0 22px;display:flex;align-items:center;gap:14px;">
              <span class="t3-av" style="background:var(--amber);width:44px;height:44px;font-size:19px;">${cur.reader.slice(0, 1)}</span>
              <span>
                <span class="t3-mono" style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);">now reading</span><br>
                <span class="t3-serif" style="font-size:23px;">${cur.reader}, out loud</span>
              </span>
            </div>
            <p class="t3-mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);margin-bottom:14px;">${corpus.poem.title}</p>
            ${verses}
            <p class="t3-mono" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-top:20px;border-top:1px solid var(--line);padding-top:14px;">up next · ${next.reader} reads ${next.poem}</p>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber">Deal the next poem</button>
          </div>`;
      },
    },
  };
})();
