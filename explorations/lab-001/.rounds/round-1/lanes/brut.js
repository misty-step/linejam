// Lane: brut — Industrial Brutalism (Swiss print × tactical terminal).
// Three committed systems: BRUT-1 letterpress broadside (light Swiss print),
// BRUT-2 tactical HUD console (dark telemetry), BRUT-3 continuous paper tape
// (inverts "screens are separate pages"). Each option commits to ONE substrate
// per the skill; no mixing within an option.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // ============================================================= BRUT-1
  // BROADSIDE — Swiss Industrial Print. Every screen is a printed plate:
  // masthead, oversized folio, hazard-red rule, set body, platen CTA.
  window.LANE_SPECS['BRUT-1'] = {
    lane: 'brut',
    title: 'Broadside',
    move: 'Every screen is a printed plate: masthead, oversized folio numeral, hazard rule, set body, platen CTA in the thumb zone.',
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
      .opt-BRUT-1 .b1-slots{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .opt-BRUT-1 .b1-slot{ border:2px solid #0A0A0A; height:52px; display:flex; align-items:center; justify-content:center;
        font-family:'Archivo Black'; font-size:26px; text-transform:uppercase; }
      .opt-BRUT-1 .b1-slot.on{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-1 .b1-roster{ border:2px solid #0A0A0A; }
      .opt-BRUT-1 .b1-row{ display:grid; grid-template-columns:26px 1fr auto; align-items:center;
        gap:8px; padding:12px; border-bottom:1px solid #0A0A0A; font-size:14px; text-transform:uppercase; letter-spacing:.04em; }
      .opt-BRUT-1 .b1-row:last-child{ border-bottom:0; }
      .opt-BRUT-1 .b1-row b{ font-family:'Archivo Black'; font-size:15px; }
      .opt-BRUT-1 .b1-seat{ font-family:'IBM Plex Mono'; font-size:11px; }
      .opt-BRUT-1 .b1-tag{ font-size:9px; letter-spacing:.12em; padding:3px 6px; border:1px solid #0A0A0A; }
      .opt-BRUT-1 .b1-tag.red{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-1 .b1-dot{ width:11px; height:11px; border:2px solid #0A0A0A; }
      .opt-BRUT-1 .b1-dot.on{ background:#0A0A0A; }
      .opt-BRUT-1 .b1-quote{ border-left:6px solid #E61919; padding:8px 0 8px 14px; margin:10px 0; }
      .opt-BRUT-1 .b1-quote em{ font-family:'Playfair Display',serif; font-style:italic; font-size:26px; line-height:1.1; }
      .opt-BRUT-1 .b1-serif{ font-family:'Playfair Display',serif; }
      .opt-BRUT-1 .b1-poem b{ display:block; font-family:'Playfair Display',serif; font-size:23px; line-height:1.15; }
      .opt-BRUT-1 .b1-poem span{ font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:#0A0A0A; }
      .opt-BRUT-1 .b1-poem li{ list-style:none; padding:10px 0; border-bottom:1px solid rgba(10,10,10,.2); }
      .opt-BRUT-1 .b1-poem li:last-child{ border-bottom:0; }
      .opt-BRUT-1 .b1-poem ol{ padding:0; margin:0; }
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
              <button class="b1-btn alt" style="justify-content:center">+ ADD BASHŌ (MACHINE HAND)</button>
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
            `<div class="b1-slot ${w[i] ? 'on' : ''}">${w[i] ? w[i].slice(0, 6).toUpperCase() : '·'}</div>`).join('');
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
              <h2 class="b1-folio" style="font-size:56px;color:#E61919;margin-top:8px">${waiting}</h2>
              <p class="b1-kick" style="margin-top:16px">THE PRESS HOLDS THE FORM UNTIL EVERY HAND SETS ITS LINE</p>
            </div>
            <div class="b1-platen">
              <button class="b1-btn alt">READ THE HOUSE RULES <span class="arw">///</span></button>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const queue = corpus.revealQueue.map((q, i) => `
          <div class="b1-row">
            <div class="b1-seat">${String(i + 1).padStart(2, '0')}</div>
            <div><b>${q.poem.toUpperCase()}</b> <span class="b1-seat">OPENS "${q.firstWord}"</span></div>
            <div><span class="b1-tag red">${q.reader.toUpperCase()} READS</span></div>
          </div>`).join('');
        const lines = corpus.poem.lines.map((l, i) => `
          <li class="b1-in" style="animation-delay:${i * 0.06}s">
            <span>${String(i + 1).padStart(2, '0')} · ${l.author}</span>
            <b>${l.text}</b>
          </li>`).join('');
        el.innerHTML = `
          <div class="b1">
            <div class="b1-grain"></div>
            <div class="b1-mast"><b>LINEJAM</b><span>[ READ ALOUD ]</span></div>
            <div class="b1-body">
              <p class="b1-kick">THE READING ORDER</p>
              <div class="b1-roster" style="margin-top:8px">${queue}</div>
              <div class="b1-rule"></div>
              <p class="b1-kick">NOW READING</p>
              <h1 class="b1-folio b1-serif" style="font-size:40px;font-family:'Playfair Display';font-style:italic;text-transform:none;letter-spacing:0">${corpus.poem.title}</h1>
              <div class="b1-poem" style="margin-top:8px"><ol>${lines}</ol></div>
            </div>
            <div class="b1-platen">
              <button class="b1-btn red">NEXT POEM <span class="arw">&gt;&gt;&gt;</span></button>
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
    move: 'One HUD chassis with crosshair corners and a fixed bottom command bar; every screen is a mission phase swapped inside the same telemetry frame.',
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
      .opt-BRUT-2 .b2-led{ display:inline-block; width:9px; height:9px; }
      .opt-BRUT-2 .b2-led.on{ background:#4AF626; box-shadow:0 0 6px #4AF626; }
      .opt-BRUT-2 .b2-led.off{ background:transparent; border:1px solid #E61919; }
      .opt-BRUT-2 .b2-pill{ font-size:9px; letter-spacing:.1em; padding:2px 5px; border:1px solid #EAEAEA; }
      .opt-BRUT-2 .b2-pill.red{ border-color:#E61919; color:#E61919; }
      .opt-BRUT-2 .b2-buf{ display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
      .opt-BRUT-2 .b2-cell{ border:1px solid #EAEAEA; height:48px; display:flex; align-items:center; justify-content:center;
        font-family:'Archivo Black'; font-size:15px; text-transform:uppercase; color:#EAEAEA; }
      .opt-BRUT-2 .b2-cell.on{ border-color:#4AF626; color:#4AF626; }
      .opt-BRUT-2 .b2-inbound{ border:1px solid #E61919; padding:12px; margin:8px 0; }
      .opt-BRUT-2 .b2-inbound b{ font-family:'Archivo Black'; font-size:22px; line-height:1.1; text-transform:uppercase; letter-spacing:-.02em; }
      .opt-BRUT-2 .b2-inp{ width:100%; background:#0A0A0A; border:1px solid #EAEAEA; color:#4AF626; font-family:'JetBrains Mono';
        font-size:15px; padding:12px; outline:none; letter-spacing:.04em; }
      .opt-BRUT-2 .b2-stream li{ list-style:none; display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:baseline;
        padding:9px 0; border-bottom:1px solid rgba(234,234,234,.22); }
      .opt-BRUT-2 .b2-stream li:last-child{ border-bottom:0; }
      .opt-BRUT-2 .b2-stream ol{ padding:0; margin:0; }
      .opt-BRUT-2 .b2-stream .call{ font-size:9px; letter-spacing:.12em; color:#E61919; text-transform:uppercase; white-space:nowrap; }
      .opt-BRUT-2 .b2-stream .txt{ font-family:'Archivo Black'; font-size:18px; line-height:1.12; text-transform:uppercase; letter-spacing:-.02em; }
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
                <button class="b2-btn ghost" style="justify-content:center">[ + ] DEPLOY AI UNIT · BASHŌ</button>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">LAUNCH SESSION <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
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
                <p class="b2-label">TX BUFFER · <span id="b2n" class="b2-red">4</span>/${g.wordsThisRound} FILLED</p>
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
            `<div class="b2-cell ${w[i] ? 'on' : ''}">${w[i] ? w[i].slice(0, 5).toUpperCase() : '_'}</div>`).join('');
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
                <p class="b2-label">AWAITING UNIT</p>
                <h2 class="b2-huge b2-red" style="font-size:60px">${waiting}</h2>
                <p class="b2-label" style="margin-top:16px">HOLDING PHASE UNTIL ALL UNITS REPORT IN</p>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn ghost">VIEW MANIFEST <span>[ ESC ]</span></button>
              </div>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const queue = corpus.revealQueue.map((q, i) => `
          <tr><td class="b2-label" style="width:26px">${String(i + 1).padStart(2, '0')}</td>
            <td><b style="font-family:'Archivo Black'">${q.poem.toUpperCase()}</b> <span class="b2-label">"${q.firstWord}"</span></td>
            <td style="text-align:right"><span class="b2-pill red">${q.reader.toUpperCase()}</span></td></tr>`).join('');
        const lines = corpus.poem.lines.map((l, i) => `
          <li class="b2-in" style="animation-delay:${i * 0.05}s">
            <span class="call">${String(i + 1).padStart(2, '0')}·${l.author}</span>
            <span class="txt">${l.text}</span></li>`).join('');
        el.innerHTML = `
          <div class="b2"><div class="b2-scan"></div>
            <div class="b2-frame">
              <i class="b2-x tl">+</i><i class="b2-x tr">+</i><i class="b2-x bl">+</i><i class="b2-x br">+</i>
              <div class="b2-strip"><span class="red">● DECRYPTED</span><span>READ ALOUD</span></div>
              <div class="b2-main">
                <p class="b2-label">// DISPATCH · READING ORDER</p>
                <table class="b2-tbl" style="margin-top:6px">${queue}</table>
                <hr class="b2-hr">
                <p class="b2-label">NOW READING · <span class="b2-red">${corpus.poem.title.toUpperCase()}</span></p>
                <div class="b2-stream" style="margin-top:8px"><ol>${lines}</ol></div>
              </div>
              <div class="b2-cmd">
                <button class="b2-btn">NEXT TRANSMISSION <span>&gt;&gt;&gt;</span></button>
              </div>
            </div>
          </div>`;
      },
    },
  };

  // ============================================================= BRUT-3
  // TICKER — INVERSION. Rejects "screens are separate pages": the whole
  // session is one continuous adding-machine tape. Every action prints a
  // new stamped block; the platen (controls) lives at the bottom in the
  // thumb zone; the reveal literally prints the poem down the tape.
  window.LANE_SPECS['BRUT-3'] = {
    lane: 'brut',
    title: 'Ticker',
    move: 'Inverts separate pages into one continuous paper tape: every action prints a stamped block, controls live at the platen in the thumb zone, and the reveal prints the poem down the strip.',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
      .opt-BRUT-3{ background:#111110; color:#0A0A0A; font-family:'Space Mono',monospace; }
      .opt-BRUT-3 *{ box-sizing:border-box; border-radius:0 !important; }
      .opt-BRUT-3 .b3{ height:100%; display:flex; flex-direction:column; }
      .opt-BRUT-3 .b3-rail{ flex:1; overflow-y:auto; display:flex; flex-direction:column; align-items:center;
        background:#111110; padding:0 18px; }
      .opt-BRUT-3 .b3-tape{ width:100%; max-width:320px; background:#F4F4F0; position:relative;
        border-left:2px dashed #111110; border-right:2px dashed #111110; padding:0; }
      .opt-BRUT-3 .b3-perf{ display:flex; justify-content:space-between; padding:6px 6px 0; }
      .opt-BRUT-3 .b3-perf i{ width:6px; height:6px; background:#111110; }
      .opt-BRUT-3 .b3-blk{ padding:14px 16px; border-bottom:1px dashed #0A0A0A; }
      .opt-BRUT-3 .b3-blk:last-child{ border-bottom:0; }
      .opt-BRUT-3 .b3-meta{ display:flex; justify-content:space-between; font-size:9px; letter-spacing:.12em;
        text-transform:uppercase; color:#0A0A0A; margin-bottom:6px; }
      .opt-BRUT-3 .b3-meta .red{ color:#E61919; font-weight:700; }
      .opt-BRUT-3 .b3-h{ font-family:'Archivo Black'; text-transform:uppercase; line-height:.9; letter-spacing:-.03em; margin:0; }
      .opt-BRUT-3 .b3-stampcode{ font-family:'Archivo Black'; font-size:clamp(76px,26vw,116px); text-align:center;
        color:#E61919; line-height:.9; letter-spacing:.04em; }
      .opt-BRUT-3 .b3-body{ font-size:14px; line-height:1.4; }
      .opt-BRUT-3 .b3-serif{ font-style:italic; }
      .opt-BRUT-3 .b3-line{ font-family:'Archivo Black'; font-size:20px; line-height:1.12; text-transform:uppercase;
        letter-spacing:-.02em; }
      .opt-BRUT-3 .b3-prev{ border-left:5px solid #E61919; padding-left:12px; }
      .opt-BRUT-3 .b3-slots{ display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
      .opt-BRUT-3 .b3-s{ border:2px solid #0A0A0A; min-width:44px; height:44px; padding:0 8px; display:flex;
        align-items:center; justify-content:center; font-family:'Archivo Block','Archivo Black'; font-weight:700; font-size:15px; text-transform:uppercase; }
      .opt-BRUT-3 .b3-s.on{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-3 .b3-mark{ font-size:9px; letter-spacing:.1em; padding:2px 6px; border:1px solid #0A0A0A; text-transform:uppercase; }
      .opt-BRUT-3 .b3-mark.red{ background:#E61919; color:#F4F4F0; border-color:#E61919; }
      .opt-BRUT-3 .b3-mark.hollow{ opacity:.45; }
      .opt-BRUT-3 .b3-crew{ display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dotted #0A0A0A; }
      .opt-BRUT-3 .b3-crew:last-child{ border-bottom:0; }
      .opt-BRUT-3 .b3-crew b{ font-family:'Archivo Black'; font-size:15px; text-transform:uppercase; }
      .opt-BRUT-3 .b3-inp{ width:100%; border:2px solid #0A0A0A; background:#fff; font-family:'Space Mono'; font-size:15px;
        padding:10px; outline:none; }
      .opt-BRUT-3 .b3-torn{ height:12px; width:100%; max-width:320px;
        background:linear-gradient(-45deg, transparent 0 6px, #F4F4F0 6px 100%),
                   linear-gradient(45deg, transparent 0 6px, #F4F4F0 6px 100%);
        background-size:12px 12px; }
      .opt-BRUT-3 .b3-platen{ background:#0A0A0A; padding:12px 16px 16px; display:grid; gap:8px; border-top:3px solid #E61919; }
      .opt-BRUT-3 .b3-plabel{ font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:#F4F4F0; opacity:.7; text-align:center; }
      .opt-BRUT-3 .b3-btn{ display:flex; align-items:center; justify-content:space-between; min-height:56px; padding:0 18px;
        border:2px solid #E61919; background:#E61919; color:#F4F4F0; font-family:'Archivo Black'; font-size:16px;
        text-transform:uppercase; letter-spacing:.01em; cursor:pointer; width:100%; }
      .opt-BRUT-3 .b3-btn.ghost{ background:transparent; color:#F4F4F0; border-color:#F4F4F0; }
      .opt-BRUT-3 .b3-byl{ font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:#E61919; margin-bottom:3px; }
      .opt-BRUT-3 .b3-feed{ animation:b3feed .5s cubic-bezier(.2,.7,.2,1) both; }
      .opt-BRUT-3 .b3-run i{ display:inline-block; animation:b3run 1.1s ease-in-out infinite; }
      @keyframes b3feed{ from{ opacity:0; transform:translateY(-14px); } to{ opacity:1; transform:none; } }
      @keyframes b3run{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(3px); } }
      @media (prefers-reduced-motion: reduce){ .opt-BRUT-3 .b3-feed{ animation:none; } .opt-BRUT-3 .b3-run i{ animation:none; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>LINEJAM PRESS</span><span class="red">ROLL 001</span></div>
                  <h1 class="b3-h" style="font-size:40px">LINE<br>JAM</h1>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>WHAT THIS IS</span><span>·</span></div>
                  <p class="b3-body">One long strip of paper. Nine writers stamp one line each. You only see the line above yours before you add the next.</p>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>FEED IN BELOW</span><span class="red">&gt;&gt;&gt;</span></div>
                  <p class="b3-body b3-serif">Read aloud when the tape runs out.</p>
                </div>
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— THE PLATEN —</div>
              <button class="b3-btn">START A GAME <span>&gt;&gt;&gt;</span></button>
              <button class="b3-btn ghost">JOIN A ROOM <span>///</span></button>
            </div>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>JOIN A ROLL</span><span class="red">FORM 02</span></div>
                  <h1 class="b3-h" style="font-size:30px">FEED YOUR<br>CODE</h1>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>ROOM CODE</span><span>4 CHAR</span></div>
                  <div class="b3-slots">
                    <div class="b3-s on">P</div><div class="b3-s on">L</div><div class="b3-s on">U</div><div class="b3-s on">M</div>
                  </div>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>YOUR PEN NAME</span><span>·</span></div>
                  <input class="b3-inp" placeholder="stamp your name" aria-label="Pen name">
                </div>
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— THE PLATEN —</div>
              <button class="b3-btn">JOIN THE ROLL <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      lobby(el, corpus) {
        const crew = corpus.players.map((p, i) => `
          <div class="b3-crew">
            <div><b>${p.name.toUpperCase()}</b> <span style="font-size:9px;letter-spacing:.12em">SEAT ${String(i + 1).padStart(2, '0')}</span></div>
            <div>
              ${p.host ? '<span class="b3-mark red">HOST</span> ' : ''}${p.kind === 'ai' ? '<span class="b3-mark">BASHŌ · AI</span> ' : ''}<span class="b3-mark ${p.present ? '' : 'hollow'}">${p.present ? 'HERE' : 'AWAY'}</span>
            </div>
          </div>`).join('');
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>SHOW THE TABLE</span><span class="red">ROLL OPEN</span></div>
                  <div class="b3-stampcode">${corpus.roomCode}</div>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>CREW ON THE ROLL</span><span>${corpus.players.length} STAMPED</span></div>
                  ${crew}
                </div>
                <div class="b3-blk b3-feed">
                  <div class="b3-meta"><span>NEED ANOTHER HAND?</span><span class="red">+</span></div>
                  <button class="b3-inp" style="cursor:pointer;font-family:'Archivo Black';text-transform:uppercase">+ STAMP IN BASHŌ</button>
                </div>
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— HOST HOLDS THE PLATEN —</div>
              <button class="b3-btn">ROLL THE PRESS <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>ROUND ${String(g.round).padStart(2, '0')} / ${g.totalRounds}</span><span class="red">${g.wordsThisRound} WORDS ONLY</span></div>
                  <div class="b3-byl">LAST STAMP ON THE ROLL</div>
                  <p class="b3-line b3-prev">${g.previousLine}</p>
                </div>
                <div class="b3-blk b3-feed">
                  <div class="b3-meta"><span>YOUR STAMP</span><span><span id="b3n" class="red">4</span>/${g.wordsThisRound}</span></div>
                  <div class="b3-slots" id="b3slots"></div>
                  <input class="b3-inp" id="b3inp" value="${g.draft}" aria-label="Your line" style="margin-top:8px">
                </div>
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— STAMP IT ONTO THE ROLL —</div>
              <button class="b3-btn" id="b3sub">FEED THE LINE <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
        const N = g.wordsThisRound;
        const slots = el.querySelector('#b3slots');
        const nEl = el.querySelector('#b3n');
        const inp = el.querySelector('#b3inp');
        const render = () => {
          const w = inp.value.trim().split(/\s+/).filter(Boolean).slice(0, N);
          slots.innerHTML = Array.from({ length: N }, (_, i) =>
            `<div class="b3-s ${w[i] ? 'on' : ''}">${w[i] ? w[i].toUpperCase() : '·'}</div>`).join('');
          nEl.textContent = String(w.length);
        };
        inp.addEventListener('input', render);
        render();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn.join(', ').toUpperCase();
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk b3-feed">
                  <div class="b3-meta"><span>YOUR LINE</span><span class="red">STAMPED ✓</span></div>
                  <p class="b3-line">and nobody asks it why</p>
                </div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>THE ROLL WAITS ON</span><span class="b3-run"><i>▼</i></span></div>
                  <h1 class="b3-h" style="font-size:56px;color:#E61919">${waiting}</h1>
                  <p class="b3-body" style="margin-top:8px">Still setting a line. The tape holds until every hand stamps in.</p>
                </div>
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— HOLD TIGHT · PARTY'S STILL ON —</div>
              <button class="b3-btn ghost">PEEK AT THE CREW <span>///</span></button>
            </div>
          </div>`;
      },
      reveal(el, corpus) {
        const queue = corpus.revealQueue.map((q, i) => `
          <div class="b3-crew">
            <div><b>${q.poem.toUpperCase()}</b> <span style="font-size:9px;letter-spacing:.1em">"${q.firstWord}"</span></div>
            <div><span class="b3-mark red">${q.reader.toUpperCase()} READS</span></div>
          </div>`).join('');
        const lines = corpus.poem.lines.map((l, i) => `
          <div class="b3-blk b3-feed" style="animation-delay:${i * 0.07}s">
            <div class="b3-byl">${String(i + 1).padStart(2, '0')} · ${l.author}</div>
            <p class="b3-line">${l.text}</p>
          </div>`).join('');
        el.innerHTML = `
          <div class="b3">
            <div class="b3-rail">
              <div class="b3-tape">
                <div class="b3-perf"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                <div class="b3-blk">
                  <div class="b3-meta"><span>THE ROLL RUNS OUT</span><span class="red">READ ALOUD</span></div>
                  <h1 class="b3-h" style="font-size:26px">READING<br>ORDER</h1>
                  <div style="margin-top:10px">${queue}</div>
                </div>
                <div class="b3-blk" style="background:#E61919;color:#F4F4F0">
                  <div class="b3-meta" style="color:#F4F4F0"><span>NOW PRINTING</span><span>${corpus.poem.title.toUpperCase()}</span></div>
                  <p class="b3-body b3-serif" style="font-size:16px">Read it down the tape, one line at a time.</p>
                </div>
                ${lines}
              </div>
              <div class="b3-torn"></div>
            </div>
            <div class="b3-platen">
              <div class="b3-plabel">— ${corpus.poem.title.toUpperCase()} · ${corpus.poem.lines.length} LINES —</div>
              <button class="b3-btn">TEAR OFF · NEXT POEM <span>&gt;&gt;&gt;</span></button>
            </div>
          </div>`;
      },
    },
  };
})();
