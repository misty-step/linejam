// Lane: anthro — three complete system propositions for Linejam's mobile loop.
// Each option obeys one coherent design system across all six screens.
// Grounded in the game's own world: the exquisite-corpse fold, the
// 1·2·3·4·5·4·3·2·1 word-count diamond, and the read-aloud finale.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function words(s) {
    const t = (s || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /* =========================================================================
     ANTHRO-1 · "Passed"
     One continuous roll of note paper. The crease is the fold you can't see
     past; a punched ruler down the margin counts the words. Blue ballpoint
     on manila, one red margin rule that carries the bylines and counts.
     Inverts: screens are separate pages -> the game is one document.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-1'] = {
    lane: 'anthro',
    title: 'Passed',
    move: 'The game is one paper roll creased into segments; you only see past the last fold, and a margin ruler punches out the word count.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

      .opt-ANTHRO-1 {
        --paper:#e6e1d3; --paper-2:#ddd6c4; --crease:#c4bca6;
        --ink:#201c15; --pen:#26478a; --margin:#b5473c; --muted:#7e7768;
        background:var(--paper); color:var(--ink);
        font-family:'Hanken Grotesk',system-ui,sans-serif;
      }
      .opt-ANTHRO-1 .a1{ height:100%; display:flex; flex-direction:column; position:relative;
        background:
          linear-gradient(var(--paper),var(--paper)); }
      .opt-ANTHRO-1 .a1-margin{ position:absolute; top:0; bottom:0; left:34px; width:1px;
        background:var(--margin); opacity:.5; }
      .opt-ANTHRO-1 .a1-body{ flex:1; overflow-y:auto; padding:22px 22px 14px 52px; }
      .opt-ANTHRO-1 .a1-foot{ flex:none; padding:14px 20px calc(18px + env(safe-area-inset-bottom));
        border-top:1px solid var(--crease); background:var(--paper-2); }
      .opt-ANTHRO-1 .eyebrow{ font:700 11px/1 'JetBrains Mono',monospace; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-1 .perf{ border:0; border-top:2px dashed var(--crease); margin:0 0 20px; }
      .opt-ANTHRO-1 .crease{ position:relative; height:0; border-top:1px solid var(--crease);
        margin:22px -22px 22px -52px; box-shadow:0 1px 0 #efe9db, 0 -3px 6px -4px rgba(0,0,0,.18); }
      .opt-ANTHRO-1 .crease span{ position:absolute; left:52px; top:-9px; background:var(--paper);
        padding:0 8px; font:700 10px/1 'JetBrains Mono',monospace; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); }

      .opt-ANTHRO-1 .brand{ font:500 54px/.92 'Newsreader',serif; letter-spacing:-.01em; margin:8px 0 0; }
      .opt-ANTHRO-1 .brand em{ font-style:italic; color:var(--pen); }
      .opt-ANTHRO-1 .tag{ font:400 18px/1.4 'Newsreader',serif; color:var(--ink); margin:14px 0 0; max-width:22ch; }
      .opt-ANTHRO-1 .rulepoem{ margin:26px 0 0; font:italic 400 19px/1.9 'Newsreader',serif; color:var(--muted); }

      .opt-ANTHRO-1 .btn{ display:block; width:100%; min-height:52px; border-radius:2px; cursor:pointer;
        font:700 16px/1 'Hanken Grotesk',sans-serif; letter-spacing:.01em; }
      .opt-ANTHRO-1 .btn-ink{ background:var(--pen); color:#f4f1e8; border:1px solid var(--pen); }
      .opt-ANTHRO-1 .btn-ghost{ background:transparent; color:var(--ink); border:1px solid var(--ink);
        margin-top:10px; min-height:48px; }
      .opt-ANTHRO-1 .btn:active{ transform:translateY(1px); }

      .opt-ANTHRO-1 .label{ font:700 11px/1 'JetBrains Mono',monospace; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); display:block; margin-bottom:8px; }
      .opt-ANTHRO-1 .slots{ display:flex; gap:8px; }
      .opt-ANTHRO-1 .slot{ flex:1; aspect-ratio:3/4; display:grid; place-items:center;
        border:1px solid var(--crease); background:#efe9db; border-radius:2px;
        font:700 30px/1 'JetBrains Mono',monospace; color:var(--pen); }
      .opt-ANTHRO-1 .slot.caret{ color:var(--muted); border-color:var(--pen); }
      .opt-ANTHRO-1 .field{ width:100%; margin-top:8px; padding:14px 12px; border:1px solid var(--crease);
        background:#efe9db; border-radius:2px; font:italic 400 19px/1 'Newsreader',serif; color:var(--ink); }
      .opt-ANTHRO-1 .field::placeholder{ color:var(--muted); }

      .opt-ANTHRO-1 .code-big{ font:700 62px/1 'JetBrains Mono',monospace; letter-spacing:.12em;
        color:var(--pen); margin:6px 0 4px; }
      .opt-ANTHRO-1 .roster{ list-style:none; margin:20px 0 0; padding:0; }
      .opt-ANTHRO-1 .roster li{ display:flex; align-items:baseline; gap:10px; padding:11px 0;
        border-bottom:1px solid var(--crease); }
      .opt-ANTHRO-1 .dot{ width:9px; height:9px; border-radius:50%; flex:none; align-self:center; }
      .opt-ANTHRO-1 .dot.on{ background:var(--pen); }
      .opt-ANTHRO-1 .dot.off{ background:transparent; border:1px solid var(--muted); }
      .opt-ANTHRO-1 .nm{ font:500 20px/1 'Newsreader',serif; }
      .opt-ANTHRO-1 .meta{ margin-left:auto; font:700 10px/1 'JetBrains Mono',monospace;
        letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-1 .meta.host{ color:var(--pen); }
      .opt-ANTHRO-1 .addbot{ margin-top:14px; width:100%; min-height:46px; border:1px dashed var(--pen);
        background:transparent; color:var(--pen); border-radius:2px; cursor:pointer;
        font:700 13px/1 'JetBrains Mono',monospace; letter-spacing:.08em; text-transform:uppercase; }

      .opt-ANTHRO-1 .given{ font:400 26px/1.35 'Newsreader',serif; color:var(--ink); }
      .opt-ANTHRO-1 .writewrap{ position:relative; margin-top:4px; }
      .opt-ANTHRO-1 .punches{ position:absolute; left:-24px; top:6px; display:flex; flex-direction:column; gap:9px; }
      .opt-ANTHRO-1 .punch{ width:11px; height:11px; border-radius:50%; border:1px solid var(--pen); }
      .opt-ANTHRO-1 .punch.filled{ background:var(--pen); }
      .opt-ANTHRO-1 .writein{ width:100%; min-height:120px; resize:none; border:0; outline:0;
        background:repeating-linear-gradient(transparent,transparent 37px,var(--crease) 37px,var(--crease) 38px);
        line-height:38px; padding:0; font:italic 400 24px/38px 'Newsreader',serif; color:var(--pen); }
      .opt-ANTHRO-1 .count{ margin-top:14px; font:700 12px/1 'JetBrains Mono',monospace;
        letter-spacing:.1em; color:var(--muted); }
      .opt-ANTHRO-1 .count b{ color:var(--pen); }

      .opt-ANTHRO-1 .fold-note{ text-align:center; margin-top:80px; }
      .opt-ANTHRO-1 .fold-mark{ font:700 12px/1 'JetBrains Mono',monospace; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-1 .fold-to{ font:500 34px/1.2 'Newsreader',serif; margin:14px 0 0; }
      .opt-ANTHRO-1 .fold-to em{ font-style:italic; color:var(--pen); }
      .opt-ANTHRO-1 .fold-sub{ font:400 17px/1.5 'Newsreader',serif; color:var(--muted); margin:18px auto 0; max-width:24ch; }
      .opt-ANTHRO-1 .creaseanim{ margin:34px auto 0; width:70%; height:1px; background:var(--crease);
        box-shadow:0 -6px 10px -6px rgba(0,0,0,.25); animation:a1fold 2.6s ease-in-out infinite; }
      @keyframes a1fold{ 0%,100%{transform:scaleX(1);opacity:.5} 50%{transform:scaleX(.4);opacity:1} }

      .opt-ANTHRO-1 .queue{ list-style:none; margin:14px 0 0; padding:0; }
      .opt-ANTHRO-1 .queue li{ display:flex; gap:12px; align-items:baseline; padding:9px 0; }
      .opt-ANTHRO-1 .qn{ font:700 13px/1 'JetBrains Mono',monospace; color:var(--pen); }
      .opt-ANTHRO-1 .qmeta{ font:400 16px/1.3 'Newsreader',serif; color:var(--muted); }
      .opt-ANTHRO-1 .poem-t{ font:italic 500 30px/1.1 'Newsreader',serif; margin:0; }
      .opt-ANTHRO-1 .pline{ position:relative; padding:10px 0 10px 0; }
      .opt-ANTHRO-1 .pcount{ position:absolute; left:-24px; top:15px; font:700 11px/1 'JetBrains Mono',monospace; color:var(--margin); }
      .opt-ANTHRO-1 .ptext{ font:400 23px/1.3 'Newsreader',serif; }
      .opt-ANTHRO-1 .pby{ font:400 13px/1 'Hanken Grotesk',sans-serif; color:var(--muted); margin-top:3px; }
      .opt-ANTHRO-1 .reveal-in{ animation:a1rise .5s ease both; }
      @keyframes a1rise{ from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-1 .creaseanim{ animation:none; }
        .opt-ANTHRO-1 .reveal-in{ animation:none; }
      }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="a1">
            <div class="a1-body">
              <hr class="perf" />
              <p class="eyebrow">pass-a-poem</p>
              <h1 class="brand">line<em>jam</em></h1>
              <p class="tag">Pass a poem around the table. You only ever see the line before yours.</p>
              <p class="rulepoem">one word, then two, then three &hellip;<br/>fold it, hand it on.</p>
            </div>
            <div class="a1-foot">
              <button class="btn btn-ink">Start a game</button>
              <button class="btn btn-ghost">Join a room</button>
            </div>
          </div>`;
      },
      join(el, corpus) {
        const letters = corpus.roomCode.split('');
        el.innerHTML = `
          <div class="a1">
            <div class="a1-margin"></div>
            <div class="a1-body">
              <p class="eyebrow">slip in</p>
              <h2 class="brand" style="font-size:38px;margin-top:6px">Join a room</h2>
              <div style="margin-top:26px">
                <span class="label">Room code</span>
                <div class="slots">
                  ${letters.map((c) => `<div class="slot">${c}</div>`).join('')}
                </div>
              </div>
              <div style="margin-top:22px">
                <span class="label">Pen name</span>
                <input class="field" value="Wren" aria-label="Your pen name" />
              </div>
            </div>
            <div class="a1-foot">
              <button class="btn btn-ink">Join room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        el.innerHTML = `
          <div class="a1">
            <div class="a1-margin"></div>
            <div class="a1-body">
              <p class="eyebrow">friends type this</p>
              <div class="code-big">${corpus.roomCode}</div>
              <p class="tag" style="font-size:16px;margin-top:2px">Everyone at the table joins with this code.</p>
              <ul class="roster">
                ${corpus.players
                  .map(
                    (p) => `<li>
                      <span class="dot ${p.present ? 'on' : 'off'}"></span>
                      <span class="nm">${p.name}</span>
                      <span class="meta ${p.host ? 'host' : ''}">${p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? 'here' : 'away'}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
              <button class="addbot">+ Add a ghost writer</button>
            </div>
            <div class="a1-foot">
              <button class="btn btn-ink">Start the game</button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        el.innerHTML = `
          <div class="a1">
            <div class="a1-margin"></div>
            <div class="a1-body">
              <p class="eyebrow">round ${g.round} of ${g.totalRounds} &middot; ${g.wordsThisRound} words</p>
              <p class="given">${g.previousLine}</p>
              <div class="crease"><span>fold &mdash; the rest is hidden</span></div>
              <div class="writewrap">
                <div class="punches">
                  ${[0, 1, 2, 3, 4].map(() => `<span class="punch"></span>`).join('')}
                </div>
                <textarea class="writein" spellcheck="false" aria-label="Your line">${g.draft}</textarea>
              </div>
              <p class="count"><b class="wnow">4</b> of ${g.wordsThisRound} words</p>
            </div>
            <div class="a1-foot">
              <button class="btn btn-ink">Pass it on</button>
            </div>
          </div>`;
        const ta = el.querySelector('.writein');
        const punches = el.querySelectorAll('.punch');
        const wnow = el.querySelector('.wnow');
        const need = g.wordsThisRound;
        const sync = () => {
          const n = Math.min(words(ta.value), need);
          punches.forEach((p, i) => p.classList.toggle('filled', i < n));
          wnow.textContent = String(n);
        };
        ta.addEventListener('input', sync);
        sync();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn[0];
        el.innerHTML = `
          <div class="a1">
            <div class="a1-margin"></div>
            <div class="a1-body">
              <div class="fold-note">
                <p class="fold-mark">folded and passed</p>
                <h2 class="fold-to">now with <em>${waiting}</em></h2>
                <div class="creaseanim"></div>
                <p class="fold-sub">Your line is tucked away. ${waiting} is still writing.</p>
              </div>
            </div>
            <div class="a1-foot">
              <p class="count" style="text-align:center;margin:0"><b>2</b> poems, ready to read soon</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const p = corpus.poem;
        el.innerHTML = `
          <div class="a1">
            <div class="a1-margin"></div>
            <div class="a1-body">
              <p class="eyebrow">read aloud, in order</p>
              <ul class="queue">
                ${corpus.revealQueue
                  .map(
                    (q, i) => `<li><span class="qn">${String(i + 1).padStart(2, '0')}</span>
                      <span class="qmeta"><strong style="color:var(--ink);font-weight:500">${q.reader}</strong> reads ${q.poem}</span></li>`
                  )
                  .join('')}
              </ul>
              <div class="crease" style="margin-top:20px"><span>${p.title}, unrolled</span></div>
              <div class="reveal-in">
                ${p.lines
                  .map(
                    (l) => `<div class="pline">
                      <span class="pcount">${words(l.text)}</span>
                      <div class="ptext">${l.text}</div>
                      <div class="pby">${l.author}</div>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="a1-foot">
              <button class="btn btn-ink">Read the next poem</button>
            </div>
          </div>`;
      },
    },
  };

  /* =========================================================================
     ANTHRO-2 · "The Shape of It"
     The 1·2·3·4·5·4·3·2·1 word-count constraint is the interface. Words land
     in filling rungs; the round is a position on the diamond; the reveal is
     the poem's own silhouette. Ink-pine on bone, marigold as the "lit" fill.
     Inverts: the input is a text field -> the constraint is a filling gauge;
              the reveal is tap-per-poem -> one scrolled diamond.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-2'] = {
    lane: 'anthro',
    title: 'The Shape of It',
    move: 'Render the word-count constraint as a filling rung gauge and make the poem’s own 1-2-3-4-5-4-3-2-1 diamond the reveal.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&display=swap');

      .opt-ANTHRO-2 {
        --bone:#efece3; --bone-2:#e5e1d5; --ink:#12312e; --fill:#e0a32e;
        --fill-soft:#f3e2be; --line:#cbc6b8; --muted:#5f6f68;
        background:var(--bone); color:var(--ink);
        font-family:'Space Grotesk',system-ui,sans-serif;
      }
      .opt-ANTHRO-2 .a2{ height:100%; display:flex; flex-direction:column; }
      .opt-ANTHRO-2 .a2-body{ flex:1; overflow-y:auto; padding:26px 24px 16px; }
      .opt-ANTHRO-2 .a2-foot{ flex:none; padding:14px 20px calc(18px + env(safe-area-inset-bottom));
        border-top:1px solid var(--line); background:var(--bone-2); }
      .opt-ANTHRO-2 .kick{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.2em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-2 .disp{ font:400 52px/.94 'Instrument Serif',serif; letter-spacing:.005em; margin:10px 0 0; }
      .opt-ANTHRO-2 .disp .it{ font-style:italic; }
      .opt-ANTHRO-2 .sub{ font:italic 400 22px/1.4 'Instrument Serif',serif; color:var(--muted); margin:12px 0 0; }

      .opt-ANTHRO-2 .btn{ display:block; width:100%; min-height:52px; border-radius:1px; cursor:pointer;
        font:600 15px/1 'Space Grotesk',sans-serif; letter-spacing:.06em; text-transform:uppercase; }
      .opt-ANTHRO-2 .btn-fill{ background:var(--ink); color:var(--bone); border:1px solid var(--ink); }
      .opt-ANTHRO-2 .btn-line{ background:transparent; color:var(--ink); border:1px solid var(--ink);
        margin-top:10px; min-height:48px; }
      .opt-ANTHRO-2 .btn:active{ transform:translateY(1px); }

      /* diamond mark: 9 centered rungs, widths 1..5..1 */
      .opt-ANTHRO-2 .diamond{ display:flex; flex-direction:column; align-items:center; gap:7px; margin:6px 0; }
      .opt-ANTHRO-2 .rung{ height:9px; border-radius:1px; background:var(--fill-soft); }
      .opt-ANTHRO-2 .rung.lit{ background:var(--fill); }
      .opt-ANTHRO-2 .rung.here{ background:var(--ink); }

      .opt-ANTHRO-2 .field-l{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); display:block; margin:0 0 9px; }
      .opt-ANTHRO-2 .codeslots{ display:flex; gap:10px; }
      .opt-ANTHRO-2 .cs{ flex:1; aspect-ratio:1; display:grid; place-items:center; border:1.5px solid var(--ink);
        background:transparent; font:400 40px/1 'Instrument Serif',serif; }
      .opt-ANTHRO-2 .field{ width:100%; padding:15px 12px; border:1.5px solid var(--ink); background:transparent;
        font:italic 400 22px/1 'Instrument Serif',serif; color:var(--ink); border-radius:1px; }

      .opt-ANTHRO-2 .code-mega{ font:400 74px/1 'Instrument Serif',serif; letter-spacing:.06em; margin:2px 0; }
      .opt-ANTHRO-2 .roster{ list-style:none; margin:22px 0 0; padding:0; }
      .opt-ANTHRO-2 .roster li{ display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--line); }
      .opt-ANTHRO-2 .pin{ width:14px; height:14px; flex:none; border:1.5px solid var(--ink); border-radius:50%; }
      .opt-ANTHRO-2 .pin.on{ background:var(--fill); border-color:var(--fill); }
      .opt-ANTHRO-2 .pin.ai{ border-radius:2px; }
      .opt-ANTHRO-2 .rn{ font:400 24px/1 'Instrument Serif',serif; }
      .opt-ANTHRO-2 .rtag{ margin-left:auto; font:600 10px/1 'Space Grotesk',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-2 .rtag.h{ color:var(--ink); }
      .opt-ANTHRO-2 .addbot{ margin-top:16px; width:100%; min-height:48px; border:1.5px dashed var(--ink);
        background:transparent; color:var(--ink); cursor:pointer; border-radius:1px;
        font:600 12px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; text-transform:uppercase; }

      .opt-ANTHRO-2 .given-l{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-2 .given{ font:400 30px/1.35 'Instrument Serif',serif; margin:8px 0 0; }
      .opt-ANTHRO-2 .gauge-l{ display:flex; justify-content:space-between; align-items:baseline; margin:30px 0 10px; }
      .opt-ANTHRO-2 .gauge-l .n{ font:600 13px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; color:var(--muted); }
      .opt-ANTHRO-2 .gauge-l .n b{ color:var(--ink); font-size:16px; }
      .opt-ANTHRO-2 .gauge{ display:flex; gap:8px; }
      .opt-ANTHRO-2 .cell{ flex:1; height:56px; border:1.5px solid var(--ink); border-radius:1px;
        display:grid; place-items:center; background:transparent; transition:background .18s ease;
        font:italic 400 19px/1 'Instrument Serif',serif; color:var(--ink); overflow:hidden; }
      .opt-ANTHRO-2 .cell.on{ background:var(--fill); }
      .opt-ANTHRO-2 .cell.next{ box-shadow:inset 0 0 0 2px var(--fill); }
      .opt-ANTHRO-2 .wordin{ width:100%; margin-top:22px; padding:12px 0; border:0; border-bottom:1.5px solid var(--ink);
        outline:0; background:transparent; font:italic 400 24px/1.3 'Instrument Serif',serif; color:var(--ink); }

      .opt-ANTHRO-2 .waitwrap{ text-align:center; padding-top:40px; }
      .opt-ANTHRO-2 .wait-h{ font:400 34px/1.15 'Instrument Serif',serif; margin:22px 0 0; }
      .opt-ANTHRO-2 .wait-h .it{ font-style:italic; }
      .opt-ANTHRO-2 .wait-s{ font:italic 400 19px/1.5 'Instrument Serif',serif; color:var(--muted); margin:16px auto 0; max-width:24ch; }
      .opt-ANTHRO-2 .rowgauge{ display:flex; gap:10px; justify-content:center; margin-top:8px; }
      .opt-ANTHRO-2 .rc{ width:44px; height:44px; border:1.5px solid var(--ink); border-radius:1px; display:grid; place-items:center;
        font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.04em; }
      .opt-ANTHRO-2 .rc.done{ background:var(--fill); }
      .opt-ANTHRO-2 .rc.wait{ animation:a2pulse 1.6s ease-in-out infinite; }
      @keyframes a2pulse{ 0%,100%{background:transparent} 50%{background:var(--fill-soft)} }

      .opt-ANTHRO-2 .queue{ list-style:none; margin:14px 0 20px; padding:0; }
      .opt-ANTHRO-2 .queue li{ display:flex; gap:12px; align-items:baseline; padding:8px 0; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-2 .qn{ font:600 12px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; color:var(--muted); }
      .opt-ANTHRO-2 .qt{ font:400 18px/1.3 'Instrument Serif',serif; }
      .opt-ANTHRO-2 .qt b{ font-weight:400; font-style:italic; }
      .opt-ANTHRO-2 .poemtitle{ font:italic 400 26px/1 'Instrument Serif',serif; text-align:center; margin:6px 0 18px; color:var(--muted); }
      .opt-ANTHRO-2 .shape{ display:flex; flex-direction:column; align-items:center; gap:14px; }
      .opt-ANTHRO-2 .sline{ text-align:center; }
      .opt-ANTHRO-2 .sword{ font:400 22px/1.2 'Instrument Serif',serif; }
      .opt-ANTHRO-2 .sbar{ height:7px; background:var(--fill); border-radius:1px; margin:7px auto 0; }
      .opt-ANTHRO-2 .sby{ font:500 11px/1 'Space Grotesk',sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-top:6px; }
      .opt-ANTHRO-2 .assemble .sline{ animation:a2grow .5s ease both; }
      @keyframes a2grow{ from{opacity:0; transform:scaleX(.6)} to{opacity:1; transform:none} }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-2 .rc.wait{ animation:none; background:var(--fill-soft); }
        .opt-ANTHRO-2 .assemble .sline{ animation:none; }
        .opt-ANTHRO-2 .cell{ transition:none; }
      }
    `,
    screens: {
      home(el, corpus) {
        const rungs = corpus.wordCounts
          .map((w) => `<div class="rung" style="width:${w * 34}px"></div>`)
          .join('');
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <p class="kick">nine lines &middot; one shape</p>
              <h1 class="disp">Line<span class="it">jam</span></h1>
              <div class="diamond" style="margin-top:34px">${rungs}</div>
              <p class="sub">A poem grows one word, to five, and back to one. You write the widening middle.</p>
            </div>
            <div class="a2-foot">
              <button class="btn btn-fill">Start a game</button>
              <button class="btn btn-line">Join a room</button>
            </div>
          </div>`;
      },
      join(el, corpus) {
        const letters = corpus.roomCode.split('');
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <p class="kick">join a room</p>
              <h2 class="disp" style="font-size:40px">Slip into<br/>the game.</h2>
              <div style="margin-top:30px">
                <span class="field-l">Room code</span>
                <div class="codeslots">${letters.map((c) => `<div class="cs">${c}</div>`).join('')}</div>
              </div>
              <div style="margin-top:24px">
                <span class="field-l">Pen name</span>
                <input class="field" value="Wren" aria-label="Your pen name" />
              </div>
            </div>
            <div class="a2-foot">
              <button class="btn btn-fill">Join room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <p class="kick">friends type this</p>
              <div class="code-mega">${corpus.roomCode}</div>
              <p class="sub" style="font-size:18px;margin-top:4px">Nine lines, four pens. Waiting to begin.</p>
              <ul class="roster">
                ${corpus.players
                  .map(
                    (p) => `<li>
                      <span class="pin ${p.present ? 'on' : ''} ${p.kind === 'ai' ? 'ai' : ''}"></span>
                      <span class="rn">${p.name}</span>
                      <span class="rtag ${p.host ? 'h' : ''}">${p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? 'ready' : 'away'}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
              <button class="addbot">+ Add a ghost writer</button>
            </div>
            <div class="a2-foot">
              <button class="btn btn-fill">Start the game</button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const cells = Array.from({ length: g.wordsThisRound })
          .map(() => `<div class="cell"></div>`)
          .join('');
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <p class="kick">round ${g.round} of ${g.totalRounds} &middot; the widest line</p>
              <p class="given-l" style="margin-top:16px">the line before yours</p>
              <p class="given">${g.previousLine}</p>

              <div class="gauge-l">
                <span class="n">your line</span>
                <span class="n"><b class="wnow">4</b> / ${g.wordsThisRound} words</span>
              </div>
              <div class="gauge">${cells}</div>
              <input class="wordin" value="${g.draft}" aria-label="Your line" placeholder="one word at a time" />
            </div>
            <div class="a2-foot">
              <button class="btn btn-fill">Add your line</button>
            </div>
          </div>`;
        const input = el.querySelector('.wordin');
        const cellEls = el.querySelectorAll('.cell');
        const wnow = el.querySelector('.wnow');
        const need = g.wordsThisRound;
        const sync = () => {
          const list = input.value.trim() ? input.value.trim().split(/\s+/) : [];
          const n = Math.min(list.length, need);
          cellEls.forEach((c, i) => {
            c.classList.toggle('on', i < n);
            c.classList.toggle('next', i === n && n < need);
            c.textContent = list[i] || '';
          });
          wnow.textContent = String(n);
        };
        input.addEventListener('input', sync);
        sync();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn[0];
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <div class="waitwrap">
                <div class="rowgauge">
                  <div class="rc done">you</div>
                  <div class="rc wait">${waiting}</div>
                </div>
                <h2 class="wait-h">Your word is <span class="it">in.</span></h2>
                <p class="wait-s">${waiting} is finishing this line. The shape fills as everyone lands.</p>
              </div>
            </div>
            <div class="a2-foot">
              <p class="kick" style="text-align:center">2 poems taking shape</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const p = corpus.poem;
        const max = Math.max(...p.lines.map((l) => words(l.text)));
        el.innerHTML = `
          <div class="a2">
            <div class="a2-body">
              <p class="kick">read aloud, in order</p>
              <ul class="queue">
                ${corpus.revealQueue
                  .map(
                    (q, i) => `<li><span class="qn">${String(i + 1).padStart(2, '0')}</span>
                      <span class="qt"><b>${q.reader}</b> reads ${q.poem}</span></li>`
                  )
                  .join('')}
              </ul>
              <p class="poemtitle">${p.title}</p>
              <div class="shape assemble">
                ${p.lines
                  .map((l) => {
                    const w = words(l.text);
                    return `<div class="sline">
                      <div class="sword">${l.text}</div>
                      <div class="sbar" style="width:${(w / max) * 220}px"></div>
                      <div class="sby">${l.author}</div>
                    </div>`;
                  })
                  .join('')}
              </div>
            </div>
            <div class="a2-foot">
              <button class="btn btn-fill">Read the next poem</button>
            </div>
          </div>`;
      },
    },
  };

  /* =========================================================================
     ANTHRO-3 · "Aloud"
     The phone is a lit stage. Performance typography, bottom-anchored
     controls, and a single continuous read-aloud reveal with reader billing.
     Cream on claret, footlight gold. Cards are the paper you write on; the
     reveal dims the house to the reader's spotlight.
     Inverts: chrome at top -> bottom-anchored; reveal tap-per-poem ->
              one continuous performance with billing.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-3'] = {
    lane: 'anthro',
    title: 'Aloud',
    move: 'Treat the phone as a lit stage: performance type on claret, bottom-anchored controls, and one continuous read-aloud reveal billed like a program.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap');

      .opt-ANTHRO-3 {
        --stage:#5a1f24; --stage-2:#4a181d; --cream:#f5ebdd; --gold:#d9a441;
        --ink:#2a1012; --dim:rgba(245,235,221,.66); --line:rgba(245,235,221,.22);
        background:var(--stage); color:var(--cream);
        font-family:'Bricolage Grotesque',system-ui,sans-serif;
      }
      .opt-ANTHRO-3 .a3{ height:100%; display:flex; flex-direction:column; background:var(--stage); }
      .opt-ANTHRO-3 .a3-body{ flex:1; overflow-y:auto; padding:26px 24px 16px; }
      .opt-ANTHRO-3 .a3-foot{ flex:none; padding:16px 20px calc(20px + env(safe-area-inset-bottom));
        border-top:1px solid var(--line); }
      .opt-ANTHRO-3 .bill{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.22em;
        text-transform:uppercase; color:var(--gold); }
      .opt-ANTHRO-3 .rule-g{ height:2px; background:var(--gold); border:0; margin:16px 0; opacity:.85; }

      .opt-ANTHRO-3 .marquee{ font:800 62px/.9 'Bricolage Grotesque',sans-serif; letter-spacing:-.02em; margin:14px 0 0; }
      .opt-ANTHRO-3 .lede{ font:italic 400 24px/1.35 'Fraunces',serif; color:var(--cream); margin:20px 0 0; max-width:20ch; }
      .opt-ANTHRO-3 .fine{ font:400 15px/1.5 'Bricolage Grotesque',sans-serif; color:var(--dim); margin:14px 0 0; }

      .opt-ANTHRO-3 .btn{ display:block; width:100%; min-height:54px; border-radius:3px; cursor:pointer;
        font:700 16px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.02em; }
      .opt-ANTHRO-3 .btn-gold{ background:var(--gold); color:var(--ink); border:1px solid var(--gold); }
      .opt-ANTHRO-3 .btn-out{ background:transparent; color:var(--cream); border:1px solid var(--cream);
        margin-top:10px; min-height:50px; }
      .opt-ANTHRO-3 .btn:active{ transform:translateY(1px); }

      .opt-ANTHRO-3 .card{ background:var(--cream); color:var(--ink); border-radius:6px; padding:22px 20px; }
      .opt-ANTHRO-3 .lab{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:#8a5a2e; display:block; margin-bottom:10px; }
      .opt-ANTHRO-3 .slots{ display:flex; gap:9px; }
      .opt-ANTHRO-3 .slot{ flex:1; aspect-ratio:4/5; display:grid; place-items:center; border:2px solid var(--ink);
        border-radius:4px; font:700 34px/1 'Bricolage Grotesque',sans-serif; color:var(--stage); }
      .opt-ANTHRO-3 .field{ width:100%; padding:15px 12px; border:2px solid var(--ink); border-radius:4px;
        background:transparent; font:italic 400 22px/1 'Fraunces',serif; color:var(--ink); }

      .opt-ANTHRO-3 .code-h{ font:800 78px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.02em; margin:6px 0; color:var(--gold); }
      .opt-ANTHRO-3 .cast{ list-style:none; margin:18px 0 0; padding:0; }
      .opt-ANTHRO-3 .cast li{ display:flex; align-items:center; gap:14px; padding:13px 0; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-3 .seat{ width:34px; height:34px; flex:none; border-radius:50%; display:grid; place-items:center;
        border:1.5px solid var(--line); font:700 14px/1 'Bricolage Grotesque',sans-serif; color:var(--cream); }
      .opt-ANTHRO-3 .seat.here{ background:var(--cream); color:var(--stage); border-color:var(--cream); }
      .opt-ANTHRO-3 .seat.ai{ border-color:var(--gold); color:var(--gold); }
      .opt-ANTHRO-3 .cname{ font:600 22px/1 'Bricolage Grotesque',sans-serif; }
      .opt-ANTHRO-3 .crole{ margin-left:auto; font:italic 400 16px/1 'Fraunces',serif; color:var(--dim); }
      .opt-ANTHRO-3 .crole.host{ color:var(--gold); font-style:normal; font-family:'Bricolage Grotesque',sans-serif;
        font-weight:700; font-size:11px; letter-spacing:.14em; text-transform:uppercase; }
      .opt-ANTHRO-3 .addbot{ margin-top:16px; width:100%; min-height:50px; border:1.5px dashed var(--gold);
        background:transparent; color:var(--gold); border-radius:4px; cursor:pointer;
        font:700 13px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.06em; }

      .opt-ANTHRO-3 .cue{ font:italic 400 15px/1.4 'Fraunces',serif; color:#8a5a2e; }
      .opt-ANTHRO-3 .given{ font:400 28px/1.3 'Fraunces',serif; color:var(--ink); margin:6px 0 0; }
      .opt-ANTHRO-3 .foots{ display:flex; gap:10px; justify-content:center; margin:24px 0 6px; }
      .opt-ANTHRO-3 .foot-dot{ width:16px; height:16px; border-radius:50%; border:2px solid #b98a3e; background:transparent; transition:background .15s ease; }
      .opt-ANTHRO-3 .foot-dot.lit{ background:var(--gold); border-color:var(--gold); box-shadow:0 0 10px 1px rgba(217,164,65,.5); }
      .opt-ANTHRO-3 .sayin{ width:100%; margin-top:12px; padding:12px 0; border:0; border-bottom:2px solid var(--ink);
        outline:0; background:transparent; font:italic 400 26px/1.3 'Fraunces',serif; color:var(--ink); }
      .opt-ANTHRO-3 .cardnote{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:#8a5a2e; text-align:right; margin-top:14px; }

      .opt-ANTHRO-3 .interlude{ text-align:center; padding-top:44px; }
      .opt-ANTHRO-3 .il-k{ font:700 12px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); }
      .opt-ANTHRO-3 .il-h{ font:400 40px/1.1 'Fraunces',serif; margin:20px 0 0; }
      .opt-ANTHRO-3 .il-h em{ font-style:italic; }
      .opt-ANTHRO-3 .glow{ width:140px; height:140px; margin:26px auto 0; border-radius:50%;
        background:radial-gradient(circle, rgba(217,164,65,.5), rgba(217,164,65,0) 70%);
        animation:a3glow 2.4s ease-in-out infinite; }
      @keyframes a3glow{ 0%,100%{opacity:.4; transform:scale(.9)} 50%{opacity:1; transform:scale(1.05)} }
      .opt-ANTHRO-3 .il-s{ font:italic 400 19px/1.5 'Fraunces',serif; color:var(--dim); margin:8px auto 0; max-width:24ch; }

      .opt-ANTHRO-3 .now{ font:700 12px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); }
      .opt-ANTHRO-3 .reader{ font:800 40px/1 'Bricolage Grotesque',sans-serif; margin:8px 0 2px; }
      .opt-ANTHRO-3 .reads{ font:italic 400 18px/1 'Fraunces',serif; color:var(--dim); }
      .opt-ANTHRO-3 .stage-poem{ margin:22px 0 0; }
      .opt-ANTHRO-3 .verse{ padding:11px 0; }
      .opt-ANTHRO-3 .verse .vt{ font:400 27px/1.28 'Fraunces',serif; color:var(--cream); }
      .opt-ANTHRO-3 .verse .vby{ font:700 10px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.12em;
        text-transform:uppercase; color:var(--gold); margin-top:5px; }
      .opt-ANTHRO-3 .spotlit .verse{ animation:a3up .5s ease both; }
      @keyframes a3up{ from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }
      .opt-ANTHRO-3 .upnext{ margin-top:22px; padding-top:16px; border-top:1px solid var(--line);
        font:italic 400 17px/1.4 'Fraunces',serif; color:var(--dim); }
      .opt-ANTHRO-3 .upnext b{ color:var(--cream); font-style:normal; font-family:'Bricolage Grotesque',sans-serif; font-weight:700; }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-3 .glow{ animation:none; }
        .opt-ANTHRO-3 .spotlit .verse{ animation:none; }
        .opt-ANTHRO-3 .foot-dot{ transition:none; }
      }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="bill">tonight, at your table</p>
              <hr class="rule-g" />
              <h1 class="marquee">Linejam</h1>
              <p class="lede">A poem you write blind and read out loud.</p>
              <p class="fine">Pass the phone, add a line, then gather round for the reading.</p>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Start a game</button>
              <button class="btn btn-out">Join a room</button>
            </div>
          </div>`;
      },
      join(el, corpus) {
        const letters = corpus.roomCode.split('');
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="bill">join the room</p>
              <hr class="rule-g" />
              <div class="card">
                <span class="lab">Room code</span>
                <div class="slots">${letters.map((c) => `<div class="slot">${c}</div>`).join('')}</div>
                <span class="lab" style="margin-top:22px">Pen name</span>
                <input class="field" value="Wren" aria-label="Your pen name" />
              </div>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Join room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="bill">friends type this</p>
              <div class="code-h">${corpus.roomCode}</div>
              <p class="fine" style="margin-top:0">Four in the room. The reading starts when Maya says go.</p>
              <ul class="cast">
                ${corpus.players
                  .map(
                    (p) => `<li>
                      <span class="seat ${p.present ? 'here' : ''} ${p.kind === 'ai' ? 'ai' : ''}">${p.name[0]}</span>
                      <span class="cname">${p.name}</span>
                      <span class="crole ${p.host ? 'host' : ''}">${p.host ? 'host' : p.kind === 'ai' ? 'ghost writer' : p.present ? 'seated' : 'away'}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
              <button class="addbot">+ Seat a ghost writer</button>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Start the game</button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const dots = Array.from({ length: g.wordsThisRound })
          .map(() => `<span class="foot-dot"></span>`)
          .join('');
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="bill">round ${g.round} of ${g.totalRounds} &middot; ${g.wordsThisRound} words</p>
              <hr class="rule-g" />
              <div class="card">
                <p class="cue">your cue, the line before yours</p>
                <p class="given">${g.previousLine}</p>
                <div class="foots">${dots}</div>
                <input class="sayin" value="${g.draft}" aria-label="Your line" placeholder="say the next line" />
                <p class="cardnote"><span class="wnow">4</span> of ${g.wordsThisRound} words</p>
              </div>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Say your line</button>
            </div>
          </div>`;
        const input = el.querySelector('.sayin');
        const dotEls = el.querySelectorAll('.foot-dot');
        const wnow = el.querySelector('.wnow');
        const need = g.wordsThisRound;
        const sync = () => {
          const n = Math.min(words(input.value), need);
          dotEls.forEach((d, i) => d.classList.toggle('lit', i < n));
          wnow.textContent = String(n);
        };
        input.addEventListener('input', sync);
        sync();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn[0];
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <div class="interlude">
                <p class="il-k">house lights, low</p>
                <h2 class="il-h">You said your <em>line.</em></h2>
                <div class="glow"></div>
                <p class="il-s">${waiting} is still writing. Two poems are almost ready to read.</p>
              </div>
            </div>
            <div class="a3-foot">
              <p class="bill" style="text-align:center;color:var(--dim)">next up, the reading</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const first = corpus.revealQueue[0];
        const next = corpus.revealQueue[1];
        const p = corpus.poem;
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="now">now reading</p>
              <h2 class="reader">${first.reader}</h2>
              <p class="reads">reads ${p.title}</p>
              <div class="stage-poem spotlit">
                ${p.lines
                  .map(
                    (l) => `<div class="verse">
                      <div class="vt">${l.text}</div>
                      <div class="vby">${l.author}</div>
                    </div>`
                  )
                  .join('')}
              </div>
              <p class="upnext">Up next, <b>${next.reader}</b> reads ${next.poem}.</p>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Hand off to ${next.reader}</button>
            </div>
          </div>`;
      },
    },
  };
})();
