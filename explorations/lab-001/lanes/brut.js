// Lane: brut — Industrial Brutalism (Swiss print × tactical terminal).
// Three committed systems: BRUT-1 letterpress broadside (light Swiss print),
// BRUT-2 tactical HUD console (dark telemetry), BRUT-4 split-flap departures
// board (Solari mechanical). Each option commits to ONE substrate per the
// skill; no mixing within an option. Every option carries all seven screens.
// Reveal + read obey the alignment law: line text starts at one fixed
// horizontal position (a fixed-width numeral gutter); numbers/authors never
// shift where the line begins. Word slots grow with their word — never clip.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // ============================================================= BRUT-1
  // BROADSIDE — Swiss Industrial Print. Every screen is a printed plate:
  // masthead, oversized folio, hazard-red rule, set body, platen CTA.
  window.LANE_SPECS['BRUT-1'] = {
    lane: 'brut',
    title: 'Broadside',
    move: 'Every screen is a printed plate; the read-aloud ceremony is a reading plate with a fixed numeral gutter, an on-air line, and a nine-tick press progress bar.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:ital@0;1&display=swap');
      .opt-BRUT-1 { background:#F4F4F0; color:#0A0A0A; font-family:'IBM Plex Mono',monospace; }
      .opt-BRUT-1 *{ box-sizing:border-box; border-radius:0 !important; }
      .opt-BRUT-1 .b1{ height:100%; display:flex; flex-direction:column; position:relative; }
      .opt-BRUT-1 .b1-grain{ position:absolute; inset:0; pointer-events:none; opacity:.045; mix-blend-mode:multiply;
        background-image:radial-gradient(#0A0A0A 0.5px, transparent 0.5px); background-size:3px 3px; }
      .opt-BRUT-1 .b1-mast{ display:flex; justify-content:space-between; align-items:baseline;
        padding:12px 16px 8px; border-bottom:2px solid #0A0A0A; font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
      .opt-BRUT-1 .b1-mast b{ font-family:'Archivo Black'; font-size:13px; letter-spacing:-.02em; }
      .opt-BRUT-1 .b1-mast span{ color:#0A0A0A; }
      .opt-BRUT-1 .b1-body{ flex:1; overflow-y:auto; padding:16px; }
      .opt-BRUT-1 .b1-folio{ font-family:'Archivo Black'; text-transform:uppercase; line-height:.86;
        letter-spacing:-.04em; margin:0; }
      .opt-BRUT-1 .b1-rule{ height:0; border-top:6px solid #E61919; margin:14px 0; }
      .opt-BRUT-1 .b1-hair{ height:0; border-top:1px solid #0A0A0A; margin:12px 0; }
      .opt-BRUT-1 .b1-kick{ font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#0A0A0A; }
      .opt-BRUT-1 .b1-platen{ padding:12px 16px 16px; border-top:2px solid #0A0A0A; background:#EAE8E3; display:grid; gap:8px; }
      .opt-BRUT-1 .b1-btn{ display:flex; align-items:center; justify-content:space-between;
        min-height:56px; padding:0 18px; border:2px solid #0A0A0A; background:#0A0A0A; color:#F4F4F0;
        font-family:'Archivo Black'; font-size:16px; text-transform:uppercase; letter-spacing:-.01em; cursor:pointer; width:100%; }
      .opt-BRUT-1 .b1-btn.alt{ background:#F4F4F0; color:#0A0A0A; }
      .opt-BRUT-1 .b1-btn .arw{ font-family:'IBM Plex Mono'; font-size:14px; }
      .opt-BRUT-1 .b1-btn.red{ background:#E61919; border-color:#E61919; color:#F4F4F0; }
      .opt-BRUT-1 .b1-field{ border:2px solid #0A0A0A; padding:10px 12px; margin-bottom:12px; }
      .opt-BRUT-1 .b1-field label{ display:block; font-size:9px; letter-spacing:.16em; text-transform:uppercase; margin-bottom:6px; }
      .opt-BRUT-1 .b1-field input{ width:100%; border:0; background:transparent; color:#0A0A0A;
        font-family:'Archivo Black'; font-size:22px; letter-spacing:.1em; text-transform:uppercase; outline:none; }
      .opt-BRUT-1 .b1-slots{ display:flex; flex-wrap:wrap; gap:8px; }
      .opt-BRUT-1 .b1-slot{ border:2px solid #0A0A0A; height:52px; min-width:52px; padding:0 14px; display:flex; align-items:center; justify-content:center;
        font-family:'Archivo Black'; font-size:22px; text-transform:uppercase; }
      .opt-BRUT-1 .b1-slot.on{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-1 .b1-roster{ border:2px solid #0A0A0A; }
      .opt-BRUT-1 .b1-row{ display:grid; grid-template-columns:26px 1fr auto; align-items:center;
        gap:8px; padding:12px; border-bottom:1px solid #0A0A0A; font-size:14px; text-transform:uppercase; letter-spacing:.04em; }
      .opt-BRUT-1 .b1-row:last-child{ border-bottom:0; }
      .opt-BRUT-1 .b1-row.you{ box-shadow:inset 4px 0 0 #E61919; background:#EAE8E3; }
      .opt-BRUT-1 .b1-row b{ font-family:'Archivo Black'; font-size:15px; }
      .opt-BRUT-1 .b1-seat{ font-family:'IBM Plex Mono'; font-size:11px; }
      .opt-BRUT-1 .b1-tag{ font-size:9px; letter-spacing:.12em; padding:3px 6px; border:1px solid #0A0A0A; }
      .opt-BRUT-1 .b1-tag.red{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-1 .b1-dot{ width:11px; height:11px; border:2px solid #0A0A0A; }
      .opt-BRUT-1 .b1-dot.on{ background:#0A0A0A; }
      .opt-BRUT-1 .b1-quote{ border-left:6px solid #E61919; padding:8px 0 8px 14px; margin:10px 0; }
      .opt-BRUT-1 .b1-quote em{ font-family:'Playfair Display',serif; font-style:italic; font-size:26px; line-height:1.1; }
      .opt-BRUT-1 .b1-serif{ font-family:'Playfair Display',serif; }
      /* alignment-law poem row: fixed numeral gutter, text column, author on the right */
      .opt-BRUT-1 .b1-pl{ display:grid; grid-template-columns:2.6ch 1fr auto; gap:12px; align-items:baseline;
        padding:11px 0; border-bottom:1px solid rgba(10,10,10,.18); }
      .opt-BRUT-1 .b1-pl:last-child{ border-bottom:0; }
      .opt-BRUT-1 .b1-pl .n{ font-family:'IBM Plex Mono'; font-size:11px; letter-spacing:.06em; padding-top:5px; }
      .opt-BRUT-1 .b1-pl .t{ font-family:'Playfair Display',serif; font-size:22px; line-height:1.16; }
      .opt-BRUT-1 .b1-pl .a{ font-size:9px; letter-spacing:.14em; text-transform:uppercase; text-align:right; white-space:nowrap; padding-top:7px; }
      .opt-BRUT-1 .b1-pl.cur .t{ color:#E61919; }
      .opt-BRUT-1 .b1-pl.cur .n{ color:#E61919; font-weight:600; }
      .opt-BRUT-1 .b1-pl.up .t{ color:rgba(10,10,10,.26); font-style:italic; }
      .opt-BRUT-1 .b1-onair{ display:inline-block; background:#E61919; color:#F4F4F0; font-family:'IBM Plex Mono';
        font-size:9px; letter-spacing:.14em; padding:3px 7px; text-transform:uppercase; vertical-align:middle; margin-left:8px; }
      .opt-BRUT-1 .b1-prog{ display:flex; gap:4px; margin:10px 0; }
      .opt-BRUT-1 .b1-prog i{ flex:1; height:9px; border:1px solid #0A0A0A; }
      .opt-BRUT-1 .b1-prog i.on{ background:#0A0A0A; }
      .opt-BRUT-1 .b1-prog i.now{ background:#E61919; border-color:#E61919; }
      .opt-BRUT-1 .b1-stamp{ display:inline-block; border:3px solid #E61919; color:#E61919; padding:8px 14px;
        font-family:'Archivo Black'; font-size:20px; text-transform:uppercase; letter-spacing:.02em; transform:rotate(-4deg); }
      .opt-BRUT-1 .b1-in{ animation:b1in .4s ease both; }
      @keyframes b1in{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
      @media (prefers-reduced-motion: reduce){ .opt-BRUT-1 .b1-in{ animation:none; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>EDITION 09 · REV 2.6</span></div>
            <div class="b1-body">
              <p class="b1-kick">A PARTY PRESS FOR NINE HANDS</p>
              <h1 class="b1-folio" style="font-size:clamp(58px,20vw,88px)">LINE<br>JAM</h1>
              <div class="b1-rule"></div>
              <p class="b1-serif" style="font-size:20px;line-height:1.25;margin:0">Nine lines. Nine writers. You only ever see the line before yours.</p>
              <div class="b1-hair"></div>
              <p class="b1-kick">SET IN THE ROOM · READ ALOUD AT THE END</p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">START A GAME <span class="arw">&gt;&gt;&gt;</span></button>
              <button class="b1-btn alt">JOIN A ROOM <span class="arw">///</span></button>
            </div>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>[ JOIN ]</span></div>
            <div class="b1-body">
              <p class="b1-kick">ENTER THE PRESS</p>
              <h1 class="b1-folio" style="font-size:44px">JOIN A<br>ROOM</h1>
              <div class="b1-rule"></div>
              <div class="b1-field"><label>Room code / four letters</label><input value="PLUM" maxlength="4" aria-label="Room code"></div>
              <div class="b1-field"><label>Your pen name</label><input placeholder="——" aria-label="Pen name"></div>
              <p class="b1-kick">FRIENDS AT THE TABLE TYPE THE SAME CODE</p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">JOIN <span class="arw">&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        const rows = corpus.players.map((p, i) => `
          <div class="b1-row">
            <div class="b1-dot ${p.present ? 'on' : ''}" aria-label="${p.present ? 'present' : 'away'}"></div>
            <div><b>${p.name.toUpperCase()}</b> <span class="b1-seat">SEAT ${String(i + 1).padStart(2, '0')}</span></div>
            <div>${p.host ? '<span class="b1-tag red">HOST</span>' : p.kind === 'ai' ? '<span class="b1-tag">MACHINE</span>' : p.present ? '<span class="b1-tag">READY</span>' : '<span class="b1-tag">AWAY</span>'}</div>
          </div>`).join('');
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>ROOM / OPEN</span></div>
            <div class="b1-body">
              <p class="b1-kick">SHOW THIS ACROSS THE TABLE</p>
              <h1 class="b1-folio" style="font-size:clamp(96px,34vw,150px);color:#E61919">${corpus.roomCode}</h1>
              <div class="b1-rule"></div>
              <p class="b1-kick" style="margin-bottom:8px">CREW / ${corpus.players.length} SET</p>
              <div class="b1-roster">${rows}</div>
              <div class="b1-hair"></div>
              <button class="b1-btn alt" style="justify-content:center">+ ADD A MACHINE HAND</button>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">START THE PRESS <span class="arw">&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const words = g.draft.split(' ');
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>PLATE ${String(g.round).padStart(2, '0')} / ${g.totalRounds}</span></div>
            <div class="b1-body">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <p class="b1-kick" style="margin:0">SET EXACTLY</p>
                <h1 class="b1-folio" style="font-size:34px;color:#E61919">${g.wordsThisRound} WORDS</h1>
              </div>
              <div class="b1-rule"></div>
              <p class="b1-kick">THE ONLY LINE YOU SEE</p>
              <div class="b1-quote"><em>${g.previousLine}</em></div>
              <div class="b1-hair"></div>
              <p class="b1-kick" style="margin-bottom:8px">YOUR MEASURE · <span id="b1count">${words.length}</span>/${g.wordsThisRound}</p>
              <div class="b1-slots" id="b1slots"></div>
              <div class="b1-field" style="margin-top:14px"><label>Type your line</label>
                <input id="b1inp" value="${g.draft}" aria-label="Your line" style="font-size:16px;font-family:'IBM Plex Mono';letter-spacing:.02em;text-transform:none"></div>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red" id="b1sub">SUBMIT LINE <span class="arw">&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
        const N = g.wordsThisRound;
        const slots = el.querySelector('#b1slots');
        const cnt = el.querySelector('#b1count');
        const inp = el.querySelector('#b1inp');
        const render = () => {
          const w = inp.value.trim().split(/\s+/).filter(Boolean).slice(0, N);
          slots.innerHTML = Array.from({ length: N }, (_, i) =>
            `<div class="b1-slot ${w[i] ? 'on' : ''}">${w[i] ? w[i].toUpperCase() : '·'}</div>`).join('');
          cnt.textContent = String(w.length);
        };
        inp.addEventListener('input', render);
        render();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn.join(', ').toUpperCase();
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>PLATE 05 / 09</span></div>
            <div class="b1-body" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
              <div class="b1-stamp b1-in">LINE SET</div>
              <div class="b1-rule" style="width:70%"></div>
              <h1 class="b1-folio" style="font-size:40px">WAITING<br>ON</h1>
              <h2 class="b1-folio" style="font-size:52px;color:#E61919;margin-top:8px">${waiting}</h2>
              <p class="b1-kick" style="margin-top:16px">THE PRESS HOLDS THE FORM UNTIL EVERY HAND SETS ITS LINE</p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn alt">READ THE HOUSE RULES <span class="arw">///</span></button>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'READ', now: 'READING NOW', next: 'UP NEXT', waiting: 'WAITING' };
        const rows = corpus.revealQueue.map((q) => {
          const now = q.status === 'now';
          const done = q.status === 'read';
          return `
          <div class="b1-row ${now ? 'you' : ''}">
            <div class="b1-dot ${done ? 'on' : ''}" aria-label="${label[q.status]}"></div>
            <div><b>${q.poem.toUpperCase()}</b> <span class="b1-seat">${q.reader.toUpperCase()}${now ? ' · YOU' : ''}</span></div>
            <div><span class="b1-tag ${now ? 'red' : ''}">${label[q.status]}</span></div>
          </div>`;
        }).join('');
        const me = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>[ READING CIRCLE ]</span></div>
            <div class="b1-body">
              <p class="b1-kick">READ ALOUD · ONE POEM AT A TIME</p>
              <h1 class="b1-folio" style="font-size:44px">THE<br>CIRCLE</h1>
              <div class="b1-rule"></div>
              <p class="b1-kick" style="margin-bottom:8px">ORDER · ${corpus.revealQueue.length} POEMS</p>
              <div class="b1-roster">${rows}</div>
              <div class="b1-hair"></div>
              <p class="b1-kick">EVERYONE ON THEIR OWN PHONE. YOUR TURN, YOU READ YOUR WHOLE POEM TO THE ROOM.</p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">READ ${me ? me.poem.toUpperCase() : 'YOURS'} <span class="arw">&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        const lines = p.lines.map((l, i) => `
          <div class="b1-pl b1-in" style="animation-delay:${i * 0.04}s">
            <div class="n">${String(i + 1).padStart(2, '0')}</div>
            <div class="t">${l.text}</div>
            <div class="a">${l.author}</div>
          </div>`).join('');
        const prog = Array.from({ length: r.total }, (_, i) => {
          const now = i === r.position - 1;
          const on = i < r.position - 1;
          return `<i class="${now ? 'now' : on ? 'on' : ''}"></i>`;
        }).join('');
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>[ READ ALOUD ]</span></div>
            <div class="b1-body">
              <p class="b1-kick">YOUR POEM · READ IT TO THE ROOM <span class="b1-onair">on air</span></p>
              <h1 class="b1-folio b1-serif" style="font-size:40px;font-family:'Playfair Display';font-style:italic;text-transform:none;letter-spacing:0">${p.title}</h1>
              <p class="b1-kick" style="margin-top:6px">POEM ${r.position} OF ${r.total} · READER ${r.reader.toUpperCase()}</p>
              <div class="b1-prog">${prog}</div>
              <div class="b1-rule"></div>
              <div>${lines}</div>
              <div class="b1-hair"></div>
              <p class="b1-kick">WHEN YOU FINISH, HAND THE READING TO <span style="color:#E61919;font-family:'Archivo Black'">${r.upNext.toUpperCase()}</span></p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">DONE <span class="arw">&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
    },
  };

  // ============================================================= BRUT-2
  // CONSOLE — Tactical Telemetry (dark). One HUD chassis with crosshair
  // corners and a fixed command bar; screens are mission phases swapped
  // inside the frame. Monospace-dominant, scanline substrate.
  window.LANE_SPECS['BRUT-2'] = {
    lane: 'brut',
    title: 'Console',
    move: 'One HUD chassis with a fixed command bar; TX buffer cells now grow with the word (no clip), and the read-aloud decode aligns every line to a fixed callsign gutter with a green on-air marker.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;500;700&display=swap');
      .opt-BRUT-2{ background:#0A0A0A; color:#EAEAEA; font-family:'JetBrains Mono',monospace; }
      .opt-BRUT-2 *{ box-sizing:border-box; border-radius:0 !important; }
      .opt-BRUT-2 .b2{ height:100%; display:flex; flex-direction:column; position:relative; padding:10px; }
      .opt-BRUT-2 .b2-scan{ position:absolute; inset:0; pointer-events:none; z-index:5;
        background:repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.35) 3px, rgba(0,0,0,.35) 4px); opacity:.5; }
      .opt-BRUT-2 .b2-frame{ flex:1; border:1px solid #EAEAEA; position:relative; display:flex; flex-direction:column; min-height:0; }
      .opt-BRUT-2 .b2-x{ position:absolute; color:#E61919; font-size:14px; line-height:1; z-index:6; }
      .opt-BRUT-2 .b2-x.tl{ top:-8px; left:-6px; } .opt-BRUT-2 .b2-x.tr{ top:-8px; right:-6px; }
      .opt-BRUT-2 .b2-x.bl{ bottom:-8px; left:-6px; } .opt-BRUT-2 .b2-x.br{ bottom:-8px; right:-6px; }
      .opt-BRUT-2 .b2-strip{ display:flex; justify-content:space-between; padding:7px 10px; border-bottom:1px solid #EAEAEA;
        font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:#EAEAEA; }
      .opt-BRUT-2 .b2-strip .red{ color:#E61919; }
      .opt-BRUT-2 .b2-main{ flex:1; overflow-y:auto; padding:14px; min-height:0; }
      .opt-BRUT-2 .b2-cmd{ display:grid; gap:6px; padding:10px; border-top:1px solid #EAEAEA; }
      .opt-BRUT-2 .b2-btn{ display:flex; align-items:center; justify-content:space-between; min-height:54px; padding:0 16px;
        border:1px solid #E61919; background:#E61919; color:#0A0A0A; font-family:'JetBrains Mono'; font-weight:700;
        font-size:14px; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; width:100%; }
      .opt-BRUT-2 .b2-btn.ghost{ background:transparent; color:#EAEAEA; border-color:#EAEAEA; }
      .opt-BRUT-2 .b2-huge{ font-family:'Archivo Black'; text-transform:uppercase; line-height:.86; letter-spacing:-.04em; margin:0; }
      .opt-BRUT-2 .b2-label{ font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:#EAEAEA; opacity:.75; }
      .opt-BRUT-2 .b2-red{ color:#E61919; }
      .opt-BRUT-2 .b2-hr{ border:0; border-top:1px solid rgba(234,234,234,.4); margin:12px 0; }
      .opt-BRUT-2 .b2-tbl{ width:100%; border-collapse:collapse; font-size:12px; }
      .opt-BRUT-2 .b2-tbl td{ padding:9px 6px; border-bottom:1px solid rgba(234,234,234,.3); text-transform:uppercase; letter-spacing:.05em; }
      .opt-BRUT-2 .b2-tbl tr:last-child td{ border-bottom:0; }
      .opt-BRUT-2 .b2-tbl tr.you td{ background:rgba(230,25,25,.1); }
      .opt-BRUT-2 .b2-led{ display:inline-block; width:9px; height:9px; }
      .opt-BRUT-2 .b2-led.on{ background:#4AF626; box-shadow:0 0 6px #4AF626; }
      .opt-BRUT-2 .b2-led.off{ background:transparent; border:1px solid #E61919; }
      .opt-BRUT-2 .b2-pill{ font-size:9px; letter-spacing:.1em; padding:2px 5px; border:1px solid #EAEAEA; }
      .opt-BRUT-2 .b2-pill.red{ border-color:#E61919; color:#E61919; }
      .opt-BRUT-2 .b2-buf{ display:flex; flex-wrap:wrap; gap:6px; }
      .opt-BRUT-2 .b2-cell{ border:1px solid #EAEAEA; height:48px; min-width:48px; padding:0 12px; display:flex; align-items:center; justify-content:center;
        font-family:'Archivo Black'; font-size:15px; text-transform:uppercase; color:#EAEAEA; }
      .opt-BRUT-2 .b2-cell.on{ border-color:#4AF626; color:#4AF626; }
      .opt-BRUT-2 .b2-inbound{ border:1px solid #E61919; padding:12px; margin:8px 0; }
      .opt-BRUT-2 .b2-inbound b{ font-family:'Archivo Black'; font-size:22px; line-height:1.1; text-transform:uppercase; letter-spacing:-.02em; }
      .opt-BRUT-2 .b2-inp{ width:100%; background:#0A0A0A; border:1px solid #EAEAEA; color:#4AF626; font-family:'JetBrains Mono';
        font-size:15px; padding:12px; outline:none; letter-spacing:.04em; }
      /* alignment-law poem row: fixed callsign gutter, uppercase text, author right */
      .opt-BRUT-2 .b2-pl{ display:grid; grid-template-columns:2.6ch 1fr auto; gap:10px; align-items:baseline;
        padding:9px 0; border-bottom:1px solid rgba(234,234,234,.2); }
      .opt-BRUT-2 .b2-pl:last-child{ border-bottom:0; }
      .opt-BRUT-2 .b2-pl .n{ font-size:10px; letter-spacing:.08em; color:#E61919; padding-top:3px; }
      .opt-BRUT-2 .b2-pl .t{ font-family:'Archivo Black'; font-size:18px; line-height:1.16; text-transform:uppercase; letter-spacing:-.02em; }
      .opt-BRUT-2 .b2-pl .a{ font-size:9px; letter-spacing:.1em; opacity:.7; text-align:right; padding-top:4px; white-space:nowrap; }
      .opt-BRUT-2 .b2-pl.cur .t{ color:#4AF626; }
      .opt-BRUT-2 .b2-pl.cur .n{ color:#4AF626; }
      .opt-BRUT-2 .b2-pl.up .t{ color:rgba(234,234,234,.26); }
      .opt-BRUT-2 .b2-onair{ font-size:9px; letter-spacing:.12em; color:#4AF626; margin-left:8px; }
      .opt-BRUT-2 .b2-prog{ display:flex; gap:4px; margin:10px 0; }
      .opt-BRUT-2 .b2-prog i{ flex:1; height:8px; border:1px solid rgba(234,234,234,.5); }
      .opt-BRUT-2 .b2-prog i.on{ background:#EAEAEA; border-color:#EAEAEA; }
      .opt-BRUT-2 .b2-prog i.now{ background:#4AF626; border-color:#4AF626; box-shadow:0 0 6px #4AF626; }
      .opt-BRUT-2 .b2-cur{ display:inline-block; width:9px; height:16px; background:#4AF626; vertical-align:-2px; animation:b2blink 1s steps(1) infinite; }
      .opt-BRUT-2 .b2-in{ animation:b2in .35s ease both; }
      @keyframes b2blink{ 50%{ opacity:0; } }
      @keyframes b2in{ from{ opacity:0; transform:translateX(-6px); } to{ opacity:1; transform:none; } }
      @media (prefers-reduced-motion: reduce){ .opt-BRUT-2 .b2-cur{ animation:none; } .opt-BRUT-2 .b2-in{ animation:none; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span>UNIT / LJM-09</span><span class="red">● SYS READY</span></div>
              <div class="b2-main">
                <p class="b2-label">// COLLABORATIVE VERSE TERMINAL</p>
                <h1 class="b2-huge" style="font-size:clamp(46px,15vw,66px)">LINE<br><span class="b2-red">JAM</span></h1>
                <hr class="b2-hr">
                <p style="font-size:13px;line-height:1.5">NINE WRITERS. NINE LINES. INTEL LIMITED TO THE LINE BEFORE YOURS.</p>
                <hr class="b2-hr">
                <p class="b2-label">&gt;&gt;&gt; SELECT AN OPERATION</p>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">START A GAME <span>[ ENTER ]</span></button>
                <button class="b2-btn ghost">JOIN A ROOM <span>[ CODE ]</span></button>
              </div>
            </div>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span>UNIT / LJM-09</span><span>MODE / JOIN</span></div>
              <div class="b2-main">
                <p class="b2-label">// AUTHENTICATE TO CHANNEL</p>
                <h1 class="b2-huge" style="font-size:38px;margin-top:6px">JOIN<br>ROOM</h1>
                <hr class="b2-hr">
                <p class="b2-label">ROOM CODE / 4 CHAR</p>
                <div style="margin:8px 0 4px"><span class="b2-red" style="font-family:'Archivo Black';font-size:30px;letter-spacing:.14em">PLUM</span><span class="b2-cur"></span></div>
                <hr class="b2-hr">
                <p class="b2-label">CALLSIGN / PEN NAME</p>
                <input class="b2-inp" style="margin-top:8px" placeholder="&gt; ENTER NAME_" aria-label="Pen name">
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">CONNECT <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        const rows = corpus.players.map((p, i) => `
          <tr>
            <td style="width:14px"><span class="b2-led ${p.present ? 'on' : 'off'}"></span></td>
            <td><b style="font-family:'Archivo Black'">${p.name.toUpperCase()}</b></td>
            <td class="b2-label">S-${String(i + 1).padStart(2, '0')}</td>
            <td style="text-align:right">${p.host ? '<span class="b2-pill red">HOST</span>' : p.kind === 'ai' ? '<span class="b2-pill">AI UNIT</span>' : p.present ? '<span class="b2-pill">LIVE</span>' : '<span class="b2-pill red">DARK</span>'}</td>
          </tr>`).join('');
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span>CHANNEL / OPEN</span><span class="red">● HOLDING</span></div>
              <div class="b2-main">
                <p class="b2-label">// BROADCAST TO ROOM</p>
                <h1 class="b2-huge b2-red" style="font-size:clamp(84px,30vw,132px)">${corpus.roomCode}</h1>
                <hr class="b2-hr">
                <p class="b2-label">CREW MANIFEST / ${corpus.players.length} UNITS</p>
                <table class="b2-tbl" style="margin-top:8px">${rows}</table>
                <hr class="b2-hr">
                <button class="b2-btn ghost" style="justify-content:center">[ + ] DEPLOY ANOTHER AI UNIT</button>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">LAUNCH SESSION <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const initial = g.draft.trim().split(/\s+/).filter(Boolean).length;
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span>PHASE ${String(g.round).padStart(2, '0')} / ${g.totalRounds}</span><span class="red">● TX WINDOW</span></div>
              <div class="b2-main">
                <div style="display:flex;justify-content:space-between;align-items:flex-end">
                  <p class="b2-label" style="margin:0">// TRANSMIT EXACTLY</p>
                  <h1 class="b2-huge b2-red" style="font-size:40px">${g.wordsThisRound}<span style="font-size:14px"> WORDS</span></h1>
                </div>
                <p class="b2-label" style="margin-top:14px">&lt;&lt; INBOUND · LAST LINE ONLY</p>
                <div class="b2-inbound"><b>${g.previousLine}</b></div>
                <p class="b2-label">TX BUFFER · <span id="b2n" class="b2-red">${initial}</span>/${g.wordsThisRound} FILLED</p>
                <div class="b2-buf" id="b2buf" style="margin:8px 0 12px"></div>
                <input class="b2-inp" id="b2inp" value="${g.draft}" aria-label="Your line">
              </div>
              <div class="b2-cmd">
                <button class="b2-btn" id="b2tx">TRANSMIT <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
        const N = g.wordsThisRound;
        const buf = el.querySelector('#b2buf');
        const nEl = el.querySelector('#b2n');
        const inp = el.querySelector('#b2inp');
        const render = () => {
          const w = inp.value.trim().split(/\s+/).filter(Boolean).slice(0, N);
          buf.innerHTML = Array.from({ length: N }, (_, i) =>
            `<div class="b2-cell ${w[i] ? 'on' : ''}">${w[i] ? w[i].toUpperCase() : '_'}</div>`).join('');
          nEl.textContent = String(w.length);
        };
        inp.addEventListener('input', render);
        render();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn.join(', ').toUpperCase();
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span>PHASE 05 / 09</span><span class="red">● STANDBY</span></div>
              <div class="b2-main" style="display:flex;flex-direction:column;justify-content:center;text-align:center">
                <p class="b2-label b2-in">// TRANSMISSION LOGGED</p>
                <h1 class="b2-huge" style="font-size:52px;margin:12px 0">SENT<span class="b2-cur" style="height:40px;width:16px;margin-left:8px"></span></h1>
                <hr class="b2-hr">
                <p class="b2-label">AWAITING UNITS</p>
                <h2 class="b2-huge b2-red" style="font-size:52px">${waiting}</h2>
                <p class="b2-label" style="margin-top:16px">HOLDING PHASE UNTIL ALL UNITS REPORT IN</p>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn ghost">VIEW MANIFEST <span>[ ESC ]</span></button>
              </div>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'READ', now: 'ON AIR · YOU', next: 'UP NEXT', waiting: 'WAITING' };
        const rows = corpus.revealQueue.map((q) => {
          const now = q.status === 'now';
          const done = q.status === 'read';
          return `
          <tr class="${now ? 'you' : ''}">
            <td style="width:14px"><span class="b2-led ${done ? 'on' : 'off'}"></span></td>
            <td class="b2-label" style="width:56px">${q.poem.toUpperCase()}</td>
            <td><b style="font-family:'Archivo Black'">${q.reader.toUpperCase()}</b></td>
            <td style="text-align:right"><span class="b2-pill ${now ? 'red' : ''}">${label[q.status]}</span></td>
          </tr>`;
        }).join('');
        const me = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span class="red">● READING NET</span><span>READ ALOUD</span></div>
              <div class="b2-main">
                <p class="b2-label">// READING NET · ${corpus.revealQueue.length} STATIONS</p>
                <table class="b2-tbl" style="margin-top:6px">${rows}</table>
                <hr class="b2-hr">
                <p class="b2-label">EACH UNIT ON ITS OWN HANDSET. ON YOUR TURN YOU READ YOUR WHOLE POEM TO THE ROOM.</p>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">READ ${me ? me.poem.toUpperCase() : 'YOURS'} <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        const rows = p.lines.map((l, i) => `
            <div class="b2-pl b2-in" style="animation-delay:${i * 0.04}s">
              <div class="n">${String(i + 1).padStart(2, '0')}</div>
              <div class="t">${l.text}</div>
              <div class="a">${l.author}</div>
            </div>`).join('');
        const prog = Array.from({ length: r.total }, (_, i) => {
          const now = i === r.position - 1;
          const on = i < r.position - 1;
          return `<i class="${now ? 'now' : on ? 'on' : ''}"></i>`;
        }).join('');
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span class="red">● ON AIR</span><span>READ ALOUD</span></div>
              <div class="b2-main">
                <p class="b2-label">// FULL DECODE · READ TO THE ROOM · ${p.title.toUpperCase()}</p>
                <p class="b2-label" style="margin-top:8px">READER</p>
                <h1 class="b2-huge" style="font-size:clamp(52px,17vw,72px)">${r.reader.toUpperCase()}</h1>
                <p class="b2-label" style="margin-top:6px">POEM ${r.position}/${r.total} · NEXT UP <span class="b2-red">${r.upNext.toUpperCase()}</span></p>
                <div class="b2-prog">${prog}</div>
                <hr class="b2-hr">
                <div>${rows}</div>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">DONE <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
    },
  };

  // ============================================================= BRUT-4
  // BOARD — Split-Flap Departures (Solari mechanical). A dark station board
  // of warm off-white flap tiles: each character is a tile with a horizontal
  // flap seam. The read-aloud ceremony IS a departures board flipping one
  // poem line at a time — legible held up across a room. Word rows are built
  // from per-character tiles, so a slot can never clip; it grows tile by tile.
  const flap = (text) =>
    String(text).split(' ').map((w) =>
      `<span class="b4-word">` +
      w.split('').map((c) => `<span class="b4-tile">${c === '&' ? '&amp;' : c}</span>`).join('') +
      `</span>`
    ).join('');

  window.LANE_SPECS['BRUT-4'] = {
    lane: 'brut',
    title: 'Board',
    move: 'A split-flap Solari departures board: characters are flap tiles that grow the slot instead of clipping, and the read-aloud ceremony flips one aligned poem line at a time — a room-legible payoff that needs no separate presentation mode.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap');
      .opt-BRUT-4{ background:#161514; color:#EDEBE4; font-family:'Space Mono',monospace; }
      .opt-BRUT-4 *{ box-sizing:border-box; border-radius:0 !important; }
      .opt-BRUT-4 .b4{ height:100%; display:flex; flex-direction:column; position:relative; }
      .opt-BRUT-4 .b4-head{ display:flex; justify-content:space-between; align-items:center; padding:11px 14px;
        border-bottom:2px solid #EDEBE4; font-size:9px; letter-spacing:.16em; text-transform:uppercase; }
      .opt-BRUT-4 .b4-head b{ font-family:'Archivo Black'; font-size:13px; letter-spacing:-.02em; }
      .opt-BRUT-4 .b4-head .red{ color:#E61919; }
      .opt-BRUT-4 .b4-body{ flex:1; overflow-y:auto; padding:14px; min-height:0; }
      .opt-BRUT-4 .b4-label{ font-size:9px; letter-spacing:.18em; text-transform:uppercase; opacity:.7; margin:0 0 8px; }
      .opt-BRUT-4 .b4-red{ color:#E61919; }
      .opt-BRUT-4 .b4-rule{ height:0; border-top:2px solid #E61919; margin:12px 0; }
      .opt-BRUT-4 .b4-hair{ height:0; border-top:1px solid rgba(237,235,228,.22); margin:12px 0; }
      /* split-flap tiles */
      .opt-BRUT-4 .b4-words{ display:flex; flex-wrap:wrap; gap:8px; }
      .opt-BRUT-4 .b4-word{ display:inline-flex; gap:3px; }
      .opt-BRUT-4 .b4-tile{ position:relative; background:#EDEBE4; color:#161514; font-family:'Archivo Black';
        min-width:1.05em; padding:6px 5px; text-align:center; text-transform:uppercase; line-height:1;
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.28); }
      .opt-BRUT-4 .b4-tile::after{ content:''; position:absolute; left:0; right:0; top:50%; height:1px;
        background:rgba(0,0,0,.5); transform:translateY(-.5px); }
      .opt-BRUT-4 .b4-tile.on{ background:#E61919; color:#EDEBE4; }
      .opt-BRUT-4 .b4-tile.blank{ background:#211F1D; color:transparent; box-shadow:inset 0 0 0 1px rgba(237,235,228,.18); }
      .opt-BRUT-4 .b4-tile.blank::after{ background:rgba(237,235,228,.18); }
      .opt-BRUT-4 .b4-xl .b4-tile{ font-size:42px; }
      .opt-BRUT-4 .b4-lg .b4-tile{ font-size:26px; }
      .opt-BRUT-4 .b4-md .b4-tile{ font-size:16px; }
      /* departure/flight rows */
      .opt-BRUT-4 .b4-flight{ display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center;
        padding:10px 0; border-bottom:1px solid rgba(237,235,228,.18); }
      .opt-BRUT-4 .b4-flight:last-child{ border-bottom:0; }
      .opt-BRUT-4 .b4-flight.you{ box-shadow:inset 4px 0 0 #E61919; }
      .opt-BRUT-4 .b4-gate{ font-family:'Space Mono'; font-size:11px; letter-spacing:.06em; opacity:.75; }
      .opt-BRUT-4 .b4-name{ font-family:'Archivo Black'; font-size:16px; text-transform:uppercase; letter-spacing:-.01em; }
      .opt-BRUT-4 .b4-sub{ font-family:'Space Mono'; font-size:9px; letter-spacing:.1em; opacity:.6; }
      .opt-BRUT-4 .b4-stat{ font-size:9px; letter-spacing:.12em; text-transform:uppercase; padding:3px 7px; border:1px solid #EDEBE4; white-space:nowrap; }
      .opt-BRUT-4 .b4-stat.red{ background:#E61919; border-color:#E61919; color:#EDEBE4; }
      .opt-BRUT-4 .b4-stat.dim{ opacity:.4; }
      .opt-BRUT-4 .b4-dot{ width:11px; height:11px; border:2px solid #EDEBE4; }
      .opt-BRUT-4 .b4-dot.on{ background:#EDEBE4; }
      /* alignment-law poem row: fixed numeral gutter, text column, author right */
      .opt-BRUT-4 .b4-pl{ display:grid; grid-template-columns:2.6ch 1fr auto; gap:10px; align-items:baseline;
        padding:10px 0; border-bottom:1px solid rgba(237,235,228,.16); }
      .opt-BRUT-4 .b4-pl:last-child{ border-bottom:0; }
      .opt-BRUT-4 .b4-pl .n{ font-family:'Space Mono'; font-size:11px; letter-spacing:.06em; color:#E61919; padding-top:3px; }
      .opt-BRUT-4 .b4-pl .t{ font-family:'Archivo Black'; font-size:18px; line-height:1.18; text-transform:uppercase; letter-spacing:-.02em; }
      .opt-BRUT-4 .b4-pl .a{ font-size:9px; letter-spacing:.12em; text-transform:uppercase; opacity:.7; text-align:right; white-space:nowrap; padding-top:5px; }
      .opt-BRUT-4 .b4-pl.cur .t{ color:#E61919; }
      .opt-BRUT-4 .b4-pl.up .t{ color:rgba(237,235,228,.24); }
      .opt-BRUT-4 .b4-onair{ font-size:9px; letter-spacing:.12em; color:#E61919; margin-left:8px; }
      .opt-BRUT-4 .b4-prog{ display:flex; gap:4px; margin:10px 0; }
      .opt-BRUT-4 .b4-prog i{ flex:1; height:8px; border:1px solid rgba(237,235,228,.45); }
      .opt-BRUT-4 .b4-prog i.on{ background:#EDEBE4; border-color:#EDEBE4; }
      .opt-BRUT-4 .b4-prog i.now{ background:#E61919; border-color:#E61919; }
      .opt-BRUT-4 .b4-inp{ width:100%; background:#211F1D; border:2px solid #EDEBE4; color:#EDEBE4; font-family:'Space Mono';
        font-size:15px; padding:12px; outline:none; letter-spacing:.04em; }
      .opt-BRUT-4 .b4-foot{ padding:12px 14px 16px; border-top:2px solid #EDEBE4; display:grid; gap:8px; }
      .opt-BRUT-4 .b4-btn{ display:flex; align-items:center; justify-content:space-between; min-height:56px; padding:0 18px;
        border:2px solid #E61919; background:#E61919; color:#EDEBE4; font-family:'Archivo Black'; font-size:16px;
        text-transform:uppercase; letter-spacing:.01em; cursor:pointer; width:100%; }
      .opt-BRUT-4 .b4-btn.ghost{ background:transparent; color:#EDEBE4; border-color:#EDEBE4; }
      /* flip-in for tiles */
      .opt-BRUT-4 .b4-flip .b4-tile{ transform-origin:center top; animation:b4flip .5s cubic-bezier(.3,.7,.2,1) both; }
      .opt-BRUT-4 .b4-flip .b4-tile:nth-child(2){ animation-delay:.05s; }
      .opt-BRUT-4 .b4-flip .b4-tile:nth-child(3){ animation-delay:.1s; }
      .opt-BRUT-4 .b4-flip .b4-tile:nth-child(4){ animation-delay:.15s; }
      .opt-BRUT-4 .b4-flip .b4-tile:nth-child(5){ animation-delay:.2s; }
      .opt-BRUT-4 .b4-flip .b4-tile:nth-child(6){ animation-delay:.25s; }
      @keyframes b4flip{ 0%{ transform:perspective(220px) rotateX(-88deg); opacity:0; } 60%{ transform:perspective(220px) rotateX(6deg); opacity:1; } 100%{ transform:none; } }
      @media (prefers-reduced-motion: reduce){ .opt-BRUT-4 .b4-flip .b4-tile{ animation:none; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>LINEJAM</b><span class="red">● BOARD LIVE</span></div>
            <div class="b4-body">
              <p class="b4-label">// COLLABORATIVE VERSE · DEPARTURES BOARD</p>
              <div class="b4-words b4-xl b4-flip" style="margin:6px 0 4px">${flap('LINE')}</div>
              <div class="b4-words b4-xl b4-flip">${flap('JAM')}</div>
              <div class="b4-rule"></div>
              <p style="font-size:13px;line-height:1.5;margin:0">Nine writers. Nine lines. You only ever see the line before yours.</p>
              <div class="b4-hair"></div>
              <p class="b4-label">THE BOARD FILLS · THEN THE POEMS DEPART, READ ALOUD</p>
            </div>
            <div class="b4-foot">
              <button class="b4-btn">START A GAME <span>&gt;&gt;&gt;</span></button>
              <button class="b4-btn ghost">JOIN A ROOM <span>///</span></button>
            </div>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>LINEJAM</b><span>MODE / JOIN</span></div>
            <div class="b4-body">
              <p class="b4-label">// FLIP IN YOUR CODE</p>
              <div class="b4-words b4-lg b4-flip" style="margin:6px 0">${flap('PLUM')}</div>
              <div class="b4-hair"></div>
              <p class="b4-label">YOUR PEN NAME</p>
              <input class="b4-inp" style="margin-top:8px" placeholder="&gt; STAMP YOUR NAME" aria-label="Pen name">
              <div class="b4-hair"></div>
              <p class="b4-label">FRIENDS AT THE TABLE FLIP IN THE SAME CODE</p>
            </div>
            <div class="b4-foot">
              <button class="b4-btn">JOIN THE BOARD <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        const flights = corpus.players.map((p, i) => `
          <div class="b4-flight">
            <div class="b4-dot ${p.present ? 'on' : ''}" aria-label="${p.present ? 'present' : 'away'}"></div>
            <div><span class="b4-name">${p.name.toUpperCase()}</span> <span class="b4-sub">GATE ${String(i + 1).padStart(2, '0')}</span></div>
            <div>${p.host ? '<span class="b4-stat red">HOST</span>' : p.kind === 'ai' ? '<span class="b4-stat">AI</span>' : p.present ? '<span class="b4-stat">BOARDED</span>' : '<span class="b4-stat dim">AWAY</span>'}</div>
          </div>`).join('');
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>ROOM / OPEN</b><span class="red">● HOLDING</span></div>
            <div class="b4-body">
              <p class="b4-label">// SHOW THE BOARD ACROSS THE TABLE</p>
              <div class="b4-words b4-xl b4-flip" style="margin:6px 0">${flap(corpus.roomCode)}</div>
              <div class="b4-rule"></div>
              <p class="b4-label">CREW MANIFEST / ${corpus.players.length} BOARDED</p>
              <div style="margin-top:4px">${flights}</div>
              <div class="b4-hair"></div>
              <button class="b4-btn ghost" style="justify-content:center">+ ADD A MACHINE HAND</button>
            </div>
            <div class="b4-foot">
              <button class="b4-btn">LAUNCH THE BOARD <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const initial = g.draft.trim().split(/\s+/).filter(Boolean).length;
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>ROUND ${String(g.round).padStart(2, '0')} / ${g.totalRounds}</b><span class="red">● ${g.wordsThisRound} WORDS</span></div>
            <div class="b4-body">
              <p class="b4-label">// THE ONLY LINE YOU SEE</p>
              <div class="b4-words b4-md" style="margin-bottom:4px">${flap(g.previousLine.toUpperCase())}</div>
              <div class="b4-rule"></div>
              <p class="b4-label">YOUR LINE · <span class="b4-red" id="b4n">${initial}</span>/${g.wordsThisRound}</p>
              <div class="b4-words b4-md" id="b4live" style="margin:8px 0 12px"></div>
              <input class="b4-inp" id="b4inp" value="${g.draft}" aria-label="Your line">
            </div>
            <div class="b4-foot">
              <button class="b4-btn" id="b4sub">POST THE LINE <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
        const N = g.wordsThisRound;
        const live = el.querySelector('#b4live');
        const nEl = el.querySelector('#b4n');
        const inp = el.querySelector('#b4inp');
        const render = () => {
          const w = inp.value.trim().split(/\s+/).filter(Boolean).slice(0, N);
          const filled = w.map((word) =>
            `<span class="b4-word">` +
            word.split('').map((c) => `<span class="b4-tile on">${c.toUpperCase()}</span>`).join('') +
            `</span>`).join('');
          const blanks = Array.from({ length: Math.max(0, N - w.length) }, () =>
            `<span class="b4-word"><span class="b4-tile blank">·</span></span>`).join('');
          live.innerHTML = filled + blanks;
          nEl.textContent = String(w.length);
        };
        inp.addEventListener('input', render);
        render();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn.join(' ').toUpperCase();
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>ROUND 05 / 09</b><span class="red">● HOLDING</span></div>
            <div class="b4-body" style="display:flex;flex-direction:column;justify-content:center">
              <p class="b4-label">// YOUR LINE POSTED TO THE BOARD ✓</p>
              <div class="b4-words b4-lg b4-flip" style="margin:6px 0">${flap('WAITING')}</div>
              <div class="b4-rule"></div>
              <p class="b4-label">THE BOARD WAITS ON</p>
              <div class="b4-words b4-lg" style="margin-top:8px">${waiting.split(' ').map((n) => `<span class="b4-word">${n.split('').map((c) => `<span class="b4-tile on">${c}</span>`).join('')}</span>`).join('')}</div>
              <div class="b4-hair"></div>
              <p style="font-size:13px;line-height:1.5;margin:0">Still setting a line. The board holds until every hand flips in.</p>
            </div>
            <div class="b4-foot">
              <button class="b4-btn ghost">PEEK AT THE CREW <span>///</span></button>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const label = { read: 'READ', now: 'NOW', next: 'NEXT', waiting: 'WAITING' };
        const statCls = { read: 'dim', now: 'red', next: '', waiting: 'dim' };
        const sub = { read: 'READ ALOUD', now: 'YOUR TURN · READ ALOUD', next: 'ON DECK', waiting: 'HOLDING' };
        const flights = corpus.revealQueue.map((q) => `
          <div class="b4-flight ${q.status === 'now' ? 'you' : ''}">
            <div class="b4-gate">${q.poem.replace('Poem ', 'P')}</div>
            <div><span class="b4-name">${q.reader.toUpperCase()}</span> <span class="b4-sub">${sub[q.status]}</span></div>
            <div><span class="b4-stat ${statCls[q.status]}">${label[q.status]}</span></div>
          </div>`).join('');
        const me = corpus.revealQueue.find((q) => q.status === 'now');
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>DEPARTURES</b><span class="red">READ ALOUD</span></div>
            <div class="b4-body">
              <p class="b4-label">// READING ORDER · ${corpus.revealQueue.length} POEMS</p>
              <div style="margin-top:4px">${flights}</div>
              <div class="b4-rule"></div>
              <p class="b4-label" style="margin:0">EVERYONE ON THEIR OWN PHONE. YOUR TURN, YOU READ YOUR WHOLE POEM ALOUD TO THE ROOM.</p>
            </div>
            <div class="b4-foot">
              <button class="b4-btn">READ ${me ? me.poem.replace('Poem ', 'P') : 'YOURS'} <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;
        const p = corpus.poem;
        const rows = p.lines.map((l, i) => `
            <div class="b4-pl">
              <div class="n">${String(i + 1).padStart(2, '0')}</div>
              <div class="t">${l.text}</div>
              <div class="a">${l.author}</div>
            </div>`).join('');
        const prog = Array.from({ length: r.total }, (_, i) => {
          const now = i === r.position - 1;
          const on = i < r.position - 1;
          return `<i class="${now ? 'now' : on ? 'on' : ''}"></i>`;
        }).join('');
        el.innerHTML = `
          <div class="b4">
            <div class="b4-head"><b>NOW DEPARTING</b><span class="red">● ON AIR</span></div>
            <div class="b4-body">
              <p class="b4-label">// YOUR POEM · READ IT ALOUD TO THE ROOM · ${p.title.toUpperCase()}</p>
              <p class="b4-label" style="margin-top:8px">READER</p>
              <div class="b4-words b4-xl b4-flip" style="margin:2px 0 4px">${flap(r.reader)}</div>
              <p class="b4-label">POEM ${r.position} OF ${r.total}</p>
              <div class="b4-prog">${prog}</div>
              <div class="b4-rule"></div>
              <div>${rows}</div>
              <div class="b4-hair"></div>
              <p class="b4-label" style="margin:0 0 6px">WHEN YOU FINISH, PASS TO</p>
              <div class="b4-words b4-md">${flap(r.upNext)}</div>
            </div>
            <div class="b4-foot">
              <button class="b4-btn">DONE <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
    },
  };

  // ============================================================= BRUT-5
  // SPECIMEN — theme picker as a printer's type-specimen catalog. Neutral
  // Swiss-print chrome (carbon ink on unbleached paper) frames a scroll of
  // specimen plates; each plate paints a live mini-poem in that theme's OWN
  // paper/ink/accent plus a three-chip swatch bar, so every theme reads
  // truthfully against the same neutral rails. Active theme is stamped; every
  // plate's whole pick bar is a >=48px selection target. Scales by scroll.
  window.LANE_SPECS['BRUT-5'] = {
    lane: 'brut',
    section: 'SELECTOR',
    title: 'Specimen',
    move: 'The theme picker as a printer type-specimen book: each theme is a plate that renders a live two-line poem and a paper/ink/seal swatch bar in its own true colors, held on one neutral carbon-ink rail so 14+ themes stay legible and comparable on a phone.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:ital@1&display=swap');
      .opt-BRUT-5{ background:#F4F4F0; color:#0A0A0A; font-family:'IBM Plex Mono',monospace; }
      .opt-BRUT-5 *{ box-sizing:border-box; border-radius:0 !important; }
      .opt-BRUT-5 .b5{ height:100%; display:flex; flex-direction:column; position:relative; }
      .opt-BRUT-5 .b5-grain{ position:absolute; inset:0; pointer-events:none; opacity:.045; mix-blend-mode:multiply;
        background-image:radial-gradient(#0A0A0A 0.5px, transparent 0.5px); background-size:3px 3px; }
      .opt-BRUT-5 .b5-mast{ display:flex; justify-content:space-between; align-items:baseline;
        padding:12px 16px 8px; border-bottom:2px solid #0A0A0A; font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
      .opt-BRUT-5 .b5-mast b{ font-family:'Archivo Black'; font-size:13px; letter-spacing:-.02em; }
      .opt-BRUT-5 .b5-body{ flex:1; overflow-y:auto; padding:14px 16px 20px; }
      .opt-BRUT-5 .b5-kick{ font-size:10px; letter-spacing:.16em; text-transform:uppercase; margin:0; }
      .opt-BRUT-5 .b5-folio{ font-family:'Archivo Black'; text-transform:uppercase; line-height:.86; letter-spacing:-.04em; margin:2px 0 0; font-size:40px; }
      .opt-BRUT-5 .b5-rule{ height:0; border-top:6px solid #E61919; margin:12px 0; }
      .opt-BRUT-5 .b5-hair{ height:0; border-top:1px solid #0A0A0A; margin:12px 0; }
      /* specimen plate */
      .opt-BRUT-5 .b5-plate{ border:2px solid #0A0A0A; margin-bottom:14px; }
      .opt-BRUT-5 .b5-plate.on{ box-shadow:inset 0 0 0 2px #E61919; border-color:#E61919; }
      .opt-BRUT-5 .b5-phead{ display:flex; justify-content:space-between; align-items:baseline; gap:8px;
        padding:10px 12px; border-bottom:1px solid #0A0A0A; }
      .opt-BRUT-5 .b5-name{ font-family:'Archivo Black'; font-size:18px; text-transform:uppercase; letter-spacing:-.01em; }
      .opt-BRUT-5 .b5-vibe{ font-size:9px; letter-spacing:.12em; text-transform:uppercase; text-align:right; opacity:.7; white-space:nowrap; }
      .opt-BRUT-5 .b5-flag{ font-size:8px; letter-spacing:.12em; padding:2px 5px; border:1px solid #0A0A0A; margin-left:6px; vertical-align:middle; }
      .opt-BRUT-5 .b5-flag.live{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      /* live mini-mock painted in the theme's OWN colors */
      .opt-BRUT-5 .b5-mock{ padding:14px 14px 12px; position:relative; }
      .opt-BRUT-5 .b5-seal{ position:absolute; top:12px; right:12px; width:14px; height:14px; }
      .opt-BRUT-5 .b5-mline{ font-family:'Playfair Display',serif; font-style:italic; font-size:19px; line-height:1.22; }
      .opt-BRUT-5 .b5-mby{ font-family:'IBM Plex Mono'; font-size:9px; letter-spacing:.14em; text-transform:uppercase; margin-top:8px; }
      /* swatch bar: three true-color chips on the neutral rail */
      .opt-BRUT-5 .b5-swatch{ display:grid; grid-template-columns:1fr 1fr 1fr; border-top:1px solid #0A0A0A; }
      .opt-BRUT-5 .b5-chip{ display:flex; align-items:center; gap:7px; padding:8px 10px; font-size:8px; letter-spacing:.1em; text-transform:uppercase; }
      .opt-BRUT-5 .b5-chip + .b5-chip{ border-left:1px solid rgba(10,10,10,.3); }
      .opt-BRUT-5 .b5-sq{ width:16px; height:16px; border:1px solid #0A0A0A; flex:0 0 auto; }
      /* pick bar (>=48px selection target) */
      .opt-BRUT-5 .b5-pick{ display:flex; align-items:center; justify-content:space-between; width:100%;
        min-height:48px; padding:0 14px; border:0; border-top:2px solid #0A0A0A; background:#F4F4F0; color:#0A0A0A;
        font-family:'Archivo Black'; font-size:13px; text-transform:uppercase; letter-spacing:.01em; cursor:pointer; }
      .opt-BRUT-5 .b5-pick.on{ background:#0A0A0A; color:#F4F4F0; border-top-color:#0A0A0A; }
      .opt-BRUT-5 .b5-pick.soon{ cursor:default; color:rgba(10,10,10,.45); }
      .opt-BRUT-5 .b5-pick .arw{ font-family:'IBM Plex Mono'; font-size:13px; }
      .opt-BRUT-5 .b5-count{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; }
    `,
    screens: {
      selector(el, corpus) {
        const active = 'kenya';
        const shipped = corpus.themes.filter((t) => t.shipped !== false).length;
        const plates = corpus.themes.map((t) => {
          const isActive = t.id === active;
          const soon = t.shipped === false;
          const pick = isActive
            ? `<button class="b5-pick on" aria-current="true">● ACTIVE THEME <span class="arw">///</span></button>`
            : soon
              ? `<button class="b5-pick soon" disabled aria-label="${t.name}, coming soon">COMING SOON <span class="arw">···</span></button>`
              : `<button class="b5-pick">USE THIS THEME <span class="arw">&gt;&gt;&gt;</span></button>`;
          return `
          <article class="b5-plate ${isActive ? 'on' : ''}">
            <div class="b5-phead">
              <div class="b5-name">${t.name.toUpperCase()}${soon ? '<span class="b5-flag">SOON</span>' : ''}${isActive ? '<span class="b5-flag live">ON</span>' : ''}</div>
              <div class="b5-vibe">${t.vibe.toUpperCase()}</div>
            </div>
            <div class="b5-mock" style="background:${t.paper};color:${t.ink}">
              <span class="b5-seal" style="background:${t.accent}"></span>
              <div class="b5-mline">the paper folds<br>shut around us</div>
              <div class="b5-mby" style="color:${t.accent}">MAYA · RAVI</div>
            </div>
            <div class="b5-swatch">
              <div class="b5-chip"><span class="b5-sq" style="background:${t.paper}"></span>Paper</div>
              <div class="b5-chip"><span class="b5-sq" style="background:${t.ink}"></span>Ink</div>
              <div class="b5-chip"><span class="b5-sq" style="background:${t.accent}"></span>Seal</div>
            </div>
            ${pick}
          </article>`;
        }).join('');
        el.innerHTML = `
          <div class="b5">
            <div class="b5-grain"></div>
            <div class="b5-mast"><b>LINEJAM</b><span>[ TYPE SPECIMEN ]</span></div>
            <div class="b5-body">
              <p class="b5-kick">CHOOSE THE HOUSE STYLE</p>
              <h1 class="b5-folio">THEMES</h1>
              <div class="b5-rule"></div>
              <p class="b5-kick"><span class="b5-count">${corpus.themes.length} PLATES · ${shipped} SHIPPED</span></p>
              <div class="b5-hair"></div>
              ${plates}
            </div>
          </div>`;
      },
    },
  };
})();
