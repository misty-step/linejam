// Lane: anthro — three complete system propositions for Linejam's mobile loop.
// Each option obeys one coherent design system across all seven screens
// (home, join, lobby, write, wait, reveal, read).
// Grounded in the game's own world: the exquisite-corpse fold, the
// 1·2·3·4·5·4·3·2·1 word count, and the read-aloud finale.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  function words(s) {
    const t = (s || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }
  function host(corpus) {
    const h = corpus.players.find((p) => p.host);
    return h ? h.name : corpus.players[0].name;
  }

  /* =========================================================================
     ANTHRO-3 · "Aloud"
     The phone is a lit stage. Performance typography, bottom-anchored
     controls, a continuous read-aloud reveal with reader billing, and — new
     in round 2 — a full read-aloud ceremony as the payoff screen. Cream on
     claret, footlight gold. Cards are the paper you write on; the reading
     dims the house to the reader's spotlight.
     Round-2 move: preserve the praised system, add the ceremony screen, honor
     the alignment law (line text starts at one x; bylines never shift it).
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-3'] = {
    lane: 'anthro',
    title: 'Aloud',
    move: 'Preserve the lit-stage system and give it its true payoff: a full read-aloud ceremony screen, billed like a program and legible across the table.',
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

      /* reveal = the reading circle running order */
      .opt-ANTHRO-3 .circle-h{ font:400 30px/1.25 'Fraunces',serif; color:var(--cream); margin:12px 0 4px; max-width:18ch; }
      .opt-ANTHRO-3 .cast li.done{ opacity:.5; }
      .opt-ANTHRO-3 .cast li.onnow .cname{ color:var(--gold); }
      .opt-ANTHRO-3 .crole.nowtag{ color:var(--gold); font-style:normal; font-family:'Bricolage Grotesque',sans-serif;
        font-weight:700; font-size:11px; letter-spacing:.14em; text-transform:uppercase; }

      /* read = your whole poem, read aloud */
      .opt-ANTHRO-3 .prog{ height:5px; background:var(--line); border-radius:3px; margin:20px 0 7px; overflow:hidden; }
      .opt-ANTHRO-3 .prog-fill{ display:block; height:100%; background:var(--gold); transition:width .4s ease; }
      .opt-ANTHRO-3 .prog-n{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:var(--dim); }
      .opt-ANTHRO-3 .readpoem{ margin:22px 0 0; }
      .opt-ANTHRO-3 .readpoem .verse{ padding:12px 0; }
      .opt-ANTHRO-3 .readpoem .vt{ font:400 32px/1.3 'Fraunces',serif; color:var(--cream); }
      .opt-ANTHRO-3 .readpoem .vby{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:var(--gold); margin-top:7px; }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-3 .glow{ animation:none; }
        .opt-ANTHRO-3 .spotlit .verse{ animation:none; }
        .opt-ANTHRO-3 .prog-fill{ transition:none; }
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
              <p class="fine" style="margin-top:0">${corpus.players.length} names on the bill. The reading starts when ${host(corpus)} says go.</p>
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
                <p class="il-s">${waiting} is still writing. Five poems are almost ready to read.</p>
              </div>
            </div>
            <div class="a3-foot">
              <p class="bill" style="text-align:center;color:var(--dim)">next up, the reading</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'read', now: 'reading now', next: 'up next', waiting: 'to come' };
        const now = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="now">the reading circle</p>
              <h2 class="circle-h">Each poem gets read aloud, one reader at a time.</h2>
              <ul class="cast" style="margin-top:18px">
                ${corpus.revealQueue
                  .map(
                    (q) => `<li class="${q.status === 'now' ? 'onnow' : ''} ${q.status === 'read' ? 'done' : ''}">
                      <span class="seat ${q.status === 'now' ? 'here' : ''}">${q.reader[0]}</span>
                      <span class="cname">${q.reader}</span>
                      <span class="crole ${q.status === 'now' ? 'nowtag' : ''}">${q.poem} &middot; ${label[q.status]}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Read yours</button>
              <p class="bill" style="text-align:center;color:var(--dim);margin-top:12px">${now.reader}, ${now.poem} is yours to read</p>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        el.innerHTML = `
          <div class="a3">
            <div class="a3-body">
              <p class="now">now reading &middot; poem ${r.position} of ${r.total}</p>
              <h2 class="reader">${r.reader} reads</h2>
              <p class="reads">${p.title}, aloud to the room</p>
              <div class="prog"><span class="prog-fill" style="width:${(r.position / r.total) * 100}%"></span></div>
              <p class="prog-n">poem ${r.position} of ${r.total} in the circle</p>
              <div class="readpoem spotlit">
                ${p.lines
                  .map(
                    (l) => `<div class="verse">
                      <div class="vt">${l.text}</div>
                      <div class="vby">${l.author}</div>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="a3-foot">
              <button class="btn btn-gold">Done</button>
            </div>
          </div>`;
      },
    },
  };

  /* =========================================================================
     ANTHRO-4 · "The Fold"
     Mutation of the surviving system. The praised join/lobby/write/wait stay,
     and the word count still fills a rung gauge as you type. The diamond motif
     is gone: the new thesis is the blind fold itself — you only ever see the
     line before yours — expressed as a folded manuscript on home and as
     left-aligned verse (word count read as a growing underline that never
     shifts the text) on reveal and read.
     Ink-pine on bone, marigold as the "landed" mark.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-4'] = {
    lane: 'anthro',
    title: 'The Fold',
    move: 'Drop the diamond; make the blind fold the thesis — a folded manuscript hero and a rung gauge that fills word by word, with reveal/read as clean left-aligned verse.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500;600;700&display=swap');

      .opt-ANTHRO-4 {
        --bone:#efece3; --bone-2:#e5e1d5; --ink:#12312e; --fill:#e0a32e;
        --fill-soft:#f3e2be; --line:#cbc6b8; --muted:#5f6f68;
        background:var(--bone); color:var(--ink);
        font-family:'Space Grotesk',system-ui,sans-serif;
      }
      .opt-ANTHRO-4 .a4{ height:100%; display:flex; flex-direction:column; }
      .opt-ANTHRO-4 .a4-body{ flex:1; overflow-y:auto; padding:26px 24px 16px; }
      .opt-ANTHRO-4 .a4-foot{ flex:none; padding:14px 20px calc(18px + env(safe-area-inset-bottom));
        border-top:1px solid var(--line); background:var(--bone-2); }
      .opt-ANTHRO-4 .kick{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.2em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-4 .disp{ font:400 52px/.94 'Instrument Serif',serif; letter-spacing:.005em; margin:10px 0 0; }
      .opt-ANTHRO-4 .disp .it{ font-style:italic; }
      .opt-ANTHRO-4 .sub{ font:italic 400 22px/1.4 'Instrument Serif',serif; color:var(--muted); margin:12px 0 0; }

      .opt-ANTHRO-4 .btn{ display:block; width:100%; min-height:52px; border-radius:1px; cursor:pointer;
        font:600 15px/1 'Space Grotesk',sans-serif; letter-spacing:.06em; text-transform:uppercase; }
      .opt-ANTHRO-4 .btn-fill{ background:var(--ink); color:var(--bone); border:1px solid var(--ink); }
      .opt-ANTHRO-4 .btn-line{ background:transparent; color:var(--ink); border:1px solid var(--ink);
        margin-top:10px; min-height:48px; }
      .opt-ANTHRO-4 .btn:active{ transform:translateY(1px); }

      /* folded manuscript hero — the blind fold as the thesis */
      .opt-ANTHRO-4 .ms{ margin-top:30px; border:1.5px solid var(--line); border-radius:2px;
        background:var(--bone-2); overflow:hidden; }
      .opt-ANTHRO-4 .ms-fold{ display:flex; align-items:center; gap:12px; padding:13px 16px;
        border-bottom:1px solid var(--line);
        background:repeating-linear-gradient(180deg, var(--bone-2), var(--bone-2) 4px, #dcd6c7 4px, #dcd6c7 5px); }
      .opt-ANTHRO-4 .ms-fold .bar{ flex:1; height:8px; border-radius:2px; background:var(--line); }
      .opt-ANTHRO-4 .ms-fold .ft{ font:600 9px/1 'Space Grotesk',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); flex:none; }
      .opt-ANTHRO-4 .ms-seen{ padding:18px 16px; background:var(--bone); border-bottom:1px solid var(--line); }
      .opt-ANTHRO-4 .ms-seen .m{ font:600 10px/1 'Space Grotesk',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:#9a7a1e; }
      .opt-ANTHRO-4 .ms-seen .l{ font:400 27px/1.25 'Instrument Serif',serif; color:var(--ink); margin-top:8px; }
      .opt-ANTHRO-4 .ms-yours{ padding:16px; display:flex; align-items:center; gap:10px; }
      .opt-ANTHRO-4 .ms-yours .caret{ width:3px; height:26px; background:var(--fill); flex:none; }
      .opt-ANTHRO-4 .ms-yours .g{ font:italic 400 20px/1 'Instrument Serif',serif; color:var(--muted); }
      .opt-ANTHRO-4 .fold-cap{ font:italic 400 19px/1.5 'Instrument Serif',serif; color:var(--muted); margin:20px 0 0; max-width:24ch; }

      .opt-ANTHRO-4 .field-l{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); display:block; margin:0 0 9px; }
      .opt-ANTHRO-4 .codeslots{ display:flex; gap:10px; }
      .opt-ANTHRO-4 .cs{ flex:1; aspect-ratio:1; display:grid; place-items:center; border:1.5px solid var(--ink);
        background:transparent; font:400 40px/1 'Instrument Serif',serif; }
      .opt-ANTHRO-4 .field{ width:100%; padding:15px 12px; border:1.5px solid var(--ink); background:transparent;
        font:italic 400 22px/1 'Instrument Serif',serif; color:var(--ink); border-radius:1px; }

      .opt-ANTHRO-4 .code-mega{ font:400 74px/1 'Instrument Serif',serif; letter-spacing:.06em; margin:2px 0; }
      .opt-ANTHRO-4 .roster{ list-style:none; margin:22px 0 0; padding:0; }
      .opt-ANTHRO-4 .roster li{ display:flex; align-items:center; gap:12px; padding:12px 0; border-top:1px solid var(--line); }
      .opt-ANTHRO-4 .pin{ width:14px; height:14px; flex:none; border:1.5px solid var(--ink); border-radius:50%; }
      .opt-ANTHRO-4 .pin.on{ background:var(--fill); border-color:var(--fill); }
      .opt-ANTHRO-4 .pin.ai{ border-radius:2px; }
      .opt-ANTHRO-4 .rn{ font:400 24px/1 'Instrument Serif',serif; }
      .opt-ANTHRO-4 .rtag{ margin-left:auto; font:600 10px/1 'Space Grotesk',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-4 .rtag.h{ color:var(--ink); }
      .opt-ANTHRO-4 .addbot{ margin-top:16px; width:100%; min-height:48px; border:1.5px dashed var(--ink);
        background:transparent; color:var(--ink); cursor:pointer; border-radius:1px;
        font:600 12px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; text-transform:uppercase; }

      .opt-ANTHRO-4 .given-l{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.16em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-4 .given{ font:400 30px/1.35 'Instrument Serif',serif; margin:8px 0 0; }
      .opt-ANTHRO-4 .gauge-l{ display:flex; justify-content:space-between; align-items:baseline; margin:30px 0 10px; }
      .opt-ANTHRO-4 .gauge-l .n{ font:600 13px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; color:var(--muted); }
      .opt-ANTHRO-4 .gauge-l .n b{ color:var(--ink); font-size:16px; }
      /* rung gauge: chips grow with their word, wrap rather than clip */
      .opt-ANTHRO-4 .gauge{ display:flex; flex-wrap:wrap; gap:8px; }
      .opt-ANTHRO-4 .cell{ flex:0 0 auto; min-width:54px; height:52px; padding:0 12px; border:1.5px solid var(--ink);
        border-radius:1px; display:grid; place-items:center; background:transparent; transition:background .18s ease;
        font:italic 400 18px/1 'Instrument Serif',serif; color:var(--ink); white-space:nowrap; }
      .opt-ANTHRO-4 .cell.on{ background:var(--fill); }
      .opt-ANTHRO-4 .cell.next{ box-shadow:inset 0 0 0 2px var(--fill); }
      .opt-ANTHRO-4 .wordin{ width:100%; margin-top:22px; padding:12px 0; border:0; border-bottom:1.5px solid var(--ink);
        outline:0; background:transparent; font:italic 400 24px/1.3 'Instrument Serif',serif; color:var(--ink); }

      .opt-ANTHRO-4 .waitwrap{ text-align:center; padding-top:40px; }
      .opt-ANTHRO-4 .wait-h{ font:400 34px/1.15 'Instrument Serif',serif; margin:22px 0 0; }
      .opt-ANTHRO-4 .wait-h .it{ font-style:italic; }
      .opt-ANTHRO-4 .wait-s{ font:italic 400 19px/1.5 'Instrument Serif',serif; color:var(--muted); margin:16px auto 0; max-width:24ch; }
      .opt-ANTHRO-4 .rowgauge{ display:flex; gap:10px; justify-content:center; margin-top:8px; flex-wrap:wrap; }
      .opt-ANTHRO-4 .rc{ min-width:44px; height:44px; padding:0 12px; border:1.5px solid var(--ink); border-radius:1px; display:grid; place-items:center;
        font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.04em; }
      .opt-ANTHRO-4 .rc.done{ background:var(--fill); }
      .opt-ANTHRO-4 .rc.wait{ animation:a4pulse 1.6s ease-in-out infinite; }
      @keyframes a4pulse{ 0%,100%{background:transparent} 50%{background:var(--fill-soft)} }

      /* reveal + read: left-aligned verse, word count as a growing underline */
      .opt-ANTHRO-4 .queue{ list-style:none; margin:14px 0 20px; padding:0; }
      .opt-ANTHRO-4 .queue li{ display:flex; gap:12px; align-items:baseline; padding:9px 0; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-4 .qn{ font:600 12px/1 'Space Grotesk',sans-serif; letter-spacing:.1em; color:var(--muted); flex:none; }
      .opt-ANTHRO-4 .qt{ font:400 18px/1.3 'Instrument Serif',serif; }
      .opt-ANTHRO-4 .qt b{ font-weight:400; font-style:italic; }
      .opt-ANTHRO-4 .queue li.read{ opacity:.5; }
      .opt-ANTHRO-4 .qstat{ margin-left:auto; flex:none; font:600 10px/1 'Space Grotesk',sans-serif;
        letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-4 .queue li.now .qstat{ color:#9a7a1e; }
      .opt-ANTHRO-4 .queue li.now .qt b{ color:var(--ink); }
      .opt-ANTHRO-4 .poemtitle{ font:italic 400 26px/1 'Instrument Serif',serif; margin:6px 0 16px; color:var(--muted); }
      .opt-ANTHRO-4 .vstack{ margin-top:4px; }
      .opt-ANTHRO-4 .v4{ padding:13px 0; }
      .opt-ANTHRO-4 .v4-row{ display:flex; align-items:baseline; gap:14px; }
      .opt-ANTHRO-4 .v4-t{ font:400 25px/1.25 'Instrument Serif',serif; color:var(--ink); }
      .opt-ANTHRO-4 .v4-by{ margin-left:auto; flex:none; font:600 10px/1 'Space Grotesk',sans-serif;
        letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-4 .v4-u{ height:6px; background:var(--fill); border-radius:2px; margin-top:9px; }
      .opt-ANTHRO-4 .assemble .v4{ animation:a4grow .5s ease both; }
      @keyframes a4grow{ from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }

      .opt-ANTHRO-4 .read-head{ margin-bottom:6px; }
      .opt-ANTHRO-4 .read-reader{ font:400 46px/1 'Instrument Serif',serif; margin:6px 0 2px; }
      .opt-ANTHRO-4 .read-reader .it{ font-style:italic; }
      .opt-ANTHRO-4 .prog4{ height:5px; background:var(--line); border-radius:3px; margin:18px 0 7px; overflow:hidden; }
      .opt-ANTHRO-4 .prog4 span{ display:block; height:100%; background:var(--fill); transition:width .4s ease; }
      .opt-ANTHRO-4 .prog4-n{ font:600 11px/1 'Space Grotesk',sans-serif; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-4 .rc.wait{ animation:none; background:var(--fill-soft); }
        .opt-ANTHRO-4 .assemble .v4{ animation:none; }
        .opt-ANTHRO-4 .cell{ transition:none; }
        .opt-ANTHRO-4 .prog4 span, .opt-ANTHRO-4 .v4-u{ transition:none; }
      }
    `,
    screens: {
      home(el, corpus) {
        const prev = corpus.game.previousLine;
        el.innerHTML = `
          <div class="a4">
            <div class="a4-body">
              <p class="kick">a blind poem, nine lines</p>
              <h1 class="disp">Line<span class="it">jam</span></h1>
              <div class="ms">
                <div class="ms-fold"><span class="ft">folded</span><span class="bar"></span></div>
                <div class="ms-fold"><span class="ft">folded</span><span class="bar" style="opacity:.7"></span></div>
                <div class="ms-fold"><span class="ft">folded</span><span class="bar" style="opacity:.5"></span></div>
                <div class="ms-seen">
                  <p class="m">the one line you see</p>
                  <p class="l">${prev}</p>
                </div>
                <div class="ms-yours"><span class="caret"></span><span class="g">your line goes here</span></div>
              </div>
              <p class="fold-cap">You only ever see the line before yours. The rest stays folded until the reading.</p>
            </div>
            <div class="a4-foot">
              <button class="btn btn-fill">Start a game</button>
              <button class="btn btn-line">Join a room</button>
            </div>
          </div>`;
      },
      join(el, corpus) {
        const letters = corpus.roomCode.split('');
        el.innerHTML = `
          <div class="a4">
            <div class="a4-body">
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
            <div class="a4-foot">
              <button class="btn btn-fill">Join room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        el.innerHTML = `
          <div class="a4">
            <div class="a4-body">
              <p class="kick">friends type this</p>
              <div class="code-mega">${corpus.roomCode}</div>
              <p class="sub" style="font-size:18px;margin-top:4px">Nine lines, five pens. Waiting to begin.</p>
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
            <div class="a4-foot">
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
          <div class="a4">
            <div class="a4-body">
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
            <div class="a4-foot">
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
          <div class="a4">
            <div class="a4-body">
              <div class="waitwrap">
                <div class="rowgauge">
                  <div class="rc done">you</div>
                  <div class="rc wait">${waiting}</div>
                </div>
                <h2 class="wait-h">Your word is <span class="it">in.</span></h2>
                <p class="wait-s">${waiting} is finishing this line. Five poems fill in as everyone lands.</p>
              </div>
            </div>
            <div class="a4-foot">
              <p class="kick" style="text-align:center">5 poems taking shape</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'read', now: 'reading now', next: 'up next', waiting: 'to come' };
        const now = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="a4">
            <div class="a4-body">
              <p class="kick">the reading circle</p>
              <h2 class="disp" style="font-size:34px;margin-top:8px">Read <span class="it">aloud,</span><br/>in turn.</h2>
              <p class="sub" style="font-size:18px;margin-top:10px">Each of you holds one poem. Go round the table.</p>
              <ul class="queue" style="margin-top:22px">
                ${corpus.revealQueue
                  .map(
                    (q, i) => `<li class="${q.status}"><span class="qn">${String(i + 1).padStart(2, '0')}</span>
                      <span class="qt"><b>${q.reader}</b> &middot; ${q.poem}</span>
                      <span class="qstat">${label[q.status]}</span></li>`
                  )
                  .join('')}
              </ul>
            </div>
            <div class="a4-foot">
              <button class="btn btn-fill">Read your poem</button>
              <p class="kick" style="text-align:center;margin-top:12px">${now.poem} is yours, ${now.reader}</p>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        const max = Math.max(...p.lines.map((l) => words(l.text)));
        const lines = p.lines
          .map((l) => {
            const w = words(l.text);
            return `<div class="v4">
              <div class="v4-row">
                <span class="v4-t">${l.text}</span>
                <span class="v4-by">${l.author}</span>
              </div>
              <div class="v4-u" style="width:${(w / max) * 100}%"></div>
            </div>`;
          })
          .join('');
        el.innerHTML = `
          <div class="a4">
            <div class="a4-body">
              <div class="read-head">
                <p class="kick">now reading &middot; poem ${r.position} of ${r.total}</p>
                <h2 class="read-reader">${r.reader} <span class="it">reads</span></h2>
                <p class="given-l">${p.title}, aloud to the room</p>
              </div>
              <div class="prog4"><span style="width:${(r.position / r.total) * 100}%"></span></div>
              <p class="prog4-n">poem ${r.position} of ${r.total} in the circle</p>
              <div class="vstack assemble">${lines}</div>
            </div>
            <div class="a4-foot">
              <button class="btn btn-fill">Done</button>
            </div>
          </div>`;
      },
    },
  };

  /* =========================================================================
     ANTHRO-5 · "Overprint"
     A two-ink risograph poetry press. The exquisite corpse is literally
     overprinting: each writer runs another pass over lines they can't fully
     see. Warm newsprint, riso blue and riso red, a plum where the two inks
     overlap. Registration crosshairs, a halftone dot field, and poster
     numerals carry a party-game energy that is warm but distinct from the
     stage. Poem text is set clean for reading; the ink personality lives in
     the chrome.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-5'] = {
    lane: 'anthro',
    title: 'Overprint',
    move: 'Frame the game as a two-ink risograph press: misregistered duotone poster type and registration marks, with each line a pass of the press and the reading its final proof.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=Spectral:ital,wght@0,400;0,500;1,400&family=Space+Mono:wght@400;700&display=swap');

      .opt-ANTHRO-5 {
        --paper:#f2ebda; --paper-2:#eae0c9; --ink:#1b1a17; --blue:#2242c7;
        --red:#e8452c; --plum:#3a2a6b; --muted:#6b6459; --line:#d6cbaf;
        background:var(--paper); color:var(--ink);
        font-family:'Spectral',Georgia,serif;
      }
      .opt-ANTHRO-5 .a5{ height:100%; display:flex; flex-direction:column; position:relative;
        background:var(--paper);
        background-image:radial-gradient(var(--line) 1.1px, transparent 1.2px);
        background-size:13px 13px; }
      .opt-ANTHRO-5 .a5-body{ flex:1; overflow-y:auto; padding:24px 22px 16px; position:relative; }
      .opt-ANTHRO-5 .a5-foot{ flex:none; padding:15px 20px calc(18px + env(safe-area-inset-bottom));
        border-top:2px solid var(--ink); background:var(--paper-2); }
      .opt-ANTHRO-5 .reg{ font:700 15px/1 'Space Mono',monospace; color:var(--red); }
      .opt-ANTHRO-5 .regrow{ display:flex; justify-content:space-between; }
      .opt-ANTHRO-5 .regrow .b{ color:var(--blue); }
      .opt-ANTHRO-5 .mono{ font:700 11px/1 'Space Mono',monospace; letter-spacing:.16em;
        text-transform:uppercase; color:var(--blue); }
      .opt-ANTHRO-5 .mono.red{ color:var(--red); }
      .opt-ANTHRO-5 .mono.mut{ color:var(--muted); }

      .opt-ANTHRO-5 .poster{ font:400 74px/.86 'Anton',sans-serif; letter-spacing:.01em; text-transform:uppercase;
        color:var(--blue); text-shadow:3px 3px 0 var(--red); margin:16px 0 0; }
      .opt-ANTHRO-5 .lede{ font:italic 400 23px/1.4 'Spectral',serif; color:var(--ink); margin:22px 0 0; max-width:22ch; }
      .opt-ANTHRO-5 .fine{ font:400 15px/1.5 'Spectral',serif; color:var(--muted); margin:12px 0 0; }
      .opt-ANTHRO-5 .halfstrip{ height:14px; margin:22px 0 0;
        background:radial-gradient(var(--red) 2px, transparent 2.4px); background-size:12px 12px; opacity:.55; }

      .opt-ANTHRO-5 .btn{ display:block; width:100%; min-height:54px; border-radius:0; cursor:pointer;
        font:700 13px/1 'Space Mono',monospace; letter-spacing:.12em; text-transform:uppercase; }
      .opt-ANTHRO-5 .btn-red{ background:var(--red); color:var(--paper); border:2px solid var(--red); }
      .opt-ANTHRO-5 .btn-blue{ background:transparent; color:var(--blue); border:2px solid var(--blue);
        margin-top:10px; min-height:50px; }
      .opt-ANTHRO-5 .btn:active{ transform:translate(1px,1px); }

      .opt-ANTHRO-5 .plate-l{ display:block; margin:0 0 10px; }
      .opt-ANTHRO-5 .plates{ display:flex; gap:9px; }
      .opt-ANTHRO-5 .plate{ flex:1; aspect-ratio:4/5; display:grid; place-items:center; border:2px solid var(--ink);
        background:var(--paper); font:400 36px/1 'Anton',sans-serif; color:var(--blue); box-shadow:2px 2px 0 var(--red); }
      .opt-ANTHRO-5 .field{ width:100%; padding:14px 12px; border:2px solid var(--ink); background:var(--paper);
        font:italic 400 21px/1 'Spectral',serif; color:var(--ink); border-radius:0; }

      .opt-ANTHRO-5 .runno{ font:400 70px/1 'Anton',sans-serif; text-transform:uppercase; letter-spacing:.03em;
        color:var(--blue); text-shadow:3px 3px 0 var(--red); margin:4px 0; }
      .opt-ANTHRO-5 .crew{ list-style:none; margin:20px 0 0; padding:0; }
      .opt-ANTHRO-5 .crew li{ display:flex; align-items:center; gap:13px; padding:12px 0; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-5 .chip{ width:15px; height:15px; flex:none; border:2px solid var(--ink); background:var(--paper); }
      .opt-ANTHRO-5 .chip.on{ background:var(--blue); border-color:var(--blue); }
      .opt-ANTHRO-5 .chip.ai{ background:var(--red); border-color:var(--red); border-radius:50%; }
      .opt-ANTHRO-5 .cn{ font:500 22px/1 'Spectral',serif; }
      .opt-ANTHRO-5 .ctag{ margin-left:auto; font:700 10px/1 'Space Mono',monospace; letter-spacing:.12em;
        text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-5 .ctag.h{ color:var(--red); }
      .opt-ANTHRO-5 .addbot{ margin-top:16px; width:100%; min-height:48px; border:2px dashed var(--blue);
        background:transparent; color:var(--blue); cursor:pointer; border-radius:0;
        font:700 12px/1 'Space Mono',monospace; letter-spacing:.1em; text-transform:uppercase; }

      .opt-ANTHRO-5 .last{ border:2px solid var(--ink); background:var(--paper); padding:16px; margin-top:12px;
        box-shadow:3px 3px 0 var(--blue); }
      .opt-ANTHRO-5 .last .l{ font:400 27px/1.28 'Spectral',serif; color:var(--ink); margin-top:8px; }
      .opt-ANTHRO-5 .ticks{ display:flex; gap:8px; margin:24px 0 4px; }
      .opt-ANTHRO-5 .tick{ flex:1; height:34px; border:2px solid var(--ink); background:var(--paper);
        display:grid; place-items:center; font:700 12px/1 'Space Mono',monospace; color:var(--muted); }
      .opt-ANTHRO-5 .tick.inked{ background:var(--blue); border-color:var(--blue); color:var(--paper); }
      .opt-ANTHRO-5 .tick.next{ box-shadow:inset 0 0 0 2px var(--red); }
      .opt-ANTHRO-5 .pressin{ width:100%; margin-top:20px; padding:12px 0; border:0; border-bottom:2px solid var(--ink);
        outline:0; background:transparent; font:italic 400 25px/1.3 'Spectral',serif; color:var(--ink); }
      .opt-ANTHRO-5 .cnt{ font:700 11px/1 'Space Mono',monospace; letter-spacing:.12em; text-transform:uppercase;
        color:var(--muted); margin-top:14px; }
      .opt-ANTHRO-5 .cnt b{ color:var(--red); }

      .opt-ANTHRO-5 .press{ text-align:center; padding-top:40px; }
      .opt-ANTHRO-5 .roller{ width:200px; height:20px; margin:26px auto 0; border:2px solid var(--ink);
        background:repeating-linear-gradient(90deg, var(--blue) 0 16px, var(--red) 16px 32px);
        background-size:64px 100%; animation:a5roll 1.4s linear infinite; }
      @keyframes a5roll{ from{background-position:0 0} to{background-position:64px 0} }
      .opt-ANTHRO-5 .press-h{ font:400 40px/1 'Anton',sans-serif; text-transform:uppercase; letter-spacing:.02em;
        color:var(--blue); text-shadow:2px 2px 0 var(--red); margin:24px 0 0; }
      .opt-ANTHRO-5 .press-s{ font:italic 400 18px/1.5 'Spectral',serif; color:var(--muted); margin:14px auto 0; max-width:24ch; }

      /* reveal + read: clean left-aligned verse, count as a red tick row below */
      .opt-ANTHRO-5 .order{ list-style:none; margin:14px 0 20px; padding:0; }
      .opt-ANTHRO-5 .order li{ display:flex; gap:12px; align-items:baseline; padding:9px 0; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-5 .on{ font:700 12px/1 'Space Mono',monospace; color:var(--red); flex:none; }
      .opt-ANTHRO-5 .ot{ font:400 18px/1.3 'Spectral',serif; }
      .opt-ANTHRO-5 .ot b{ font-weight:500; }
      .opt-ANTHRO-5 .order li.read{ opacity:.45; }
      .opt-ANTHRO-5 .ostat{ margin-left:auto; flex:none; font:700 10px/1 'Space Mono',monospace;
        letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
      .opt-ANTHRO-5 .order li.now .ostat{ color:var(--red); }
      .opt-ANTHRO-5 .proof-t{ font:400 40px/1 'Anton',sans-serif; text-transform:uppercase; letter-spacing:.02em;
        color:var(--ink); margin:8px 0 16px; }
      .opt-ANTHRO-5 .vs{ margin-top:4px; }
      .opt-ANTHRO-5 .v5{ padding:13px 0; }
      .opt-ANTHRO-5 .v5-row{ display:flex; align-items:baseline; gap:14px; }
      .opt-ANTHRO-5 .v5-t{ font:400 26px/1.25 'Spectral',serif; color:var(--ink); }
      .opt-ANTHRO-5 .v5-by{ margin-left:auto; flex:none; font:700 10px/1 'Space Mono',monospace;
        letter-spacing:.1em; text-transform:uppercase; color:var(--blue); }
      .opt-ANTHRO-5 .v5-ct{ display:flex; gap:5px; margin-top:9px; }
      .opt-ANTHRO-5 .v5-ct i{ width:16px; height:5px; background:var(--red); border-radius:1px; }
      .opt-ANTHRO-5 .proof .v5{ animation:a5up .5s ease both; }
      @keyframes a5up{ from{opacity:0; transform:translateY(9px)} to{opacity:1; transform:none} }

      .opt-ANTHRO-5 .read-reader{ font:400 52px/.92 'Anton',sans-serif; text-transform:uppercase; letter-spacing:.02em;
        color:var(--blue); text-shadow:3px 3px 0 var(--red); margin:8px 0 2px; }
      .opt-ANTHRO-5 .prog5{ height:6px; background:var(--line); border:0; margin:18px 0 7px; overflow:hidden; }
      .opt-ANTHRO-5 .prog5 span{ display:block; height:100%; background:var(--red); transition:width .4s ease; }
      .opt-ANTHRO-5 .prog5-n{ font:700 11px/1 'Space Mono',monospace; letter-spacing:.12em;
        text-transform:uppercase; color:var(--muted); }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-5 .roller{ animation:none; }
        .opt-ANTHRO-5 .proof .v5{ animation:none; }
        .opt-ANTHRO-5 .prog5 span{ transition:none; }
      }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <div class="regrow"><span class="reg">+</span><span class="reg b">+</span></div>
              <p class="mono red" style="margin-top:18px">poetry press &middot; two inks</p>
              <h1 class="poster">Line<br/>jam</h1>
              <p class="lede">Write a poem blind. Print it out loud.</p>
              <p class="fine">Every player runs one pass of the press over a line they can barely see.</p>
              <div class="halfstrip"></div>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Start a run</button>
              <button class="btn btn-blue">Join a room</button>
            </div>
          </div>`;
      },
      join(el, corpus) {
        const letters = corpus.roomCode.split('');
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <div class="regrow"><span class="reg">+</span><span class="reg b">+</span></div>
              <p class="mono" style="margin-top:18px">join a room</p>
              <h2 class="poster" style="font-size:52px;line-height:.9">Load<br/>the plate</h2>
              <div style="margin-top:26px">
                <span class="mono mut plate-l">Room code</span>
                <div class="plates">${letters.map((c) => `<div class="plate">${c}</div>`).join('')}</div>
              </div>
              <div style="margin-top:22px">
                <span class="mono mut plate-l">Pen name</span>
                <input class="field" value="Wren" aria-label="Your pen name" />
              </div>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Join room</button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <p class="mono mut">friends type this</p>
              <div class="runno">${corpus.roomCode}</div>
              <p class="fine" style="margin-top:0">${corpus.players.length} on the crew. ${host(corpus)} runs the press.</p>
              <ul class="crew">
                ${corpus.players
                  .map(
                    (p) => `<li>
                      <span class="chip ${p.present ? 'on' : ''} ${p.kind === 'ai' ? 'ai' : ''}"></span>
                      <span class="cn">${p.name}</span>
                      <span class="ctag ${p.host ? 'h' : ''}">${p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? 'inked' : 'away'}</span>
                    </li>`
                  )
                  .join('')}
              </ul>
              <button class="addbot">+ Add a ghost writer</button>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Start the run</button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const ticks = Array.from({ length: g.wordsThisRound })
          .map((_, i) => `<div class="tick">${i + 1}</div>`)
          .join('');
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <p class="mono">round ${g.round} of ${g.totalRounds} &middot; ${g.wordsThisRound} words</p>
              <div class="last">
                <span class="mono mut">the last impression</span>
                <p class="l">${g.previousLine}</p>
              </div>
              <div class="ticks">${ticks}</div>
              <input class="pressin" value="${g.draft}" aria-label="Your line" placeholder="run your line" />
              <p class="cnt"><b class="wnow">4</b> of ${g.wordsThisRound} words inked</p>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Run your line</button>
            </div>
          </div>`;
        const input = el.querySelector('.pressin');
        const tickEls = el.querySelectorAll('.tick');
        const wnow = el.querySelector('.wnow');
        const need = g.wordsThisRound;
        const sync = () => {
          const n = Math.min(words(input.value), need);
          tickEls.forEach((t, i) => {
            t.classList.toggle('inked', i < n);
            t.classList.toggle('next', i === n && n < need);
          });
          wnow.textContent = String(n);
        };
        input.addEventListener('input', sync);
        sync();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn[0];
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <div class="press">
                <p class="mono red">on the press</p>
                <div class="roller"></div>
                <h2 class="press-h">Line<br/>pulled</h2>
                <p class="press-s">${waiting} is running the next pass. Five poems are drying on the line.</p>
              </div>
            </div>
            <div class="a5-foot">
              <p class="mono mut" style="text-align:center">5 poems &middot; proof soon</p>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'pulled', now: 'on press', next: 'up next', waiting: 'to come' };
        const now = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <p class="mono red">the reading circle &middot; read in order</p>
              <h2 class="proof-t" style="margin-top:10px">Proof it aloud</h2>
              <p class="fine" style="margin-top:0">Each printer reads their own poem. Round the room.</p>
              <ul class="order" style="margin-top:18px">
                ${corpus.revealQueue
                  .map(
                    (q, i) => `<li class="${q.status}"><span class="on">${String(i + 1).padStart(2, '0')}</span>
                      <span class="ot"><b>${q.reader}</b> &middot; ${q.poem}</span>
                      <span class="ostat">${label[q.status]}</span></li>`
                  )
                  .join('')}
              </ul>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Read your poem</button>
              <p class="mono mut" style="text-align:center;margin-top:12px">${now.poem} is yours, ${now.reader}</p>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        const lines = p.lines
          .map((l) => {
            const w = words(l.text);
            const bars = Array.from({ length: w }).map(() => `<i></i>`).join('');
            return `<div class="v5">
              <div class="v5-row">
                <span class="v5-t">${l.text}</span>
                <span class="v5-by">${l.author}</span>
              </div>
              <div class="v5-ct">${bars}</div>
            </div>`;
          })
          .join('');
        el.innerHTML = `
          <div class="a5">
            <div class="a5-body">
              <p class="mono red">now reading &middot; poem ${r.position} of ${r.total}</p>
              <h2 class="read-reader">${r.reader}</h2>
              <p class="mono mut">reads ${p.title} aloud to the room</p>
              <div class="prog5"><span style="width:${(r.position / r.total) * 100}%"></span></div>
              <p class="prog5-n">poem ${r.position} of ${r.total} in the circle</p>
              <div class="vs proof">${lines}</div>
            </div>
            <div class="a5-foot">
              <button class="btn btn-red">Done</button>
            </div>
          </div>`;
      },
    },
  };

  /* =========================================================================
     ANTHRO-6 · "Specimen" — the theme selector as a first-class page.
     Linejam will ship many themes; picking one is its own moment. The idiom is
     a letterpress type-specimen book: quiet warm chrome so every theme's own
     paper/ink/accent reads true, and each entry is a printed specimen — one
     real line of the poem set in that theme's colors. You pick by reading, not
     by guessing a name. Scales to 14+ specimens on a phone by simple scroll;
     the active theme stays named in the sticky header.
     ========================================================================= */
  window.LANE_SPECS['ANTHRO-6'] = {
    lane: 'anthro',
    section: 'SELECTOR',
    title: 'Specimen',
    move: 'Make the theme picker a type-specimen book: neutral chrome, and every theme previewed as a real poem line set in its own paper, ink, and accent so you choose by feel.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&display=swap');

      .opt-ANTHRO-6 {
        --chrome:#f4f2ec; --chrome-2:#eae7de; --ink:#221f1a; --dim:#615c53;
        --line:#d8d3c7; --seal:#1f1c17; --ship:#3c6b45;
        background:var(--chrome); color:var(--ink);
        font-family:'Bricolage Grotesque',system-ui,sans-serif;
      }
      .opt-ANTHRO-6 .a6{ height:100%; display:flex; flex-direction:column; background:var(--chrome); }
      .opt-ANTHRO-6 .a6-head{ flex:none; padding:24px 22px 15px; border-bottom:1px solid var(--line); }
      .opt-ANTHRO-6 .a6-eyebrow{ font:700 11px/1 'Bricolage Grotesque',sans-serif; letter-spacing:.2em;
        text-transform:uppercase; color:var(--dim); }
      .opt-ANTHRO-6 .a6-title{ font:400 34px/1 'Fraunces',serif; margin:11px 0 0; }
      .opt-ANTHRO-6 .a6-now{ font:italic 400 16px/1.4 'Fraunces',serif; color:var(--dim); margin:9px 0 0; }
      .opt-ANTHRO-6 .a6-now b{ font-style:normal; font-family:'Bricolage Grotesque',sans-serif;
        font-weight:600; font-size:13px; letter-spacing:.01em; color:var(--ink); }
      .opt-ANTHRO-6 .a6-body{ flex:1; overflow-y:auto; padding:16px 22px calc(22px + env(safe-area-inset-bottom));
        display:flex; flex-direction:column; gap:14px; }

      .opt-ANTHRO-6 .spec{ display:block; flex:none; width:100%; text-align:left; border:1.5px solid var(--line);
        border-radius:9px; background:var(--chrome-2); padding:0; overflow:hidden; cursor:pointer; }
      .opt-ANTHRO-6 .spec:active{ transform:translateY(1px); }
      .opt-ANTHRO-6 .spec:focus-visible{ outline:2px solid var(--seal); outline-offset:2px; }
      .opt-ANTHRO-6 .spec.on{ border-color:var(--seal); box-shadow:0 0 0 2px var(--seal); }

      .opt-ANTHRO-6 .stage{ position:relative; padding:20px 18px; min-height:90px; }
      .opt-ANTHRO-6 .stage .verse{ display:block; font:italic 400 22px/1.28 'Fraunces',serif; max-width:19ch; }
      .opt-ANTHRO-6 .stage .byl{ display:block; font:700 10px/1 'Bricolage Grotesque',sans-serif;
        letter-spacing:.14em; text-transform:uppercase; margin-top:12px; }
      .opt-ANTHRO-6 .stage .seal{ position:absolute; top:18px; right:18px; width:16px; height:16px; border-radius:50%; }

      .opt-ANTHRO-6 .meta{ display:flex; align-items:center; gap:12px; padding:12px 14px 12px 18px;
        border-top:1.5px solid var(--line); background:var(--chrome); }
      .opt-ANTHRO-6 .mtext{ display:flex; flex-direction:column; gap:3px; min-width:0; }
      .opt-ANTHRO-6 .tname{ font:600 17px/1 'Bricolage Grotesque',sans-serif; }
      .opt-ANTHRO-6 .tvibe{ font:400 13px/1.3 'Bricolage Grotesque',sans-serif; color:var(--dim);
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .opt-ANTHRO-6 .tag{ margin-left:auto; flex:none; font:700 9px/1 'Bricolage Grotesque',sans-serif;
        letter-spacing:.12em; text-transform:uppercase; padding:5px 8px; border-radius:3px; }
      .opt-ANTHRO-6 .tag.ship{ color:var(--ship); background:rgba(60,107,69,.13); }
      .opt-ANTHRO-6 .tag.lab{ color:var(--dim); background:rgba(0,0,0,.06); }
      .opt-ANTHRO-6 .pick{ flex:none; width:44px; height:44px; border-radius:50%; border:1.5px solid var(--line);
        display:grid; place-items:center; }
      .opt-ANTHRO-6 .pick .tick{ font:700 20px/1 'Bricolage Grotesque',sans-serif; color:var(--chrome); opacity:0; }
      .opt-ANTHRO-6 .spec.on .pick{ background:var(--seal); border-color:var(--seal); }
      .opt-ANTHRO-6 .spec.on .pick .tick{ opacity:1; }

      @media (prefers-reduced-motion: reduce){
        .opt-ANTHRO-6 .spec:active{ transform:none; }
      }
    `,
    screens: {
      selector(el, corpus) {
        const active = 'kenya';
        const line = 'moonlight over quiet stones';
        const activeName = (corpus.themes.find((t) => t.id === active) || {}).name || 'Kenya';
        const cards = corpus.themes
          .map((t) => {
            const on = t.id === active;
            return `<button class="spec ${on ? 'on' : ''}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${t.name} theme${on ? ', active' : ''}">
              <div class="stage" style="background:${t.paper};color:${t.ink}">
                <span class="verse" style="color:${t.ink}">${line}</span>
                <span class="byl" style="color:${t.accent}">a line in ${t.name}</span>
                <span class="seal" style="background:${t.accent}"></span>
              </div>
              <div class="meta">
                <span class="mtext">
                  <span class="tname">${t.name}</span>
                  <span class="tvibe">${t.vibe}</span>
                </span>
                <span class="tag ${t.shipped ? 'ship' : 'lab'}">${t.shipped ? 'shipped' : 'lab'}</span>
                <span class="pick"><span class="tick">&#10003;</span></span>
              </div>
            </button>`;
          })
          .join('');
        el.innerHTML = `
          <div class="a6">
            <div class="a6-head">
              <p class="a6-eyebrow">Linejam &middot; themes</p>
              <h1 class="a6-title">Pick a look</h1>
              <p class="a6-now">${corpus.themes.length} themes. <b>${activeName}</b> is on now.</p>
            </div>
            <div class="a6-body">${cards}</div>
          </div>`;
        const specs = el.querySelectorAll('.spec');
        specs.forEach((s) => {
          s.addEventListener('click', () => {
            specs.forEach((o) => {
              o.classList.remove('on');
              o.setAttribute('aria-pressed', 'false');
            });
            s.classList.add('on');
            s.setAttribute('aria-pressed', 'true');
          });
        });
      },
    },
  };
})();
