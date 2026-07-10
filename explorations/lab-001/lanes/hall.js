/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
/* Hallmark · genre: playful · macrostructures: Map/Diagram (H1) · Catalogue (H3) · Zine Editions (H4) · Theme Gallery (H6) · theme rotation across warm-map, leaf-catalog, dark-press, warm-gallery */
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  /* ---- shared render helpers (markup only; each option styles the classes) ---- */
  function people(corpus) {
    return corpus.players.map(function (p) {
      var state = p.present ? 'here' : 'away';
      var mark = p.kind === 'ai' ? 'AI' : p.host ? 'HOST' : (p.present ? 'HERE' : 'AWAY');
      return '<li class="person ' + state + '"><b>' + p.name + '</b><span>' + mark + '</span></li>';
    }).join('');
  }
  function slots(corpus) {
    var words = corpus.game.draft.split(' ');
    var total = corpus.game.wordsThisRound;
    var out = '';
    for (var i = 0; i < total; i++) {
      out += i < words.length
        ? '<span class="slot filled">' + words[i] + '</span>'
        : '<span class="slot">' + (i + 1) + '</span>';
    }
    return out;
  }
  /* reveal = the reading circle: every player holds one poem, readers go
     around the room, each reads their whole poem aloud on their own turn. */
  function circle(corpus) {
    return '<ul class="circle">' + corpus.revealQueue.map(function (q) {
      var label = q.status === 'read' ? 'read' : q.status === 'now' ? 'reading now' : q.status === 'next' ? 'up next' : 'waiting';
      var who = q.reader + (q.forAi ? ' (' + q.forAi + ')' : '');
      return '<li class="circ ' + q.status + '"><span class="circ-main"><span class="circ-poem">' + q.poem + '</span><span class="circ-reader">' + who + '</span></span><span class="circ-status">' + label + '</span></li>';
    }).join('') + '</ul>';
  }
  /* read = your assigned poem, whole, every line + byline, to read aloud. */
  function fullPoem(corpus, cls) {
    return '<ol class="' + cls + '">' + corpus.poem.lines.map(function (l, i) {
      return '<li><span class="rl-no">' + (i + 1) + '</span><span class="rl-text">' + l.text + '</span><span class="rl-by">' + l.author + '</span></li>';
    }).join('') + '</ol>';
  }

  /* ============================= HALL-1 · PASS THE MAP ============================= */
  var css1 = `/* Hallmark · macrostructure: Map / Diagram · tone: playful · anchor hue: vermilion */
.opt-HALL-1{box-sizing:border-box;--paper:oklch(97% .025 88);--ink:oklch(22% .035 40);--muted:oklch(43% .035 40);--red:oklch(55% .20 28);--red-ink:oklch(99% .01 88);--sun:oklch(82% .15 82);--line:oklch(72% .05 70);--focus:oklch(37% .16 255);--font-display:ui-rounded,'Arial Rounded MT Bold',system-ui,sans-serif;--font-body:ui-sans-serif,system-ui,sans-serif;background:var(--paper);color:var(--ink);font-family:var(--font-body);height:100%;overflow:hidden}
.opt-HALL-1 *{box-sizing:border-box}.opt-HALL-1 button,.opt-HALL-1 input{font:inherit}.opt-HALL-1 button{min-height:52px;border:0;cursor:pointer;white-space:nowrap}.opt-HALL-1 button:focus-visible,.opt-HALL-1 input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.opt-HALL-1 .sheet{height:100%;padding:20px 20px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;position:relative;isolation:isolate}
.opt-HALL-1 .brand{font:800 15px/1 var(--font-display);letter-spacing:.03em}.opt-HALL-1 h1,.opt-HALL-1 h2,.opt-HALL-1 p{margin:0}
.opt-HALL-1 h1{font:800 clamp(44px,13vw,66px)/.92 var(--font-display);letter-spacing:-.06em;overflow-wrap:anywhere}
.opt-HALL-1 h2{font:800 26px/1 var(--font-display);letter-spacing:-.04em}
.opt-HALL-1 .kicker{font-size:12px;font-weight:800;letter-spacing:.12em;color:var(--muted)}
.opt-HALL-1 .stage-note{font-size:15px;line-height:1.5;margin-top:14px;max-width:26ch}
.opt-HALL-1 .bottom{margin-top:auto;padding-top:14px;display:grid;gap:10px}
.opt-HALL-1 .primary{background:var(--red);color:var(--red-ink);border-radius:2px;font-weight:900;font-size:17px;box-shadow:4px 4px 0 var(--ink)}
.opt-HALL-1 .secondary{background:transparent;color:var(--ink);border:2px solid var(--ink);border-radius:2px;font-weight:800}
.opt-HALL-1 .route{position:absolute;border:2px solid var(--line);border-radius:999px;z-index:-1}.opt-HALL-1 .route.a{width:280px;height:280px;right:-106px;top:118px}.opt-HALL-1 .route.b{width:220px;height:150px;left:-80px;bottom:110px}
.opt-HALL-1 .waypoint{display:inline-grid;place-items:center;width:48px;height:48px;border:2px solid var(--ink);border-radius:50%;background:var(--sun);font-weight:900}
.opt-HALL-1 .join-form{display:grid;gap:18px;margin-top:44px}.opt-HALL-1 label{font-weight:800;font-size:14px;display:grid;gap:7px}
.opt-HALL-1 input{height:56px;border:2px solid var(--ink);border-radius:0;background:var(--paper);padding:0 14px;color:var(--ink)}.opt-HALL-1 input::placeholder{color:var(--muted)}
.opt-HALL-1 .code-input{text-transform:uppercase;letter-spacing:.22em;font:800 30px/1 var(--font-display)}
.opt-HALL-1 .code-hero{font:900 72px/.85 var(--font-display);letter-spacing:.03em;margin:18px 0 10px}
.opt-HALL-1 .people{list-style:none;padding:0;margin:22px 0;display:grid;gap:8px}
.opt-HALL-1 .person{min-height:48px;border-bottom:2px solid var(--line);display:flex;align-items:center;justify-content:space-between}.opt-HALL-1 .person span{font-size:10px;font-weight:900;letter-spacing:.08em}.opt-HALL-1 .away{color:var(--muted)}
.opt-HALL-1 .add{min-height:48px;background:var(--sun);border:2px solid var(--ink);font-weight:900}
.opt-HALL-1 .round-ring{width:150px;height:150px;border:2px solid var(--ink);border-radius:50%;display:grid;place-items:center;margin:22px auto 14px;position:relative;background:var(--sun)}.opt-HALL-1 .round-ring:after{content:'';position:absolute;inset:10px;border:2px dashed var(--red);border-radius:50%}.opt-HALL-1 .round-ring b{font:900 52px/.8 var(--font-display);z-index:1}
.opt-HALL-1 .previous{border-inline-start:5px solid var(--red);padding:12px 14px;background:oklch(93% .05 85);font:700 21px/1.25 var(--font-display);margin:16px 0}
.opt-HALL-1 .slotrow{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.opt-HALL-1 .slot{min-width:48px;height:54px;padding:0 14px;display:inline-grid;place-items:center;border-bottom:4px solid var(--ink);font:900 20px var(--font-display)}.opt-HALL-1 .slot.filled{border-color:var(--red);color:var(--red)}
.opt-HALL-1 .submit{background:var(--ink);color:var(--paper);font-weight:900;border-radius:0}
.opt-HALL-1 .wait-mark{font:900 84px/.8 var(--font-display);color:var(--red);margin:36px 0 12px}
.opt-HALL-1 .waitset{list-style:none;padding:0;margin:14px 0;display:flex;gap:8px}.opt-HALL-1 .waitset li{border:2px solid var(--ink);padding:8px 16px;font:900 18px var(--font-display)}
.opt-HALL-1 .readhead{display:flex;justify-content:space-between;align-items:center}
.opt-HALL-1 .progress{font-size:11px;font-weight:900;letter-spacing:.1em;color:var(--red)}
.opt-HALL-1 .read h2{margin-top:8px;font-size:23px}
.opt-HALL-1 .subtitle{font-size:13px;font-weight:800;color:var(--muted);margin:6px 0 4px}
.opt-HALL-1 .readscroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-top:2px}
.opt-HALL-1 .poemblock,.opt-HALL-1 .readblock{list-style:none;padding:0;margin:12px 0}
.opt-HALL-1 .poemblock li,.opt-HALL-1 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}
.opt-HALL-1 .rl-no{font:900 12px var(--font-display);color:var(--red)}
.opt-HALL-1 .rl-text{font:700 17px/1.2 var(--font-display);min-width:0;overflow-wrap:anywhere}
.opt-HALL-1 .rl-by{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-1 .readblock li{padding:8px 0}.opt-HALL-1 .readblock .rl-text{font:800 24px/1.15 var(--font-display)}
.opt-HALL-1 .circle{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px}
.opt-HALL-1 .circ{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px;padding:10px 14px;border:2px solid var(--line);border-radius:2px}
.opt-HALL-1 .circ-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.opt-HALL-1 .circ-poem{font:900 18px var(--font-display)}
.opt-HALL-1 .circ-reader{font-size:12px;font-weight:800;color:var(--muted)}
.opt-HALL-1 .circ-status{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.opt-HALL-1 .circ.read{opacity:.6}
.opt-HALL-1 .circ.now{border-color:var(--ink);background:var(--sun);box-shadow:4px 4px 0 var(--ink)}
.opt-HALL-1 .circ.now .circ-status{color:var(--red)}
@media (hover:hover){.opt-HALL-1 button:hover{transform:translate(-1px,-1px)}.opt-HALL-1 .primary:hover{box-shadow:6px 6px 0 var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-1 .round-ring{animation:h1ring 500ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-1 .slot.filled{animation:h1slot 260ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-1 .readblock li,.opt-HALL-1 .circ{animation:h1slot 320ms cubic-bezier(.2,.8,.2,1) both}@keyframes h1ring{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}@keyframes h1slot{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-1 *{animation:none!important;transition:none!important}}
`;

  function h1(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="sheet"><span class="brand">LINEJAM / PASS THE POEM</span><span class="route a"></span><span class="route b"></span><div style="margin-top:76px"><span class="waypoint">1</span><h1>ONE POEM,<br>NINE<br>HANDS.</h1><p class="stage-note">Nine little turns around the room. One strange poem at the end.</p></div><div class="bottom"><button class="primary">Start a Game</button><button class="secondary">Join a Room</button></div></main>';
    if (screen === 'join') return '<main class="sheet"><span class="brand">LINEJAM / JOIN</span><h1 style="margin-top:54px">FIND<br>YOUR<br>TABLE.</h1><form class="join-form"><label>ROOM CODE<input class="code-input" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="bottom"><button class="primary">Join ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="sheet"><span class="brand">ROOM IS OPEN</span><div class="code-hero">' + c.roomCode + '</div><p class="kicker">SHOW THIS ACROSS THE TABLE</p><ul class="people">' + people(c) + '</ul><button class="add">+ Add Bashō</button><div class="bottom"><button class="primary">Start the poem</button></div></main>';
    if (screen === 'write') return '<main class="sheet"><span class="brand">ROUND ' + c.game.round + ' OF ' + c.game.totalRounds + '</span><div class="round-ring"><b>' + c.game.wordsThisRound + '</b></div><p class="kicker" style="text-align:center">WORDS. NO MORE.</p><p class="previous">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><div class="bottom"><button class="submit">Pass this line</button></div></main>';
    if (screen === 'wait') return '<main class="sheet"><span class="brand">YOUR LINE IS MOVING</span><div class="wait-mark">2</div><h1>TWO MORE<br>LINES TO GO.</h1><p class="stage-note">Theo and Ravi are still finding words. Look around. Make a face.</p><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="bottom"><button class="secondary">Keep this screen awake</button></div></main>';
    if (screen === 'reveal') return '<main class="sheet"><span class="brand">THE READING CIRCLE</span><h2 style="margin-top:12px">Five poems,<br>read aloud.</h2><p class="stage-note">Each of you holds one poem. Go around the room, and read yours to everyone when it is your turn.</p>' + circle(c) + '<div class="bottom"><button class="primary">Read yours</button></div></main>';
    return '<main class="sheet read"><div class="readhead"><span class="brand">READING ALOUD</span><span class="progress">POEM ' + c.reading.position + ' OF ' + c.reading.total + '</span></div><h2>' + c.reading.assigned + '</h2><p class="subtitle">Your poem, ' + c.reading.reader + '. Read the whole thing to the room.</p><div class="readscroll">' + fullPoem(c, 'readblock') + '</div><div class="bottom"><button class="primary">Done' + c.reading.upNext + '</button></div></main>';
  }

  /* ============================= HALL-3 · POEM CATALOG ============================= */
  var css3 = `/* Hallmark · macrostructure: Catalogue · tone: playful · anchor hue: leaf-green */
.opt-HALL-3{box-sizing:border-box;--milk:oklch(98% .018 120);--ink:oklch(19% .03 130);--leaf:oklch(47% .12 145);--leaf-ink:oklch(99% .01 120);--pink:oklch(80% .10 12);--yellow:oklch(87% .12 92);--blue:oklch(80% .08 235);--line:oklch(48% .06 130);--muted:oklch(42% .035 130);--focus:oklch(37% .15 250);--font-display:Georgia,'Times New Roman',serif;--font-body:ui-sans-serif,system-ui,sans-serif;background:var(--milk);color:var(--ink);height:100%;overflow:hidden;font-family:var(--font-body)}
.opt-HALL-3 *{box-sizing:border-box}.opt-HALL-3 button,.opt-HALL-3 input{font:inherit}.opt-HALL-3 .catalog{height:100%;padding:18px 16px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
.opt-HALL-3 .mast{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:12px;font-size:12px;font-weight:900;letter-spacing:.08em}
.opt-HALL-3 h1,.opt-HALL-3 h2,.opt-HALL-3 p{margin:0}.opt-HALL-3 h1{font:900 47px/.9 var(--font-display);letter-spacing:-.04em;margin-top:22px;overflow-wrap:anywhere}.opt-HALL-3 h2{font:900 28px/.98 var(--font-display);letter-spacing:-.03em}
.opt-HALL-3 .lead{font-size:16px;line-height:1.45;margin-top:14px;max-width:28ch}
.opt-HALL-3 .actions{margin-top:auto;display:grid;gap:9px;padding-top:14px}
.opt-HALL-3 button{min-height:52px;border:2px solid var(--ink);font-weight:900;white-space:nowrap;cursor:pointer}.opt-HALL-3 button:focus-visible,.opt-HALL-3 input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.opt-HALL-3 .start{background:var(--leaf);color:var(--leaf-ink)}.opt-HALL-3 .join{background:var(--pink);color:var(--ink)}
.opt-HALL-3 .join-fields{display:grid;gap:12px;margin-top:26px}.opt-HALL-3 label{font-size:12px;font-weight:900;letter-spacing:.06em;display:grid;gap:6px}
.opt-HALL-3 input{height:54px;border:2px solid var(--ink);background:var(--milk);color:var(--ink);padding:0 12px}
.opt-HALL-3 .code{font:900 28px/1 var(--font-display);letter-spacing:.22em;text-transform:uppercase}
.opt-HALL-3 .room-card{border:2px solid var(--ink);background:var(--yellow);padding:18px;margin-top:22px}.opt-HALL-3 .room-card small{font-size:10px;font-weight:900;letter-spacing:.08em}.opt-HALL-3 .room-card strong{display:block;font:900 67px/.8 var(--font-display);letter-spacing:.04em;margin-top:10px}
.opt-HALL-3 .roster{list-style:none;padding:0;margin:16px 0;display:grid;gap:7px}
.opt-HALL-3 .person{border:2px solid var(--ink);min-height:48px;padding:0 10px;display:flex;align-items:center;justify-content:space-between}.opt-HALL-3 .person b{font-family:var(--font-display);font-size:19px}.opt-HALL-3 .person span{font-size:10px;font-weight:900;letter-spacing:.07em}.opt-HALL-3 .away{opacity:.55}
.opt-HALL-3 .add-bot{background:var(--blue);color:var(--ink)}
.opt-HALL-3 .round-chip{display:inline-block;background:var(--pink);border:2px solid var(--ink);font-weight:900;padding:8px 10px;margin-top:20px}
.opt-HALL-3 .context{font:900 28px/1.1 var(--font-display);padding:16px 0;border-bottom:2px solid var(--ink)}
.opt-HALL-3 .slotrow{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.opt-HALL-3 .slot{min-width:48px;height:54px;padding:0 14px;border:2px solid var(--ink);display:inline-grid;place-items:center;font-weight:900;font-size:19px}.opt-HALL-3 .slot.filled{background:var(--leaf);color:var(--leaf-ink)}
.opt-HALL-3 .draft{font-size:13px;color:var(--muted);margin-top:12px}
.opt-HALL-3 .wait-card{border:2px solid var(--ink);background:var(--blue);padding:20px;margin-top:26px}.opt-HALL-3 .wait-card small{font-size:10px;font-weight:900;letter-spacing:.08em}.opt-HALL-3 .wait-card p{font:900 40px/.95 var(--font-display);margin:10px 0}
.opt-HALL-3 .waitset{list-style:none;padding:0;margin:14px 0;display:flex;gap:8px}.opt-HALL-3 .waitset li{border:2px solid var(--ink);background:var(--yellow);padding:8px 16px;font:900 18px var(--font-display)}
.opt-HALL-3 .readhead{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:10px}
.opt-HALL-3 .progress{font-size:11px;font-weight:900;letter-spacing:.1em;color:var(--leaf)}
.opt-HALL-3 .read h2{margin-top:12px;font-size:24px}
.opt-HALL-3 .readscroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-top:2px}
.opt-HALL-3 .poemblock,.opt-HALL-3 .readblock{list-style:none;padding:0;margin:14px 0}
.opt-HALL-3 .poemblock li,.opt-HALL-3 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.opt-HALL-3 .rl-no{font:900 12px var(--font-display);color:var(--leaf)}
.opt-HALL-3 .rl-text{font:900 18px/1.15 var(--font-display);min-width:0;overflow-wrap:anywhere}
.opt-HALL-3 .rl-by{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-3 .readblock li{padding:9px 0}.opt-HALL-3 .readblock .rl-text{font-size:24px;line-height:1.2}
.opt-HALL-3 .circle{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:8px}
.opt-HALL-3 .circ{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px;padding:10px 12px;border:2px solid var(--ink)}
.opt-HALL-3 .circ-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.opt-HALL-3 .circ-poem{font:900 18px var(--font-display)}
.opt-HALL-3 .circ-reader{font-size:12px;font-weight:900;color:var(--muted)}
.opt-HALL-3 .circ-status{font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.opt-HALL-3 .circ.read{opacity:.55}
.opt-HALL-3 .circ.now{background:var(--yellow);box-shadow:3px 3px 0 var(--ink)}
.opt-HALL-3 .circ.now .circ-status{color:var(--leaf)}
@media (hover:hover){.opt-HALL-3 button:hover{transform:translateY(-2px);box-shadow:3px 3px 0 var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-3 .roster .person,.opt-HALL-3 .readblock li,.opt-HALL-3 .circ{animation:h3in 340ms cubic-bezier(.2,.8,.2,1) both}@keyframes h3in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-3 *{animation:none!important;transition:none!important}}
`;

  function h3(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="catalog"><div class="mast"><span>LINEJAM</span><span>VOLUME 01</span></div><h1>POEMS,<br>BY ACCIDENT.</h1><p class="lead">Friends write one line at a time. Nobody sees the whole thing till the end.</p><div class="actions"><button class="start">Start a Game</button><button class="join">Join a Room</button></div></main>';
    if (screen === 'join') return '<main class="catalog"><div class="mast"><span>LINEJAM</span><span>ENTRY</span></div><h1>TAKE<br>A SEAT.</h1><form class="join-fields"><label>ROOM CODE<input class="code" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="actions"><button class="start">Join ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="catalog"><div class="mast"><span>ROOM</span><span>LOBBY</span></div><div class="room-card"><small>PASS THIS CODE</small><strong>' + c.roomCode + '</strong></div><ul class="roster">' + people(c) + '</ul><button class="add-bot">+ Add Bashō</button><div class="actions"><button class="start">Start the poem</button></div></main>';
    if (screen === 'write') return '<main class="catalog"><div class="mast"><span>ROUND ' + c.game.round + ' OF ' + c.game.totalRounds + '</span><span>FIVE WORDS</span></div><span class="round-chip">ONLY THE LAST LINE</span><p class="context">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><p class="draft">' + c.game.draft + ' · 4 / ' + c.game.wordsThisRound + '</p><div class="actions"><button class="start">Pass this line</button></div></main>';
    if (screen === 'wait') return '<main class="catalog"><div class="mast"><span>YOUR LINE</span><span>SENT</span></div><div class="wait-card"><small>THE TABLE IS WAITING ON</small><p>Theo &amp; Ravi</p><small>KEEP THE ROOM LOUD</small></div><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="actions"><button class="join">I am still here</button></div></main>';
    if (screen === 'reveal') return '<main class="catalog"><div class="mast"><span>THE READING</span><span>FIVE POEMS</span></div><h2 style="margin-top:14px">One each,<br>read aloud.</h2><p class="lead">Every player holds a finished poem. Take turns: read yours to the room.</p>' + circle(c) + '<div class="actions"><button class="start">Read yours</button></div></main>';
    return '<main class="catalog read"><div class="readhead"><span style="font-weight:900;letter-spacing:.08em;font-size:12px">READING ALOUD</span><span class="progress">POEM ' + c.reading.position + ' / ' + c.reading.total + '</span></div><h2 style="margin-top:12px">' + c.reading.assigned + '</h2><p class="draft">Your poem, ' + c.reading.reader + '. Read the whole thing to the room.</p><div class="readscroll">' + fullPoem(c, 'readblock') + '</div><div class="actions"><button class="start">Done' + c.reading.upNext + '</button></div></main>';
  }

  /* ============================= HALL-4 · FIRST EDITION (zine) ============================= */
  var css4 = `/* Hallmark · macrostructure: Zine Editions · tone: playful/press · anchor hue: riso-vermilion on ink */
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap');
.opt-HALL-4{box-sizing:border-box;--ink:oklch(20% .018 60);--paper:oklch(94% .024 85);--spot:oklch(63% .20 30);--spot2:oklch(72% .12 235);--muted:oklch(64% .02 80);--line:oklch(40% .02 70);--focus:oklch(82% .16 90);--font-display:'Anton',Impact,Haettenschweiler,sans-serif;--font-body:'Newsreader',Georgia,serif;background:var(--ink);color:var(--paper);height:100%;overflow:hidden;font-family:var(--font-body)}
.opt-HALL-4 *{box-sizing:border-box}.opt-HALL-4 button,.opt-HALL-4 input{font:inherit}.opt-HALL-4 button{min-height:54px;border:0;cursor:pointer;white-space:nowrap}.opt-HALL-4 button:focus-visible,.opt-HALL-4 input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.opt-HALL-4 .zine{height:100%;padding:18px 18px calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
.opt-HALL-4 .plate{display:flex;justify-content:space-between;border-bottom:2px solid var(--paper);padding-bottom:10px;font:400 12px var(--font-display);letter-spacing:.14em}
.opt-HALL-4 h1,.opt-HALL-4 h2,.opt-HALL-4 p{margin:0}
.opt-HALL-4 h1{font:400 clamp(50px,15vw,72px)/.85 var(--font-display);letter-spacing:.01em;text-transform:uppercase;margin-top:24px;overflow-wrap:anywhere}
.opt-HALL-4 h2{font:400 40px/.9 var(--font-display);text-transform:uppercase;margin-top:22px;overflow-wrap:anywhere}
.opt-HALL-4 .lead{font-size:16px;line-height:1.5;margin-top:16px;max-width:30ch}
.opt-HALL-4 .colophon{display:flex;gap:14px;margin-top:20px;flex-wrap:wrap}.opt-HALL-4 .colophon span{font:400 12px var(--font-display);letter-spacing:.12em;color:var(--spot)}
.opt-HALL-4 .press{margin-top:auto;padding-top:16px;display:grid;gap:10px}
.opt-HALL-4 .ink{background:var(--spot);color:oklch(98% .01 85);font:400 20px var(--font-display);letter-spacing:.04em;text-transform:uppercase}
.opt-HALL-4 .outline{background:transparent;color:var(--paper);border:2px solid var(--paper);font:400 18px var(--font-display);letter-spacing:.04em;text-transform:uppercase}
.opt-HALL-4 .fields{display:grid;gap:14px;margin-top:26px}.opt-HALL-4 label{font:400 13px var(--font-display);letter-spacing:.1em;display:grid;gap:7px}
.opt-HALL-4 input{height:54px;border:2px solid var(--paper);background:transparent;color:var(--paper);padding:0 12px;font-family:var(--font-body);font-size:16px}
.opt-HALL-4 .code{font:400 28px var(--font-display);letter-spacing:.2em;text-transform:uppercase}
.opt-HALL-4 .edition-plate{border:2px solid var(--paper);padding:16px;margin-top:22px}.opt-HALL-4 .edition-plate small{font:400 12px var(--font-display);letter-spacing:.14em;color:var(--muted)}.opt-HALL-4 .edition-plate strong{display:block;font:400 62px/.85 var(--font-display);letter-spacing:.05em;margin:8px 0}.opt-HALL-4 .edition-plate span{font-size:12px;color:var(--muted)}
.opt-HALL-4 .contribs{list-style:none;padding:0;margin:16px 0;display:grid;gap:6px}
.opt-HALL-4 .person{border-bottom:1px solid var(--line);min-height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 2px}.opt-HALL-4 .person b{font-weight:600;font-size:18px}.opt-HALL-4 .person span{font:400 10px var(--font-display);letter-spacing:.1em;color:var(--spot)}.opt-HALL-4 .away{opacity:.5}
.opt-HALL-4 .add-ink{min-height:48px;background:transparent;border:2px dashed var(--spot2);color:var(--spot2);font:400 15px var(--font-display);letter-spacing:.06em;text-transform:uppercase}
.opt-HALL-4 .preface{font:400 12px var(--font-display);letter-spacing:.14em;color:var(--muted);margin-top:22px}
.opt-HALL-4 .preceding{border-left:4px solid var(--spot);padding:10px 14px;font-size:22px;line-height:1.3;margin:8px 0 0;font-style:italic}
.opt-HALL-4 .foot-note{font-size:13px;color:var(--muted);margin-top:12px}
.opt-HALL-4 .edtitle{margin-top:14px}
.opt-HALL-4 .slotrow{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
.opt-HALL-4 .slot{min-width:48px;height:54px;padding:0 14px;display:inline-grid;place-items:center;border:2px solid var(--paper);font:400 20px var(--font-display);letter-spacing:.03em}.opt-HALL-4 .slot.filled{background:var(--paper);color:var(--ink)}
.opt-HALL-4 .waitset{list-style:none;padding:0;margin:18px 0;display:flex;gap:8px}.opt-HALL-4 .waitset li{border:2px solid var(--spot);padding:8px 16px;font:400 18px var(--font-display);letter-spacing:.04em}
.opt-HALL-4 .progress{color:var(--spot)}
.opt-HALL-4 .readscroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-top:2px}
.opt-HALL-4 .poemblock,.opt-HALL-4 .readblock{list-style:none;padding:0;margin:12px 0}
.opt-HALL-4 .poemblock li,.opt-HALL-4 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}
.opt-HALL-4 .rl-no{font:400 13px var(--font-display);color:var(--spot);letter-spacing:.05em}
.opt-HALL-4 .rl-text{font:400 18px/1.3 var(--font-body);min-width:0;overflow-wrap:anywhere}
.opt-HALL-4 .rl-by{font:400 10px var(--font-display);letter-spacing:.1em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-4 .readblock li{padding:8px 0}.opt-HALL-4 .readblock .rl-text{font-size:25px;line-height:1.25}
.opt-HALL-4 .circle{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px}
.opt-HALL-4 .circ{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px;padding:10px 12px;border:1px solid var(--line)}
.opt-HALL-4 .circ-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.opt-HALL-4 .circ-poem{font:400 20px var(--font-display);letter-spacing:.03em}
.opt-HALL-4 .circ-reader{font:400 12px var(--font-body);color:var(--muted)}
.opt-HALL-4 .circ-status{font:400 11px var(--font-display);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.opt-HALL-4 .circ.read{opacity:.5}
.opt-HALL-4 .circ.now{border-color:var(--spot);background:oklch(26% .03 40)}
.opt-HALL-4 .circ.now .circ-poem{color:var(--paper)}
.opt-HALL-4 .circ.now .circ-status{color:var(--spot)}
@media (hover:hover){.opt-HALL-4 button:hover{filter:brightness(1.08)}.opt-HALL-4 .outline:hover{background:var(--paper);color:var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-4 .zine{animation:h4in 380ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-4 .readblock li,.opt-HALL-4 .circ{animation:h4line 360ms cubic-bezier(.2,.8,.2,1) both}@keyframes h4in{from{opacity:0}to{opacity:1}}@keyframes h4line{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-4 *{animation:none!important;transition:none!important}}
`;

  function h4(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="zine"><div class="plate"><span>LINEJAM PRESS</span><span>EDITION 01</span></div><h1>COLLECTED<br>ACCIDENTS</h1><p class="lead">A limited run of one poem, set one line at a time by everyone in the room.</p><div class="colophon"><span>NINE FOLIOS</span><span>ONE COPY</span><span>NO REPRINTS</span></div><div class="press"><button class="ink">Begin a volume</button><button class="outline">Join a volume</button></div></main>';
    if (screen === 'join') return '<main class="zine"><div class="plate"><span>SUBSCRIBE</span><span>EDITION 01</span></div><h2>Enter the<br>pressroom.</h2><form class="fields"><label>ROOM CODE<input class="code" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="press"><button class="ink">Enter ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="zine"><div class="plate"><span>PRESS RUN</span><span>LOBBY</span></div><div class="edition-plate"><small>ROOM CODE</small><strong>' + c.roomCode + '</strong><span>Contributors set below</span></div><ul class="contribs">' + people(c) + '</ul><button class="add-ink">+ Set Bashō in type</button><div class="press"><button class="ink">Set the poem</button></div></main>';
    if (screen === 'write') return '<main class="zine"><div class="plate"><span>FOLIO ' + c.game.round + ' / ' + c.game.totalRounds + '</span><span>SET FIVE WORDS</span></div><p class="preface">PRECEDING LINE</p><p class="preceding">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><p class="foot-note">' + c.game.draft + ' · 4 of ' + c.game.wordsThisRound + ' words</p><div class="press"><button class="ink">Set this line</button></div></main>';
    if (screen === 'wait') return '<main class="zine"><div class="plate"><span>SENT TO PRESS</span><span>HOLD</span></div><h2>Two lines<br>still wet.</h2><p class="lead">Theo and Ravi are still setting their words. The edition waits for them.</p><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="press"><button class="outline">I am still here</button></div></main>';
    if (screen === 'reveal') return '<main class="zine"><div class="plate"><span>THE READING</span><span>FIVE FOLIOS</span></div><h2 class="edtitle">One poem<br>each, aloud.</h2><p class="lead">Every contributor holds a finished edition. Read yours to the room in turn.</p>' + circle(c) + '<div class="press"><button class="ink">Read yours</button></div></main>';
    return '<main class="zine read"><div class="plate"><span>NOW READING</span><span class="progress">POEM ' + c.reading.position + ' / ' + c.reading.total + '</span></div><h2 class="edtitle">' + c.reading.assigned + '</h2><p class="foot-note">Your edition, ' + c.reading.reader + '. Read the whole thing to the room.</p><div class="readscroll">' + fullPoem(c, 'readblock') + '</div><div class="press"><button class="ink">Done' + c.reading.upNext + '</button></div></main>';
  }

  /* ============================= HALL-6 · THEME GALLERY (selector) ============================= */
  var css6 = `/* Hallmark · macrostructure: Theme Gallery / Catalogue · tone: playful · anchor hue: vermilion · chrome kept neutral so each swatch reads true */
.opt-HALL-6{box-sizing:border-box;--paper:oklch(97% .025 88);--ink:oklch(22% .035 40);--muted:oklch(45% .03 40);--red:oklch(55% .20 28);--red-ink:oklch(99% .01 88);--card:oklch(99% .012 88);--line:oklch(80% .04 70);--focus:oklch(37% .16 255);--font-display:Georgia,'Times New Roman',serif;--font-body:ui-sans-serif,system-ui,sans-serif;background:var(--paper);color:var(--ink);height:100%;overflow:hidden;font-family:var(--font-body)}
.opt-HALL-6 *{box-sizing:border-box}.opt-HALL-6 button{font:inherit;cursor:pointer}.opt-HALL-6 button:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.opt-HALL-6 .themes{height:100%;display:flex;flex-direction:column}
.opt-HALL-6 .th-head{padding:18px 16px 12px;border-bottom:2px solid var(--ink);background:var(--paper)}
.opt-HALL-6 h1{margin:0;font:900 32px/.95 var(--font-display);letter-spacing:-.02em}
.opt-HALL-6 .th-sub{margin:5px 0 0;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.opt-HALL-6 .th-active{margin:8px 0 0;font-size:13px;color:var(--muted)}.opt-HALL-6 .th-active b{color:var(--red);font-weight:900}
.opt-HALL-6 .grid{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px calc(16px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start;list-style:none;margin:0}
.opt-HALL-6 .card{border:2px solid var(--ink);border-radius:3px;background:var(--card);display:flex;flex-direction:column;overflow:hidden}
.opt-HALL-6 .card.active{outline:3px solid var(--red);outline-offset:2px}
.opt-HALL-6 .swatch{padding:12px;min-height:92px;display:flex;flex-direction:column;justify-content:center;gap:2px;background:var(--tp);color:var(--ti);border-bottom:2px solid var(--ink)}
.opt-HALL-6 .sw-line{font:700 17px/1.15 var(--font-display);overflow-wrap:anywhere}
.opt-HALL-6 .sw-line.accent{color:var(--ta)}
.opt-HALL-6 .sw-seal{width:16px;height:16px;border-radius:50%;background:var(--ta);margin-top:6px}
.opt-HALL-6 .meta{padding:10px 12px 4px;flex:1}
.opt-HALL-6 .th-name{font:900 16px var(--font-display);display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.1}
.opt-HALL-6 .badge{font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--red-ink);background:var(--red);padding:2px 6px;border-radius:2px}
.opt-HALL-6 .badge.ship{color:var(--muted);background:transparent;border:1px solid var(--line)}
.opt-HALL-6 .th-vibe{font-size:11px;line-height:1.35;color:var(--muted);margin-top:5px}
.opt-HALL-6 .pick{margin:8px 12px 12px;min-height:44px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);font:800 13px var(--font-body);letter-spacing:.04em;border-radius:2px}
.opt-HALL-6 .pick[aria-pressed=true]{background:var(--red);color:var(--red-ink);border-color:var(--red)}
@media (hover:hover){.opt-HALL-6 .pick:hover{transform:translateY(-1px)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-6 .card{animation:h6in 300ms cubic-bezier(.2,.8,.2,1) both}@keyframes h6in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-6 *{animation:none!important;transition:none!important}}
`;

  function h6(el, corpus) {
    var active = 'kenya';
    var activeTheme = corpus.themes.filter(function (t) { return t.id === active; })[0] || corpus.themes[0];
    var cards = corpus.themes.map(function (t) {
      var isActive = t.id === active;
      var badge = isActive
        ? '<span class="badge">Active</span>'
        : (t.shipped ? '<span class="badge ship">Shipped</span>' : '');
      var swStyle = 'style="--tp:' + t.paper + ';--ti:' + t.ink + ';--ta:' + t.accent + '"';
      return '<li class="card' + (isActive ? ' active' : '') + '">'
        + '<div class="swatch" ' + swStyle + '><span class="sw-line">moonlight</span><span class="sw-line accent">soft rain</span><span class="sw-seal" aria-hidden="true"></span></div>'
        + '<div class="meta"><div class="th-name">' + t.name + badge + '</div><div class="th-vibe">' + t.vibe + '</div></div>'
        + '<button class="pick" aria-pressed="' + (isActive ? 'true' : 'false') + '" aria-label="' + (isActive ? 'Current theme, ' + t.name : 'Use the ' + t.name + ' theme') + '">' + (isActive ? 'Active' : 'Use') + '</button>'
        + '</li>';
    }).join('');
    el.innerHTML = '<main class="themes"><header class="th-head"><h1>Themes</h1>'
      + '<p class="th-sub">' + corpus.themes.length + ' to choose from</p>'
      + '<p class="th-active">Now showing <b>' + activeTheme.name + '</b></p></header>'
      + '<ul class="grid">' + cards + '</ul></main>';
  }

  /* ---- register ---- */
  function wire(fn, screen) {
    return function (el, corpus) { el.innerHTML = fn(screen, corpus); };
  }
  function screens(fn) {
    return { home: wire(fn, 'home'), join: wire(fn, 'join'), lobby: wire(fn, 'lobby'), write: wire(fn, 'write'), wait: wire(fn, 'wait'), reveal: wire(fn, 'reveal'), read: wire(fn, 'read') };
  }

  window.LANE_SPECS['HALL-1'] = { lane: 'hall', title: 'Pass the Map', move: 'Keep the visible-route handoff system; land the finale as the reading circle (each player holds one poem) plus a whole-poem read-aloud on a fixed alignment margin.', css: css1, screens: screens(h1) };
  window.LANE_SPECS['HALL-3'] = { lane: 'hall', title: 'Poem Catalog', move: 'Hold the edition-card catalogue and end it as a reading-circle queue plus a whole-poem read-aloud screen, all on one alignment law.', css: css3, screens: screens(h3) };
  window.LANE_SPECS['HALL-4'] = { lane: 'hall', title: 'First Edition', move: 'Iterate the catalogue into a fine-press zine: dark ink stock, Anton plates, folio/colophon anatomy, and a reading-circle reveal into a read screen that shows the whole assigned edition at once for reading aloud.', css: css4, screens: screens(h4) };
  window.LANE_SPECS['HALL-6'] = { lane: 'hall', section: 'SELECTOR', title: 'Theme Gallery', move: 'A first-class theme picker: a scrollable gallery of 14 themes, each a live swatch previewing its own paper, ink, and accent under one poem line, with the active theme marked and a 44px pick on every card.', css: css6, screens: { selector: h6 } };
}());
