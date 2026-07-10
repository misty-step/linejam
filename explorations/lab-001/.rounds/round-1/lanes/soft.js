// Lane: soft — high-end agency / luxe systems for Linejam.
// Three coherent systems, each applied across all 6 screens.
// SOFT-1 Atelier (warm editorial trays) · SOFT-2 Onsen (spatial structuralism, inverts lobby+input)
// · SOFT-3 Vellum (warm-ink dark ceremony, inverts the reveal).
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // small shared helper: count words in a raw string
  function words(s) {
    return (s || '').trim().split(/\s+/).filter(Boolean);
  }

  /* ============================================================ SOFT-1 ===== */
  window.LANE_SPECS['SOFT-1'] = {
    lane: 'soft',
    title: 'Atelier',
    move: 'Every surface is a machined tray: a hairline outer shell holds an inner core with concentric radii, so each card reads as a physical object, never a flat rectangle.',
    css: `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Instrument+Sans:wght@400;500;600&display=swap');

    .opt-SOFT-1 { --paper:#FBF7F0; --paper-2:#F4EDE1; --ink:#211C17; --soft:#6D655B;
      --line:#E4D9C8; --seal:#B4462E; --sage:#7C8570;
      background:var(--paper); color:var(--ink);
      font-family:'Instrument Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
      display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-1 .stage { display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-1 .body { flex:1; overflow-y:auto; padding:28px 22px 8px; }
    .opt-SOFT-1 .dock { padding:14px 22px 26px; background:linear-gradient(0deg,var(--paper) 68%,transparent); }
    .opt-SOFT-1 .eyebrow { font-size:10px; letter-spacing:.28em; text-transform:uppercase; color:var(--soft); font-weight:600; }
    .opt-SOFT-1 .serif { font-family:'Fraunces',Georgia,serif; }

    /* machined tray (double bezel) */
    .opt-SOFT-1 .tray { background:var(--paper-2); border:1px solid var(--line); border-radius:26px; padding:6px;
      box-shadow:0 22px 46px -30px rgba(60,44,26,.5); }
    .opt-SOFT-1 .tray-core { background:var(--paper); border-radius:20px; padding:20px;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.7); }

    /* island CTA with nested icon */
    .opt-SOFT-1 .cta { width:100%; border:none; cursor:pointer; border-radius:999px; padding:16px 20px 16px 24px;
      background:var(--seal); color:#FCEFE9; font:600 16px 'Instrument Sans',sans-serif;
      display:flex; align-items:center; justify-content:space-between;
      box-shadow:0 16px 34px -16px rgba(180,70,46,.75);
      transition:transform .5s cubic-bezier(.32,.72,0,1), box-shadow .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-1 .cta:active { transform:scale(.978); }
    .opt-SOFT-1 .cta .knob { width:34px; height:34px; border-radius:999px; background:rgba(252,239,233,.16);
      display:flex; align-items:center; justify-content:center; font-size:16px;
      transition:transform .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-1 .cta:hover .knob { transform:translate(3px,-2px); }
    .opt-SOFT-1 .ghost { width:100%; border:1px solid var(--line); background:transparent; color:var(--ink);
      border-radius:999px; padding:15px 22px; font:500 15px 'Instrument Sans',sans-serif; cursor:pointer; margin-top:10px;
      transition:background .4s ease, transform .4s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-1 .ghost:active { transform:scale(.98); }
    .opt-SOFT-1 .ghost:hover { background:var(--paper-2); }

    /* home */
    .opt-SOFT-1 .wm { font-size:60px; line-height:.94; font-weight:400; font-variation-settings:'opsz' 120; letter-spacing:-.02em; margin:14px 0 12px; }
    .opt-SOFT-1 .wm em { font-style:italic; color:var(--seal); }
    .opt-SOFT-1 .lede { font-size:18px; line-height:1.45; color:var(--soft); max-width:20ch; }
    .opt-SOFT-1 .ribbon { display:flex; gap:7px; align-items:baseline; margin-top:26px; flex-wrap:wrap; }
    .opt-SOFT-1 .ribbon span { font-family:'Fraunces',serif; color:var(--sage); font-size:15px; }
    .opt-SOFT-1 .ribbon b { color:var(--seal); font-weight:500; font-size:19px; }

    /* inputs */
    .opt-SOFT-1 label.fl { display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--soft); margin:0 0 8px 2px; }
    .opt-SOFT-1 .codeboxes { display:flex; gap:10px; }
    .opt-SOFT-1 .codeboxes input { flex:1; text-align:center; font-family:'Fraunces',serif; font-size:30px; color:var(--ink);
      background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:14px 0; outline:none;
      transition:border-color .3s ease, box-shadow .3s ease; }
    .opt-SOFT-1 .codeboxes input:focus { border-color:var(--seal); box-shadow:0 0 0 3px rgba(180,70,46,.12); }
    .opt-SOFT-1 .field { width:100%; background:var(--paper); border:1px solid var(--line); border-radius:16px;
      padding:15px 16px; font:400 17px 'Instrument Sans',sans-serif; color:var(--ink); outline:none; margin-top:16px;
      transition:border-color .3s ease, box-shadow .3s ease; }
    .opt-SOFT-1 .field:focus { border-color:var(--seal); box-shadow:0 0 0 3px rgba(180,70,46,.12); }

    /* lobby */
    .opt-SOFT-1 .bigcode { font-family:'Fraunces',serif; font-size:66px; letter-spacing:.16em; text-align:center; color:var(--ink); font-weight:500; }
    .opt-SOFT-1 .seat { display:flex; align-items:center; gap:13px; padding:13px 4px; border-bottom:1px solid var(--line); }
    .opt-SOFT-1 .seat:last-child { border-bottom:none; }
    .opt-SOFT-1 .dot { width:9px; height:9px; border-radius:999px; background:var(--sage); flex:none; }
    .opt-SOFT-1 .dot.off { background:#CDBFA9; }
    .opt-SOFT-1 .seat .nm { font-size:17px; font-weight:500; }
    .opt-SOFT-1 .tag { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); border:1px solid var(--line); padding:3px 8px; border-radius:999px; }
    .opt-SOFT-1 .tag.host { color:var(--seal); border-color:rgba(180,70,46,.35); }
    .opt-SOFT-1 .tag.ai { color:var(--sage); border-color:rgba(124,133,112,.4); }
    .opt-SOFT-1 .addbot { display:flex; align-items:center; gap:10px; margin-top:14px; padding:13px 16px; border:1px dashed var(--line); border-radius:16px; color:var(--soft); font-size:15px; cursor:pointer; background:transparent; width:100%; transition:border-color .3s ease; }
    .opt-SOFT-1 .addbot:hover { border-color:var(--sage); }

    /* write */
    .opt-SOFT-1 .rounds { display:flex; gap:5px; margin-top:12px; }
    .opt-SOFT-1 .rounds i { flex:1; height:4px; border-radius:9px; background:var(--line); }
    .opt-SOFT-1 .rounds i.done { background:var(--sage); }
    .opt-SOFT-1 .rounds i.now { background:var(--seal); }
    .opt-SOFT-1 .prev { font-family:'Fraunces',serif; font-style:italic; font-size:24px; line-height:1.35; color:var(--ink); }
    .opt-SOFT-1 .prevcap { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); margin-bottom:9px; }
    .opt-SOFT-1 .slots { display:flex; gap:9px; margin:2px 0 14px; }
    .opt-SOFT-1 .slots i { flex:1; height:3px; border-radius:9px; background:var(--line); transition:background .45s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-1 .slots i.filled { background:var(--seal); }
    .opt-SOFT-1 .counter { font-family:'Fraunces',serif; font-size:15px; color:var(--soft); }
    .opt-SOFT-1 .counter b { color:var(--ink); }
    .opt-SOFT-1 textarea.line { width:100%; border:none; outline:none; resize:none; background:transparent;
      font-family:'Fraunces',serif; font-size:26px; line-height:1.4; color:var(--ink); min-height:74px; }
    .opt-SOFT-1 textarea.line::placeholder { color:#CBBEA9; }

    /* wait + reveal */
    .opt-SOFT-1 .stamp { width:64px; height:64px; border-radius:999px; background:var(--seal); color:#FCEFE9;
      display:flex; align-items:center; justify-content:center; font-family:'Fraunces',serif; font-size:26px; margin:6px auto 0;
      animation:s1pop .7s cubic-bezier(.32,.72,0,1) both; }
    @keyframes s1pop { from{ transform:scale(.6); opacity:0 } to{ transform:scale(1); opacity:1 } }
    .opt-SOFT-1 .whotitle { font-family:'Fraunces',serif; font-size:26px; text-align:center; margin-top:16px; }
    .opt-SOFT-1 .qrow { display:flex; align-items:center; justify-content:space-between; padding:12px 2px; border-bottom:1px solid var(--line); }
    .opt-SOFT-1 .reader { font-size:13px; color:var(--soft); }
    .opt-SOFT-1 .reader b { color:var(--seal); font-weight:600; }
    .opt-SOFT-1 .poemline { font-family:'Fraunces',serif; color:var(--ink); line-height:1.28;
      animation:s1rise .7s cubic-bezier(.32,.72,0,1) both; }
    @keyframes s1rise { from{ opacity:0; transform:translateY(14px) } to{ opacity:1; transform:translateY(0) } }
    .opt-SOFT-1 .by { display:block; font-family:'Instrument Sans',sans-serif; font-style:normal; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--soft); margin-top:3px; }

    @media (prefers-reduced-motion: reduce) {
      .opt-SOFT-1 *, .opt-SOFT-1 .cta, .opt-SOFT-1 .knob { animation:none !important; transition:none !important; }
      .opt-SOFT-1 .poemline, .opt-SOFT-1 .stamp { opacity:1 !important; transform:none !important; }
    }`,
    screens: {
      home(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">A parlour game for friends</p>
          <h1 class="wm serif">Line<em>jam</em></h1>
          <p class="lede">Write a poem together. You only ever see the line before yours.</p>
          <div class="tray" style="margin-top:26px"><div class="tray-core">
            <p class="eyebrow" style="margin-bottom:10px">Nine lines, this shape</p>
            <div class="ribbon"><b>1</b><span>2</span><span>3</span><span>4</span><b>5</b><span>4</span><span>3</span><span>2</span><b>1</b></div>
          </div></div>
        </div><div class="dock">
          <button class="cta">Start a game <span class="knob">&#8599;</span></button>
          <button class="ghost">Join a room</button>
        </div></div>`;
      },
      join(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">Join a room</p>
          <h2 class="wm serif" style="font-size:38px;margin:10px 0 24px">Take a seat<br>at the table</h2>
          <label class="fl">Room code</label>
          <div class="codeboxes"><input maxlength="1" placeholder="P"><input maxlength="1" placeholder="L"><input maxlength="1" placeholder="U"><input maxlength="1" placeholder="M"></div>
          <label class="fl" style="margin-top:22px">Your pen name</label>
          <input class="field" placeholder="What should we call you">
        </div><div class="dock">
          <button class="cta">Join the table <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
      lobby(el, corpus) {
        const seats = corpus.players.map((p) => `
          <div class="seat">
            <span class="dot ${p.present ? '' : 'off'}"></span>
            <span class="nm">${p.name}</span>
            ${p.host ? '<span class="tag host">Host</span>' : ''}
            ${p.kind === 'ai' ? '<span class="tag ai">Bashō · bot</span>' : ''}
            ${!p.present ? '<span class="tag" style="margin-left:auto">away</span>' : ''}
          </div>`).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow" style="text-align:center">Share this code</p>
          <div class="tray" style="margin:12px 0 8px"><div class="tray-core" style="padding:26px 20px">
            <div class="bigcode">${corpus.roomCode}</div>
            <p style="text-align:center;color:var(--soft);font-size:13px;margin-top:10px">Friends across the table type this in</p>
          </div></div>
          <div class="tray"><div class="tray-core" style="padding:8px 18px">${seats}</div></div>
          <button class="addbot">＋ Add a poet bot</button>
        </div><div class="dock">
          <button class="cta">Start the game <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const bars = corpus.wordCounts.map((_, i) => `<i class="${i < g.round - 1 ? 'done' : i === g.round - 1 ? 'now' : ''}"></i>`).join('');
        const slots = Array.from({ length: g.wordsThisRound }).map(() => '<i></i>').join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">Round ${g.round} of ${g.totalRounds}</p>
          <div class="rounds">${bars}</div>
          <div class="tray" style="margin:22px 0 20px"><div class="tray-core">
            <p class="prevcap">The line before you</p>
            <p class="prev">${g.previousLine}</p>
          </div></div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <label class="fl" style="margin:0">Your line · ${g.wordsThisRound} words</label>
            <span class="counter"><b id="s1c">0</b> / ${g.wordsThisRound}</span>
          </div>
          <div class="slots" id="s1slots">${slots}</div>
          <div class="tray"><div class="tray-core">
            <textarea class="line" id="s1in" placeholder="Add exactly ${g.wordsThisRound} words">${g.draft}</textarea>
          </div></div>
        </div><div class="dock">
          <button class="cta">Pass it on <span class="knob">&#8599;</span></button>
        </div></div>`;
        const ta = el.querySelector('#s1in'); const cnt = el.querySelector('#s1c');
        const bs = el.querySelectorAll('#s1slots i'); const max = g.wordsThisRound;
        const paint = () => {
          const n = words(ta.value).length; cnt.textContent = Math.min(n, max);
          bs.forEach((b, i) => b.classList.toggle('filled', i < Math.min(n, max)));
          cnt.parentElement.style.color = n > max ? 'var(--seal)' : '';
        };
        ta.addEventListener('input', paint); paint();
      },
      wait(el, corpus) {
        const done = corpus.players.filter((p) => p.present && p.name !== 'Theo');
        const rows = done.map((p) => `<div class="seat"><span class="dot"></span><span class="nm">${p.name}</span><span class="tag" style="margin-left:auto">in</span></div>`).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <div class="stamp serif">✓</div>
          <h2 class="whotitle serif">Line sent.<br>The poem moves on.</h2>
          <p style="text-align:center;color:var(--soft);font-size:15px;margin-top:8px">Waiting on <b style="color:var(--seal)">Theo</b> to finish round ${corpus.game.round}.</p>
          <div class="tray" style="margin-top:26px"><div class="tray-core" style="padding:8px 18px">
            ${rows}
            <div class="seat"><span class="dot" style="background:var(--seal);animation:s1pulse 1.4s ease-in-out infinite"></span><span class="nm">Theo</span><span class="tag host" style="margin-left:auto">writing</span></div>
          </div></div>
          <style>@keyframes s1pulse{0%,100%{opacity:.35}50%{opacity:1}}@media (prefers-reduced-motion:reduce){.opt-SOFT-1 .dot{animation:none!important}}</style>
        </div><div class="dock">
          <button class="ghost">Give Theo a friendly nudge</button>
        </div></div>`;
      },
      reveal(el, corpus) {
        const q = corpus.revealQueue.map((r, i) => `
          <div class="qrow">
            <div><div class="nm serif" style="font-size:20px">${r.poem}</div><div class="reader">opens with &ldquo;${r.firstWord}&rdquo;</div></div>
            <div class="reader" style="text-align:right">read by<br><b>${r.reader}</b></div>
          </div>`).join('');
        const lines = corpus.poem.lines.map((l, i) => {
          const sz = [30, 28, 26, 24, 26, 24, 26, 28, 32][i] || 26;
          return `<p class="poemline" style="font-size:${sz}px;margin-top:${i ? 16 : 0}px;animation-delay:${i * 0.09}s">${l.text}<span class="by">${l.author}</span></p>`;
        }).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">The reading</p>
          <h2 class="wm serif" style="font-size:34px;margin:8px 0 18px">Read them<br>out loud</h2>
          <div class="tray" style="margin-bottom:22px"><div class="tray-core" style="padding:6px 18px">${q}</div></div>
          <div class="tray"><div class="tray-core" style="padding:26px 22px">
            <p class="prevcap" style="text-align:center">${corpus.poem.title}</p>
            ${lines}
          </div></div>
          <div style="height:14px"></div>
        </div><div class="dock">
          <button class="cta">Next poem <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
    },
  };

  /* ============================================================ SOFT-2 ===== */
  // Inverts two load-bearing assumptions: the lobby is a LIST (-> a round table
  // seating map) and the write input is a TEXT FIELD (-> discrete word slots you
  // fill one tap at a time, so the 5-word constraint is physical, not counted).
  window.LANE_SPECS['SOFT-2'] = {
    lane: 'soft',
    title: 'Onsen',
    move: 'Structure over chrome: one oversized grotesk scale plus spatial models (a seating ring, physical word-slots) replace lists and text fields, so a screen reads as a room, not a form.',
    css: `
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600&display=swap');

    .opt-SOFT-2 { --bg:#ECEEEF; --card:#FFFFFF; --ink:#16181B; --soft:#6A7076; --line:#DDE1E3; --pop:#2233E6; --pop-2:#EAECFE;
      background:radial-gradient(120% 90% at 50% -10%, #F6F7F8 0%, var(--bg) 60%); color:var(--ink);
      font-family:'Hanken Grotesk',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
      display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-2 .stage { display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-2 .body { flex:1; overflow-y:auto; padding:26px 20px 8px; }
    .opt-SOFT-2 .dock { padding:14px 20px 26px; }
    .opt-SOFT-2 .disp { font-family:'Bricolage Grotesque',system-ui,sans-serif; font-weight:700; letter-spacing:-.03em; line-height:.92; }
    .opt-SOFT-2 .kicker { font-size:11px; font-weight:600; letter-spacing:.02em; color:var(--pop); text-transform:uppercase; }

    /* soft floating card (structural, minimal chrome) */
    .opt-SOFT-2 .float { background:var(--card); border-radius:24px; box-shadow:0 30px 50px -34px rgba(22,24,27,.4), 0 2px 6px -3px rgba(22,24,27,.12); }

    .opt-SOFT-2 .cta { width:100%; border:none; cursor:pointer; border-radius:20px; padding:18px 22px;
      background:var(--pop); color:#fff; font:600 17px 'Hanken Grotesk',sans-serif;
      display:flex; align-items:center; justify-content:space-between;
      box-shadow:0 20px 36px -18px rgba(34,51,230,.7);
      transition:transform .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-2 .cta:active { transform:scale(.975); }
    .opt-SOFT-2 .cta .knob { width:32px; height:32px; border-radius:10px; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; transition:transform .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-2 .cta:hover .knob { transform:translateX(3px); }
    .opt-SOFT-2 .ghost { width:100%; border:1.5px solid var(--line); background:var(--card); color:var(--ink);
      border-radius:20px; padding:16px 22px; font:600 16px 'Hanken Grotesk',sans-serif; cursor:pointer; margin-top:10px;
      transition:transform .4s cubic-bezier(.32,.72,0,1), border-color .3s ease; }
    .opt-SOFT-2 .ghost:active { transform:scale(.98); }
    .opt-SOFT-2 .ghost:hover { border-color:var(--pop); }

    /* home */
    .opt-SOFT-2 .hero { font-size:72px; margin:16px 0 0; }
    .opt-SOFT-2 .hero span { color:var(--pop); }
    .opt-SOFT-2 .lede { font-size:19px; line-height:1.4; color:var(--soft); margin-top:18px; max-width:22ch; }
    .opt-SOFT-2 .shape { display:flex; gap:6px; align-items:flex-end; height:44px; margin-top:26px; }
    .opt-SOFT-2 .shape i { flex:1; background:var(--pop-2); border-radius:6px 6px 3px 3px; }

    /* join */
    .opt-SOFT-2 .codeboxes { display:flex; gap:10px; margin-top:12px; }
    .opt-SOFT-2 .codeboxes input { flex:1; text-align:center; font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:34px; color:var(--ink);
      background:var(--card); border:1.5px solid var(--line); border-radius:18px; padding:16px 0; outline:none; transition:border-color .3s, box-shadow .3s; }
    .opt-SOFT-2 .codeboxes input:focus { border-color:var(--pop); box-shadow:0 0 0 4px var(--pop-2); }
    .opt-SOFT-2 .field { width:100%; background:var(--card); border:1.5px solid var(--line); border-radius:18px; padding:17px 18px; font:500 17px 'Hanken Grotesk',sans-serif; color:var(--ink); outline:none; margin-top:14px; transition:border-color .3s, box-shadow .3s; }
    .opt-SOFT-2 .field:focus { border-color:var(--pop); box-shadow:0 0 0 4px var(--pop-2); }
    .opt-SOFT-2 .flabel { font-size:12px; font-weight:600; letter-spacing:.02em; color:var(--soft); text-transform:uppercase; margin:22px 0 0 2px; }

    /* lobby — the round table (inverted from a list) */
    .opt-SOFT-2 .table { position:relative; width:286px; height:286px; margin:10px auto 0; }
    .opt-SOFT-2 .felt { position:absolute; inset:44px; border-radius:999px; background:var(--card);
      box-shadow:0 30px 50px -30px rgba(22,24,27,.4), inset 0 0 0 1px var(--line); display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .opt-SOFT-2 .felt .code { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:52px; letter-spacing:.06em; color:var(--ink); }
    .opt-SOFT-2 .felt .cap { font-size:11px; color:var(--soft); text-transform:uppercase; letter-spacing:.08em; margin-top:4px; }
    .opt-SOFT-2 .chair { position:absolute; width:74px; text-align:center; left:50%; top:50%; }
    .opt-SOFT-2 .av { width:46px; height:46px; border-radius:999px; margin:0 auto 5px; display:flex; align-items:center; justify-content:center;
      font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:18px; color:#fff; border:2.5px solid var(--card); box-shadow:0 8px 16px -8px rgba(0,0,0,.4); }
    .opt-SOFT-2 .av.away { opacity:.4; }
    .opt-SOFT-2 .chair .nm { font-size:12px; font-weight:600; }
    .opt-SOFT-2 .chair .rl { font-size:9px; color:var(--soft); text-transform:uppercase; letter-spacing:.06em; }
    .opt-SOFT-2 .chair .rl.host { color:var(--pop); }
    .opt-SOFT-2 .addbot { display:flex; align-items:center; justify-content:center; gap:8px; margin:18px auto 0; padding:14px 20px; border:1.5px dashed var(--line); border-radius:18px; color:var(--soft); font-weight:600; font-size:15px; cursor:pointer; background:transparent; width:100%; transition:border-color .3s; }
    .opt-SOFT-2 .addbot:hover { border-color:var(--pop); }

    /* write — physical word slots (inverted from a text field) */
    .opt-SOFT-2 .rlabel { font-size:13px; font-weight:600; color:var(--soft); }
    .opt-SOFT-2 .prevcard { padding:22px; margin:16px 0 22px; }
    .opt-SOFT-2 .prevk { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--pop); }
    .opt-SOFT-2 .prevt { font-family:'Bricolage Grotesque',sans-serif; font-weight:600; font-size:27px; line-height:1.25; margin-top:8px; letter-spacing:-.02em; }
    .opt-SOFT-2 .wordslots { display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 4px; }
    .opt-SOFT-2 .ws { flex:1 1 0; min-width:52px; min-height:52px; border-radius:14px; border:2px dashed var(--line);
      display:flex; align-items:center; justify-content:center; font-family:'Bricolage Grotesque',sans-serif; font-weight:600; font-size:16px; color:var(--ink);
      background:var(--card); transition:border-color .4s cubic-bezier(.32,.72,0,1), background .4s, transform .4s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-2 .ws.full { border-style:solid; border-color:var(--pop); background:var(--pop-2); transform:translateY(-2px); }
    .opt-SOFT-2 .ws.cursor { border-color:var(--pop); }
    .opt-SOFT-2 .wc { text-align:center; font-size:13px; color:var(--soft); margin-top:14px; }
    .opt-SOFT-2 .wc b { color:var(--pop); font-family:'Bricolage Grotesque',sans-serif; }
    .opt-SOFT-2 .wsin { width:100%; margin-top:14px; background:var(--card); border:1.5px solid var(--line); border-radius:16px; padding:14px 16px; font:500 17px 'Hanken Grotesk',sans-serif; color:var(--ink); outline:none; transition:border-color .3s, box-shadow .3s; }
    .opt-SOFT-2 .wsin:focus { border-color:var(--pop); box-shadow:0 0 0 4px var(--pop-2); }

    /* wait */
    .opt-SOFT-2 .big2 { font-size:46px; margin-top:20px; }
    .opt-SOFT-2 .prog { display:flex; align-items:center; gap:12px; padding:18px; margin-top:24px; }
    .opt-SOFT-2 .prog .av { margin:0; }
    .opt-SOFT-2 .writing { display:inline-flex; gap:4px; margin-left:auto; }
    .opt-SOFT-2 .writing i { width:6px; height:6px; border-radius:999px; background:var(--pop); animation:s2b 1.2s ease-in-out infinite; }
    .opt-SOFT-2 .writing i:nth-child(2){ animation-delay:.2s } .opt-SOFT-2 .writing i:nth-child(3){ animation-delay:.4s }
    @keyframes s2b { 0%,100%{ transform:translateY(0); opacity:.4 } 50%{ transform:translateY(-5px); opacity:1 } }

    /* reveal */
    .opt-SOFT-2 .qrail { display:flex; gap:12px; overflow-x:auto; padding:4px 0 10px; margin:4px -20px 20px; padding-left:20px; }
    .opt-SOFT-2 .qcard { flex:none; width:150px; padding:16px; }
    .opt-SOFT-2 .qcard .pn { font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:18px; }
    .opt-SOFT-2 .qcard .rd { font-size:12px; color:var(--soft); margin-top:6px; }
    .opt-SOFT-2 .qcard .rd b { color:var(--pop); }
    .opt-SOFT-2 .stack { padding:24px 22px; }
    .opt-SOFT-2 .pl { animation:s2rise .6s cubic-bezier(.32,.72,0,1) both; }
    .opt-SOFT-2 .pl .t { font-family:'Bricolage Grotesque',sans-serif; font-weight:600; letter-spacing:-.02em; line-height:1.2; }
    .opt-SOFT-2 .pl .a { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--soft); margin-top:2px; }
    @keyframes s2rise { from{ opacity:0; transform:translateY(12px) } to{ opacity:1; transform:translateY(0) } }

    @media (prefers-reduced-motion: reduce) {
      .opt-SOFT-2 * { animation:none !important; transition:none !important; }
      .opt-SOFT-2 .pl { opacity:1 !important; transform:none !important; }
    }`,
    screens: {
      home(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="kicker">Poetry party · phones in hand</p>
          <h1 class="hero disp">Line<span>jam</span></h1>
          <p class="lede">Nine rounds. Strict word counts. You only see the line before yours.</p>
          <div class="float" style="padding:20px;margin-top:26px">
            <p class="kicker" style="margin-bottom:10px">The rhythm</p>
            <div class="shape">
              ${[1, 2, 3, 4, 5, 4, 3, 2, 1].map((n) => `<i style="height:${n * 18}%"></i>`).join('')}
            </div>
          </div>
        </div><div class="dock">
          <button class="cta">Start a game <span class="knob">&#8594;</span></button>
          <button class="ghost">Join a room</button>
        </div></div>`;
      },
      join(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="kicker">Join a room</p>
          <h2 class="disp" style="font-size:44px;margin:14px 0 8px">Punch in<br>the code.</h2>
          <p class="flabel">Room code</p>
          <div class="codeboxes"><input maxlength="1" placeholder="P"><input maxlength="1" placeholder="L"><input maxlength="1" placeholder="U"><input maxlength="1" placeholder="M"></div>
          <p class="flabel">Your name</p>
          <input class="field" placeholder="Pick a pen name">
        </div><div class="dock">
          <button class="cta">Join the room <span class="knob">&#8594;</span></button>
        </div></div>`;
      },
      lobby(el, corpus) {
        const colors = { Maya: '#2233E6', Theo: '#0F9D8C', Sam: '#9AA0A6', 'Bashō': '#111318' };
        const n = corpus.players.length;
        const chairs = corpus.players.map((p, i) => {
          const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
          const r = 118;
          const x = 143 + r * Math.cos(ang) - 37;
          const y = 143 + r * Math.sin(ang) - 37;
          const initial = p.kind === 'ai' ? 'B' : p.name[0];
          return `<div class="chair" style="left:${x}px;top:${y}px">
            <div class="av ${p.present ? '' : 'away'}" style="background:${colors[p.name] || '#333'}">${initial}</div>
            <div class="nm">${p.name}</div>
            <div class="rl ${p.host ? 'host' : ''}">${p.host ? 'Host' : p.kind === 'ai' ? 'Bot' : p.present ? 'Here' : 'Away'}</div>
          </div>`;
        }).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="kicker" style="text-align:center">Everyone at the table</p>
          <div class="table">
            <div class="felt"><div class="code">${corpus.roomCode}</div><div class="cap">say it out loud</div></div>
            ${chairs}
          </div>
          <button class="addbot">＋ Seat a poet bot</button>
        </div><div class="dock">
          <button class="cta">Start the game <span class="knob">&#8594;</span></button>
        </div></div>`;
      },
      write(el, corpus) {
        const g = corpus.game; const max = g.wordsThisRound;
        const slots = Array.from({ length: max }).map((_, i) => `<div class="ws" data-i="${i}"></div>`).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="kicker">Round ${g.round} / ${g.totalRounds}</span>
            <span class="rlabel">${max} words, no more</span>
          </div>
          <div class="float prevcard">
            <p class="prevk">Only clue you get</p>
            <p class="prevt">${g.previousLine}</p>
          </div>
          <div class="wordslots" id="s2slots">${slots}</div>
          <p class="wc"><b id="s2n">0</b> of ${max} slots filled</p>
          <input class="wsin" id="s2in" placeholder="Type your ${max} words" value="${g.draft}">
        </div><div class="dock">
          <button class="cta">Send it round <span class="knob">&#8594;</span></button>
        </div></div>`;
        const inp = el.querySelector('#s2in'); const num = el.querySelector('#s2n');
        const ws = el.querySelectorAll('#s2slots .ws');
        const paint = () => {
          const w = words(inp.value);
          num.textContent = Math.min(w.length, max);
          ws.forEach((s, i) => {
            s.classList.toggle('full', i < w.length && i < max);
            s.classList.toggle('cursor', i === w.length && i < max);
            s.textContent = i < w.length ? w[i] : '';
          });
        };
        inp.addEventListener('input', paint); paint();
      },
      wait(el, corpus) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="kicker">You're done for this round</p>
          <h2 class="big2 disp">Nice.<br>It's moving.</h2>
          <p class="lede" style="margin-top:14px">Your line is off to the next poem. One poet left before round ${g_round(corpus)} closes.</p>
          <div class="float prog">
            <div class="av" style="background:#0F9D8C">T</div>
            <div><div style="font-weight:600">Theo</div><div style="font-size:12px;color:var(--soft)">still writing</div></div>
            <div class="writing"><i></i><i></i><i></i></div>
          </div>
        </div><div class="dock">
          <button class="ghost">Send Theo a poke</button>
        </div></div>`;
        function g_round(c) { return c.game.round; }
      },
      reveal(el, corpus) {
        const q = corpus.revealQueue.map((r) => `
          <div class="float qcard"><div class="pn">${r.poem}</div>
          <div class="rd">first word &ldquo;${r.firstWord}&rdquo;</div>
          <div class="rd" style="margin-top:8px">read by <b>${r.reader}</b></div></div>`).join('');
        const lines = corpus.poem.lines.map((l, i) => {
          const sz = [32, 30, 27, 25, 27, 25, 27, 30, 34][i] || 27;
          return `<div class="pl" style="margin-top:${i ? 15 : 0}px;animation-delay:${i * 0.08}s"><div class="t" style="font-size:${sz}px">${l.text}</div><div class="a">${l.author}</div></div>`;
        }).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="kicker">The reveal</p>
          <h2 class="disp" style="font-size:40px;margin:12px 0 4px">Read it<br>aloud.</h2>
          <div class="qrail">${q}</div>
          <div class="float stack">
            <p class="prevk" style="text-align:center;color:var(--pop)">${corpus.poem.title}</p>
            <div style="margin-top:12px">${lines}</div>
          </div>
          <div style="height:12px"></div>
        </div><div class="dock">
          <button class="cta">Next poem <span class="knob">&#8594;</span></button>
        </div></div>`;
      },
    },
  };

  /* ============================================================ SOFT-3 ===== */
  // Warm-ink dark system (not neon, not purple-on-black): one champagne accent
  // and a gold hairline carry the whole hierarchy. Inverts the reveal from
  // tap-per-poem into one continuous candlelit manuscript you scroll and read.
  window.LANE_SPECS['SOFT-3'] = {
    lane: 'soft',
    title: 'Vellum',
    move: 'A warm-ink dark theme where a single champagne accent and one gold hairline carry all hierarchy, and the reveal is one continuous manuscript instead of tap-per-poem.',
    css: `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Instrument+Sans:wght@400;500;600&display=swap');

    .opt-SOFT-3 { --ink:#14110C; --ink-2:#1D1912; --panel:#211C14; --cream:#F1E9D8; --soft:#A79A80; --line:#3A3123; --gold:#CBA34E; --gold-2:#E7CE93;
      background:radial-gradient(130% 80% at 50% 0%, #201B12 0%, var(--ink) 62%); color:var(--cream);
      font-family:'Instrument Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
      display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-3 .stage { display:flex; flex-direction:column; height:100%; }
    .opt-SOFT-3 .body { flex:1; overflow-y:auto; padding:28px 22px 8px; }
    .opt-SOFT-3 .dock { padding:14px 22px 26px; background:linear-gradient(0deg,var(--ink) 66%,transparent); }
    .opt-SOFT-3 .serif { font-family:'Cormorant Garamond',Georgia,serif; }
    .opt-SOFT-3 .eyebrow { font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:var(--gold); font-weight:600; }

    /* panel with gold hairline (double bezel) */
    .opt-SOFT-3 .panel { background:var(--ink-2); border-radius:24px; padding:5px; border:1px solid var(--line);
      box-shadow:0 30px 60px -34px rgba(0,0,0,.8); }
    .opt-SOFT-3 .panel-core { background:linear-gradient(180deg,var(--panel),var(--ink-2)); border-radius:19px; padding:22px;
      box-shadow:inset 0 1px 0 rgba(231,206,147,.1); }

    .opt-SOFT-3 .cta { width:100%; border:none; cursor:pointer; border-radius:999px; padding:16px 20px 16px 26px;
      background:linear-gradient(180deg,var(--gold-2),var(--gold)); color:#2A2008; font:600 16px 'Instrument Sans',sans-serif;
      display:flex; align-items:center; justify-content:space-between;
      box-shadow:0 16px 34px -16px rgba(203,163,78,.6);
      transition:transform .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-3 .cta:active { transform:scale(.978); }
    .opt-SOFT-3 .cta .knob { width:34px; height:34px; border-radius:999px; background:rgba(42,32,8,.18); display:flex; align-items:center; justify-content:center; transition:transform .5s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-3 .cta:hover .knob { transform:translate(3px,-2px); }
    .opt-SOFT-3 .ghost { width:100%; border:1px solid var(--line); background:transparent; color:var(--cream);
      border-radius:999px; padding:15px 22px; font:500 15px 'Instrument Sans',sans-serif; cursor:pointer; margin-top:10px;
      transition:border-color .3s ease, transform .4s cubic-bezier(.32,.72,0,1); }
    .opt-SOFT-3 .ghost:active { transform:scale(.98); }
    .opt-SOFT-3 .ghost:hover { border-color:var(--gold); }

    /* home */
    .opt-SOFT-3 .wm { font-family:'Cormorant Garamond',serif; font-size:74px; line-height:.9; font-weight:500; margin:16px 0 8px; }
    .opt-SOFT-3 .wm i { color:var(--gold-2); }
    .opt-SOFT-3 .lede { font-family:'Cormorant Garamond',serif; font-size:23px; font-style:italic; line-height:1.4; color:var(--soft); max-width:24ch; }
    .opt-SOFT-3 .rule { height:1px; background:linear-gradient(90deg,transparent,var(--gold),transparent); margin:24px 0; opacity:.6; }
    .opt-SOFT-3 .counts { display:flex; gap:9px; align-items:baseline; justify-content:center; }
    .opt-SOFT-3 .counts span { font-family:'Cormorant Garamond',serif; font-size:18px; color:var(--soft); }
    .opt-SOFT-3 .counts b { font-family:'Cormorant Garamond',serif; color:var(--gold-2); font-size:24px; font-weight:600; }

    /* inputs */
    .opt-SOFT-3 .flabel { font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--soft); margin:0 0 8px 2px; }
    .opt-SOFT-3 .codeboxes { display:flex; gap:10px; }
    .opt-SOFT-3 .codeboxes input { flex:1; text-align:center; font-family:'Cormorant Garamond',serif; font-size:34px; font-weight:600; color:var(--gold-2);
      background:var(--ink-2); border:1px solid var(--line); border-radius:16px; padding:12px 0; outline:none; transition:border-color .3s, box-shadow .3s; }
    .opt-SOFT-3 .codeboxes input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(203,163,78,.18); }
    .opt-SOFT-3 .field { width:100%; background:var(--ink-2); border:1px solid var(--line); border-radius:16px; padding:15px 16px; font:400 17px 'Instrument Sans',sans-serif; color:var(--cream); outline:none; margin-top:16px; transition:border-color .3s, box-shadow .3s; }
    .opt-SOFT-3 .field:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(203,163,78,.18); }
    .opt-SOFT-3 .field::placeholder { color:#6B6047; }

    /* lobby */
    .opt-SOFT-3 .bigcode { font-family:'Cormorant Garamond',serif; font-size:70px; letter-spacing:.18em; text-align:center; font-weight:600;
      background:linear-gradient(180deg,var(--gold-2),var(--gold)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .opt-SOFT-3 .seat { display:flex; align-items:center; gap:13px; padding:13px 2px; border-bottom:1px solid var(--line); }
    .opt-SOFT-3 .seat:last-child { border-bottom:none; }
    .opt-SOFT-3 .dot { width:8px; height:8px; border-radius:999px; background:var(--gold); box-shadow:0 0 8px var(--gold); flex:none; }
    .opt-SOFT-3 .dot.off { background:#544A34; box-shadow:none; }
    .opt-SOFT-3 .seat .nm { font-size:17px; font-weight:500; }
    .opt-SOFT-3 .tag { font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); border:1px solid var(--line); padding:3px 8px; border-radius:999px; }
    .opt-SOFT-3 .tag.host { color:var(--gold-2); border-color:rgba(203,163,78,.4); }
    .opt-SOFT-3 .addbot { display:flex; align-items:center; gap:10px; margin-top:14px; padding:13px 16px; border:1px dashed var(--line); border-radius:16px; color:var(--soft); font-size:15px; cursor:pointer; background:transparent; width:100%; transition:border-color .3s; }
    .opt-SOFT-3 .addbot:hover { border-color:var(--gold); }

    /* write */
    .opt-SOFT-3 .rounds { display:flex; gap:5px; margin-top:12px; }
    .opt-SOFT-3 .rounds i { flex:1; height:3px; border-radius:9px; background:var(--line); }
    .opt-SOFT-3 .rounds i.done { background:var(--soft); }
    .opt-SOFT-3 .rounds i.now { background:var(--gold); box-shadow:0 0 8px var(--gold); }
    .opt-SOFT-3 .prevk { font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); margin-bottom:9px; }
    .opt-SOFT-3 .prev { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:27px; line-height:1.35; color:var(--gold-2); }
    .opt-SOFT-3 .meter { display:flex; gap:7px; margin:4px 0 14px; }
    .opt-SOFT-3 .meter i { flex:1; height:6px; border-radius:9px; background:var(--line); transition:background .45s cubic-bezier(.32,.72,0,1), box-shadow .45s; }
    .opt-SOFT-3 .meter i.on { background:linear-gradient(90deg,var(--gold),var(--gold-2)); box-shadow:0 0 8px rgba(203,163,78,.5); }
    .opt-SOFT-3 .counter { font-family:'Cormorant Garamond',serif; font-size:17px; color:var(--soft); }
    .opt-SOFT-3 .counter b { color:var(--gold-2); }
    .opt-SOFT-3 textarea.line { width:100%; border:none; outline:none; resize:none; background:transparent;
      font-family:'Cormorant Garamond',serif; font-size:27px; line-height:1.4; color:var(--cream); min-height:78px; }
    .opt-SOFT-3 textarea.line::placeholder { color:#6B6047; }

    /* wait */
    .opt-SOFT-3 .candle { width:66px; height:66px; margin:8px auto 0; border-radius:999px; background:radial-gradient(circle at 50% 40%,var(--gold-2),var(--gold) 70%);
      display:flex; align-items:center; justify-content:center; color:#2A2008; font-family:'Cormorant Garamond',serif; font-size:30px;
      box-shadow:0 0 34px rgba(203,163,78,.5); animation:s3glow 2.6s ease-in-out infinite; }
    @keyframes s3glow { 0%,100%{ box-shadow:0 0 24px rgba(203,163,78,.35) } 50%{ box-shadow:0 0 40px rgba(203,163,78,.65) } }
    .opt-SOFT-3 .whotitle { font-family:'Cormorant Garamond',serif; font-size:34px; text-align:center; margin-top:16px; line-height:1.1; }

    /* reveal — one continuous manuscript */
    .opt-SOFT-3 .qline { display:flex; align-items:baseline; justify-content:space-between; padding:11px 0; border-bottom:1px solid var(--line); }
    .opt-SOFT-3 .qline .pn { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:600; }
    .opt-SOFT-3 .qline .rd { font-size:12px; color:var(--soft); }
    .opt-SOFT-3 .qline .rd b { color:var(--gold-2); }
    .opt-SOFT-3 .manu { padding:30px 24px; text-align:center; }
    .opt-SOFT-3 .mtitle { font-family:'Cormorant Garamond',serif; font-size:15px; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); }
    .opt-SOFT-3 .mrule { width:40px; height:1px; background:var(--gold); margin:14px auto 22px; opacity:.7; }
    .opt-SOFT-3 .ml { font-family:'Cormorant Garamond',serif; color:var(--cream); line-height:1.32;
      animation:s3rise .8s cubic-bezier(.32,.72,0,1) both; }
    .opt-SOFT-3 .ml .by { display:block; font-family:'Instrument Sans',sans-serif; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); margin-top:5px; }
    @keyframes s3rise { from{ opacity:0; transform:translateY(16px) } to{ opacity:1; transform:translateY(0) } }

    @media (prefers-reduced-motion: reduce) {
      .opt-SOFT-3 * { animation:none !important; transition:none !important; }
      .opt-SOFT-3 .ml, .opt-SOFT-3 .candle { opacity:1 !important; transform:none !important; }
    }`,
    screens: {
      home(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">Read aloud when the ink dries</p>
          <h1 class="wm">Line<i>jam</i></h1>
          <p class="lede">A poem written by everyone, seen by no one, until the end.</p>
          <div class="panel" style="margin-top:28px"><div class="panel-core">
            <p class="eyebrow" style="text-align:center;margin-bottom:14px">Nine lines</p>
            <div class="counts"><b>1</b><span>2</span><span>3</span><span>4</span><b>5</b><span>4</span><span>3</span><span>2</span><b>1</b></div>
          </div></div>
        </div><div class="dock">
          <button class="cta">Start a game <span class="knob">&#8599;</span></button>
          <button class="ghost">Join a room</button>
        </div></div>`;
      },
      join(el) {
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">Join a room</p>
          <h2 class="wm" style="font-size:46px;margin:14px 0 26px">Sign the<br>guest book</h2>
          <p class="flabel">Room code</p>
          <div class="codeboxes"><input maxlength="1" placeholder="P"><input maxlength="1" placeholder="L"><input maxlength="1" placeholder="U"><input maxlength="1" placeholder="M"></div>
          <p class="flabel" style="margin-top:22px">Your pen name</p>
          <input class="field" placeholder="How you'll sign your lines">
        </div><div class="dock">
          <button class="cta">Enter the room <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
      lobby(el, corpus) {
        const seats = corpus.players.map((p) => `
          <div class="seat">
            <span class="dot ${p.present ? '' : 'off'}"></span>
            <span class="nm">${p.name}</span>
            ${p.host ? '<span class="tag host">Host</span>' : ''}
            ${p.kind === 'ai' ? '<span class="tag">Bashō · bot</span>' : ''}
            ${!p.present ? '<span class="tag" style="margin-left:auto">away</span>' : ''}
          </div>`).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow" style="text-align:center">Your room</p>
          <div class="panel" style="margin:12px 0 8px"><div class="panel-core" style="padding:26px 20px">
            <div class="bigcode">${corpus.roomCode}</div>
            <p style="text-align:center;color:var(--soft);font-size:13px;margin-top:10px">Read the code to the table</p>
          </div></div>
          <div class="panel"><div class="panel-core" style="padding:6px 20px">${seats}</div></div>
          <button class="addbot">＋ Add a poet bot</button>
        </div><div class="dock">
          <button class="cta">Begin the game <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const bars = corpus.wordCounts.map((_, i) => `<i class="${i < g.round - 1 ? 'done' : i === g.round - 1 ? 'now' : ''}"></i>`).join('');
        const seg = Array.from({ length: g.wordsThisRound }).map(() => '<i></i>').join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">Round ${g.round} of ${g.totalRounds}</p>
          <div class="rounds">${bars}</div>
          <div class="panel" style="margin:22px 0 20px"><div class="panel-core">
            <p class="prevk">The line handed to you</p>
            <p class="prev">${g.previousLine}</p>
          </div></div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span class="prevk" style="margin:0">Your ${g.wordsThisRound} words</span>
            <span class="counter"><b id="s3c">0</b> / ${g.wordsThisRound}</span>
          </div>
          <div class="meter" id="s3m">${seg}</div>
          <div class="panel"><div class="panel-core">
            <textarea class="line" id="s3in" placeholder="Exactly ${g.wordsThisRound} words">${g.draft}</textarea>
          </div></div>
        </div><div class="dock">
          <button class="cta">Pass the poem on <span class="knob">&#8599;</span></button>
        </div></div>`;
        const ta = el.querySelector('#s3in'); const cnt = el.querySelector('#s3c');
        const segs = el.querySelectorAll('#s3m i'); const max = g.wordsThisRound;
        const paint = () => {
          const n = words(ta.value).length; cnt.textContent = Math.min(n, max);
          segs.forEach((s, i) => s.classList.toggle('on', i < Math.min(n, max)));
          cnt.style.color = n > max ? '#E08A5A' : '';
        };
        ta.addEventListener('input', paint); paint();
      },
      wait(el, corpus) {
        el.innerHTML = `<div class="stage"><div class="body">
          <div class="candle serif">✎</div>
          <h2 class="whotitle">Your line is<br>in the poem.</h2>
          <p class="lede" style="text-align:center;margin:12px auto 0;font-size:20px">Theo is still bent over the page. The reveal waits for the last hand.</p>
          <div class="panel" style="margin-top:26px"><div class="panel-core" style="padding:8px 20px">
            <div class="seat"><span class="dot"></span><span class="nm">Maya</span><span class="tag" style="margin-left:auto">done</span></div>
            <div class="seat"><span class="dot"></span><span class="nm">Bashō</span><span class="tag" style="margin-left:auto">done</span></div>
            <div class="seat"><span class="dot" style="animation:s3glow 1.6s ease-in-out infinite"></span><span class="nm">Theo</span><span class="tag host" style="margin-left:auto">writing</span></div>
          </div></div>
        </div><div class="dock">
          <button class="ghost">Nudge Theo along</button>
        </div></div>`;
      },
      reveal(el, corpus) {
        const q = corpus.revealQueue.map((r) => `
          <div class="qline"><div><span class="pn">${r.poem}</span></div>
          <div class="rd" style="text-align:right">&ldquo;${r.firstWord}&rdquo; · read by <b>${r.reader}</b></div></div>`).join('');
        const lines = corpus.poem.lines.map((l, i) => {
          const sz = [34, 31, 28, 26, 28, 26, 28, 31, 36][i] || 28;
          return `<p class="ml" style="font-size:${sz}px;margin-top:${i ? 20 : 0}px;animation-delay:${i * 0.1}s">${l.text}<span class="by">${l.author}</span></p>`;
        }).join('');
        el.innerHTML = `<div class="stage"><div class="body">
          <p class="eyebrow">The reading</p>
          <h2 class="wm" style="font-size:40px;margin:8px 0 16px">One long<br>manuscript</h2>
          <div class="panel" style="margin-bottom:22px"><div class="panel-core" style="padding:6px 20px">${q}</div></div>
          <div class="panel"><div class="panel-core manu">
            <p class="mtitle">${corpus.poem.title}</p>
            <div class="mrule"></div>
            ${lines}
          </div></div>
          <div style="height:14px"></div>
        </div><div class="dock">
          <button class="cta">Turn the page <span class="knob">&#8599;</span></button>
        </div></div>`;
      },
    },
  };
})();
