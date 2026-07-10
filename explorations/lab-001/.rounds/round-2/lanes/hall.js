/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 */
/* Hallmark · genre: playful · macrostructures: Map/Diagram (H1) · Catalogue (H3) · Zine Editions (H4) · Playbill/Poster (H5) · theme rotation across warm-map, leaf-catalog, dark-press, cream-playbill */
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
  function revealPoem(corpus) {
    return '<ol class="poemblock">' + corpus.poem.lines.map(function (l, i) {
      return '<li><span class="rl-no">' + (i + 1) + '</span><span class="rl-text">' + l.text + '</span><span class="rl-by">' + l.author + '</span></li>';
    }).join('') + '</ol>';
  }
  function readCeremony(corpus) {
    var r = corpus.reading, ls = corpus.poem.lines, out = '';
    for (var i = 0; i <= r.revealedLines && i < ls.length; i++) {
      if (i === r.revealedLines) {
        out += '<li class="rl-next"><span class="rl-no">' + (i + 1) + '</span><span class="rl-text">Tap to reveal line ' + (i + 1) + '</span><span class="rl-by"></span></li>';
      } else {
        out += '<li><span class="rl-no">' + (i + 1) + '</span><span class="rl-text">' + ls[i].text + '</span><span class="rl-by">' + ls[i].author + '</span></li>';
      }
    }
    return '<ol class="readblock">' + out + '</ol>';
  }
  function lineup(corpus) {
    return '<ul class="lineup">' + corpus.revealQueue.map(function (q) {
      return '<li><b>' + q.poem + '</b><span>' + q.reader + (q.forAi ? ' · ' + q.forAi : '') + '</span></li>';
    }).join('') + '</ul>';
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
.opt-HALL-1 .nextreader{font-size:12px;font-weight:800;color:var(--muted);margin-bottom:10px}
.opt-HALL-1 .poemblock,.opt-HALL-1 .readblock{list-style:none;padding:0;margin:12px 0}
.opt-HALL-1 .poemblock li,.opt-HALL-1 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}
.opt-HALL-1 .rl-no{font:900 12px var(--font-display);color:var(--red)}
.opt-HALL-1 .rl-text{font:700 17px/1.2 var(--font-display);min-width:0;overflow-wrap:anywhere}
.opt-HALL-1 .rl-by{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-1 .readblock li{padding:8px 0}.opt-HALL-1 .readblock .rl-text{font:800 24px/1.15 var(--font-display)}
.opt-HALL-1 .readblock li.rl-next .rl-text{color:var(--red);border-bottom:3px dashed var(--red);padding-bottom:4px}
.opt-HALL-1 .lineup{list-style:none;padding:0;margin:10px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:6px}
.opt-HALL-1 .lineup li{border:2px solid var(--ink);padding:8px 10px;display:flex;flex-direction:column;gap:2px}.opt-HALL-1 .lineup b{font:900 14px var(--font-display)}.opt-HALL-1 .lineup span{font-size:10px;font-weight:800;color:var(--muted)}
@media (hover:hover){.opt-HALL-1 button:hover{transform:translate(-1px,-1px)}.opt-HALL-1 .primary:hover{box-shadow:6px 6px 0 var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-1 .round-ring{animation:h1ring 500ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-1 .slot.filled{animation:h1slot 260ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-1 .readblock li{animation:h1slot 320ms cubic-bezier(.2,.8,.2,1) both}@keyframes h1ring{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}@keyframes h1slot{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-1 *{animation:none!important;transition:none!important}}
`;

  function h1(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="sheet"><span class="brand">LINEJAM / PASS THE POEM</span><span class="route a"></span><span class="route b"></span><div style="margin-top:76px"><span class="waypoint">1</span><h1>ONE POEM,<br>NINE<br>HANDS.</h1><p class="stage-note">Nine little turns around the room. One strange poem at the end.</p></div><div class="bottom"><button class="primary">Start a Game</button><button class="secondary">Join a Room</button></div></main>';
    if (screen === 'join') return '<main class="sheet"><span class="brand">LINEJAM / JOIN</span><h1 style="margin-top:54px">FIND<br>YOUR<br>TABLE.</h1><form class="join-form"><label>ROOM CODE<input class="code-input" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="bottom"><button class="primary">Join ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="sheet"><span class="brand">ROOM IS OPEN</span><div class="code-hero">' + c.roomCode + '</div><p class="kicker">SHOW THIS ACROSS THE TABLE</p><ul class="people">' + people(c) + '</ul><button class="add">+ Add Bashō</button><div class="bottom"><button class="primary">Start the poem</button></div></main>';
    if (screen === 'write') return '<main class="sheet"><span class="brand">ROUND ' + c.game.round + ' OF ' + c.game.totalRounds + '</span><div class="round-ring"><b>' + c.game.wordsThisRound + '</b></div><p class="kicker" style="text-align:center">WORDS. NO MORE.</p><p class="previous">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><div class="bottom"><button class="submit">Pass this line</button></div></main>';
    if (screen === 'wait') return '<main class="sheet"><span class="brand">YOUR LINE IS MOVING</span><div class="wait-mark">2</div><h1>TWO MORE<br>LINES TO GO.</h1><p class="stage-note">Theo and Ravi are still finding words. Look around. Make a face.</p><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="bottom"><button class="secondary">Keep this screen awake</button></div></main>';
    if (screen === 'reveal') return '<main class="sheet"><span class="brand">THE REVEAL</span><h2 style="margin-top:12px">' + c.poem.title + '</h2>' + revealPoem(c) + '<p class="kicker" style="margin-top:12px">READING ORDER</p>' + lineup(c) + '<div class="bottom"><button class="primary">Start the reading</button></div></main>';
    return '<main class="sheet read"><div class="readhead"><span class="brand">READING ALOUD</span><span class="progress">POEM ' + c.reading.position + ' / ' + c.reading.total + '</span></div><h2>' + c.reading.reader + ' reads ' + c.poem.title + '</h2>' + readCeremony(c) + '<div class="bottom"><p class="nextreader">' + c.reading.nextReader + ' reads next · line ' + c.reading.revealedLines + ' of ' + c.poem.lines.length + '</p><button class="primary">Reveal next line</button></div></main>';
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
.opt-HALL-3 .nextreader{font-size:12px;font-weight:800;color:var(--muted);margin-bottom:10px}
.opt-HALL-3 .poemblock,.opt-HALL-3 .readblock{list-style:none;padding:0;margin:14px 0}
.opt-HALL-3 .poemblock li,.opt-HALL-3 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.opt-HALL-3 .rl-no{font:900 12px var(--font-display);color:var(--leaf)}
.opt-HALL-3 .rl-text{font:900 18px/1.15 var(--font-display);min-width:0;overflow-wrap:anywhere}
.opt-HALL-3 .rl-by{font-size:10px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-3 .readblock li{padding:9px 0}.opt-HALL-3 .readblock .rl-text{font-size:24px;line-height:1.2}
.opt-HALL-3 .readblock li.rl-next .rl-text{color:var(--leaf);border-bottom:3px dashed var(--leaf);padding-bottom:4px}
.opt-HALL-3 .lineup{list-style:none;padding:0;margin:10px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:6px}
.opt-HALL-3 .lineup li{border:2px solid var(--ink);padding:8px 10px;display:flex;flex-direction:column;gap:2px}.opt-HALL-3 .lineup b{font:900 15px var(--font-display)}.opt-HALL-3 .lineup span{font-size:10px;font-weight:800;color:var(--muted)}
@media (hover:hover){.opt-HALL-3 button:hover{transform:translateY(-2px);box-shadow:3px 3px 0 var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-3 .roster .person,.opt-HALL-3 .readblock li{animation:h3in 340ms cubic-bezier(.2,.8,.2,1) both}@keyframes h3in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-3 *{animation:none!important;transition:none!important}}
`;

  function h3(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="catalog"><div class="mast"><span>LINEJAM</span><span>VOLUME 01</span></div><h1>POEMS,<br>BY ACCIDENT.</h1><p class="lead">Friends write one line at a time. Nobody sees the whole thing till the end.</p><div class="actions"><button class="start">Start a Game</button><button class="join">Join a Room</button></div></main>';
    if (screen === 'join') return '<main class="catalog"><div class="mast"><span>LINEJAM</span><span>ENTRY</span></div><h1>TAKE<br>A SEAT.</h1><form class="join-fields"><label>ROOM CODE<input class="code" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="actions"><button class="start">Join ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="catalog"><div class="mast"><span>ROOM</span><span>LOBBY</span></div><div class="room-card"><small>PASS THIS CODE</small><strong>' + c.roomCode + '</strong></div><ul class="roster">' + people(c) + '</ul><button class="add-bot">+ Add Bashō</button><div class="actions"><button class="start">Start the poem</button></div></main>';
    if (screen === 'write') return '<main class="catalog"><div class="mast"><span>ROUND ' + c.game.round + ' OF ' + c.game.totalRounds + '</span><span>FIVE WORDS</span></div><span class="round-chip">ONLY THE LAST LINE</span><p class="context">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><p class="draft">' + c.game.draft + ' · 4 / ' + c.game.wordsThisRound + '</p><div class="actions"><button class="start">Pass this line</button></div></main>';
    if (screen === 'wait') return '<main class="catalog"><div class="mast"><span>YOUR LINE</span><span>SENT</span></div><div class="wait-card"><small>THE TABLE IS WAITING ON</small><p>Theo &amp; Ravi</p><small>KEEP THE ROOM LOUD</small></div><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="actions"><button class="join">I am still here</button></div></main>';
    if (screen === 'reveal') return '<main class="catalog"><div class="mast"><span>THE FINALE</span><span>READ ALOUD</span></div><h2 style="margin-top:12px">' + c.poem.title + '</h2>' + revealPoem(c) + '<div class="mast" style="border:0;padding:0;margin-top:8px"><span>READING ORDER</span></div>' + lineup(c) + '<div class="actions"><button class="start">Start the reading</button></div></main>';
    return '<main class="catalog read"><div class="readhead"><span style="font-weight:900;letter-spacing:.08em;font-size:12px">READING ALOUD</span><span class="progress">POEM ' + c.reading.position + ' / ' + c.reading.total + '</span></div><h2>' + c.reading.reader + ' reads ' + c.poem.title + '</h2>' + readCeremony(c) + '<div class="actions"><p class="nextreader">' + c.reading.nextReader + ' reads next · line ' + c.reading.revealedLines + ' of ' + c.poem.lines.length + '</p><button class="start">Reveal next line</button></div></main>';
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
.opt-HALL-4 .nextreader{font-size:13px;color:var(--muted);margin-bottom:10px}
.opt-HALL-4 .poemblock,.opt-HALL-4 .readblock{list-style:none;padding:0;margin:12px 0}
.opt-HALL-4 .poemblock li,.opt-HALL-4 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}
.opt-HALL-4 .rl-no{font:400 13px var(--font-display);color:var(--spot);letter-spacing:.05em}
.opt-HALL-4 .rl-text{font:400 18px/1.3 var(--font-body);min-width:0;overflow-wrap:anywhere}
.opt-HALL-4 .rl-by{font:400 10px var(--font-display);letter-spacing:.1em;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-4 .readblock li{padding:8px 0}.opt-HALL-4 .readblock .rl-text{font-size:25px;line-height:1.25}
.opt-HALL-4 .readblock li.rl-next .rl-text{color:var(--spot);font-style:italic;border-bottom:2px dashed var(--spot);padding-bottom:4px}
.opt-HALL-4 .lineup{list-style:none;padding:0;margin:10px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:6px}
.opt-HALL-4 .lineup li{border:1px solid var(--line);padding:8px 10px;display:flex;flex-direction:column;gap:2px}.opt-HALL-4 .lineup b{font:400 15px var(--font-display);letter-spacing:.04em}.opt-HALL-4 .lineup span{font-size:11px;color:var(--muted)}
@media (hover:hover){.opt-HALL-4 button:hover{filter:brightness(1.08)}.opt-HALL-4 .outline:hover{background:var(--paper);color:var(--ink)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-4 .zine{animation:h4in 380ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-4 .readblock li{animation:h4line 360ms cubic-bezier(.2,.8,.2,1) both}@keyframes h4in{from{opacity:0}to{opacity:1}}@keyframes h4line{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-4 *{animation:none!important;transition:none!important}}
`;

  function h4(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="zine"><div class="plate"><span>LINEJAM PRESS</span><span>EDITION 01</span></div><h1>COLLECTED<br>ACCIDENTS</h1><p class="lead">A limited run of one poem, set one line at a time by everyone in the room.</p><div class="colophon"><span>NINE FOLIOS</span><span>ONE COPY</span><span>NO REPRINTS</span></div><div class="press"><button class="ink">Begin a volume</button><button class="outline">Join a volume</button></div></main>';
    if (screen === 'join') return '<main class="zine"><div class="plate"><span>SUBSCRIBE</span><span>EDITION 01</span></div><h2>Enter the<br>pressroom.</h2><form class="fields"><label>ROOM CODE<input class="code" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="press"><button class="ink">Enter ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="zine"><div class="plate"><span>PRESS RUN</span><span>LOBBY</span></div><div class="edition-plate"><small>ROOM CODE</small><strong>' + c.roomCode + '</strong><span>Contributors set below</span></div><ul class="contribs">' + people(c) + '</ul><button class="add-ink">+ Set Bashō in type</button><div class="press"><button class="ink">Set the poem</button></div></main>';
    if (screen === 'write') return '<main class="zine"><div class="plate"><span>FOLIO ' + c.game.round + ' / ' + c.game.totalRounds + '</span><span>SET FIVE WORDS</span></div><p class="preface">PRECEDING LINE</p><p class="preceding">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><p class="foot-note">' + c.game.draft + ' · 4 of ' + c.game.wordsThisRound + ' words</p><div class="press"><button class="ink">Set this line</button></div></main>';
    if (screen === 'wait') return '<main class="zine"><div class="plate"><span>SENT TO PRESS</span><span>HOLD</span></div><h2>Two lines<br>still wet.</h2><p class="lead">Theo and Ravi are still setting their words. The edition waits for them.</p><ul class="waitset"><li>Theo</li><li>Ravi</li></ul><div class="press"><button class="outline">I am still here</button></div></main>';
    if (screen === 'reveal') return '<main class="zine"><div class="plate"><span>EDITION 01</span><span>' + c.poem.title.toUpperCase() + '</span></div><h2 class="edtitle">' + c.poem.title + '</h2>' + revealPoem(c) + '<p class="preface">READING ORDER</p>' + lineup(c) + '<div class="press"><button class="ink">To the reading</button></div></main>';
    return '<main class="zine read"><div class="plate"><span>READING</span><span class="progress">POEM ' + c.reading.position + ' / ' + c.reading.total + '</span></div><h2 class="edtitle">' + c.reading.reader + ' reads ' + c.poem.title + '</h2>' + readCeremony(c) + '<div class="press"><p class="nextreader">' + c.reading.nextReader + ' reads next · line ' + c.reading.revealedLines + ' of ' + c.poem.lines.length + '</p><button class="ink">Reveal next line</button></div></main>';
  }

  /* ============================= HALL-5 · PLAYBILL (fresh seed) ============================= */
  var css5 = `/* Hallmark · macrostructure: Playbill / Poster (centered) · tone: playful/theatrical · anchor hue: curtain-red */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
.opt-HALL-5{box-sizing:border-box;--cream:oklch(95% .026 85);--ink:oklch(20% .02 45);--curtain:oklch(44% .17 25);--gold:oklch(70% .12 75);--muted:oklch(46% .02 45);--line:oklch(72% .04 70);--focus:oklch(40% .16 255);--font-display:'Playfair Display',Georgia,serif;--font-body:'EB Garamond',Georgia,serif;background:var(--cream);color:var(--ink);height:100%;overflow:hidden;font-family:var(--font-body)}
.opt-HALL-5 *{box-sizing:border-box}.opt-HALL-5 button,.opt-HALL-5 input{font:inherit}.opt-HALL-5 button{min-height:54px;border:0;cursor:pointer;white-space:nowrap}.opt-HALL-5 button:focus-visible,.opt-HALL-5 input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.opt-HALL-5 .bill{height:100%;padding:24px 20px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;text-align:center;align-items:center}
.opt-HALL-5 h1,.opt-HALL-5 h2,.opt-HALL-5 p{margin:0}
.opt-HALL-5 .troupe{font:600 12px var(--font-body);letter-spacing:.22em;text-transform:uppercase;color:var(--curtain);margin-top:6px}
.opt-HALL-5 h1{font:900 clamp(42px,12vw,58px)/1 var(--font-display);letter-spacing:-.01em;margin-top:20px;overflow-wrap:anywhere}
.opt-HALL-5 h2{font:900 36px/1.04 var(--font-display);margin-top:16px;overflow-wrap:anywhere}
.opt-HALL-5 .sub{font-size:17px;font-style:italic;color:var(--muted);margin-top:14px;max-width:26ch}
.opt-HALL-5 .rule{width:66px;height:2px;background:var(--curtain);margin:22px auto}
.opt-HALL-5 .marquee-cta{margin-top:auto;padding-top:18px;display:grid;gap:10px;width:100%}
.opt-HALL-5 .lead-btn{background:var(--curtain);color:var(--cream);font:900 18px var(--font-display);letter-spacing:.01em}
.opt-HALL-5 .cast-btn{background:transparent;color:var(--ink);border:2px solid var(--ink);font:600 16px var(--font-body);letter-spacing:.06em;text-transform:uppercase}.opt-HALL-5 .cast-btn.wide{min-height:48px;margin-top:12px}
.opt-HALL-5 .fields{display:grid;gap:16px;margin-top:26px;width:100%;text-align:left}
.opt-HALL-5 label{font:600 12px var(--font-body);letter-spacing:.14em;text-transform:uppercase;display:grid;gap:7px;color:var(--muted)}
.opt-HALL-5 input{height:54px;border:0;border-bottom:2px solid var(--ink);background:transparent;color:var(--ink);padding:0 4px;font-family:var(--font-display);font-size:20px}
.opt-HALL-5 .code{letter-spacing:.24em;text-transform:uppercase}
.opt-HALL-5 .marquee{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:16px 0;margin-top:24px;width:100%}.opt-HALL-5 .marquee small{font:600 12px var(--font-body);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}.opt-HALL-5 .marquee strong{display:block;font:900 60px/.9 var(--font-display);letter-spacing:.06em;margin-top:8px;color:var(--curtain)}
.opt-HALL-5 .castlist{list-style:none;padding:0;margin:18px 0 0;width:100%;display:grid;gap:6px;text-align:left}
.opt-HALL-5 .person{display:flex;align-items:center;justify-content:space-between;min-height:46px;border-bottom:1px solid var(--line);padding:0 2px}.opt-HALL-5 .person b{font-family:var(--font-display);font-weight:700;font-size:20px}.opt-HALL-5 .person span{font:600 10px var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--curtain)}.opt-HALL-5 .away{opacity:.5}
.opt-HALL-5 .cue{font:600 12px var(--font-body);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-top:22px}
.opt-HALL-5 .preceding{font:400 24px/1.3 var(--font-display);font-style:italic;margin-top:8px;max-width:28ch}
.opt-HALL-5 .cue-note{font-size:14px;font-style:italic;color:var(--muted);margin-top:12px}
.opt-HALL-5 .prog-title{margin-top:12px}
.opt-HALL-5 .progress{color:var(--curtain)}
.opt-HALL-5 .slotrow{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;justify-content:center}
.opt-HALL-5 .slot{min-width:48px;height:54px;padding:0 14px;display:inline-grid;place-items:center;border:2px solid var(--ink);font-family:var(--font-display);font-weight:700;font-size:19px}.opt-HALL-5 .slot.filled{background:var(--ink);color:var(--cream)}
.opt-HALL-5 .onstage{list-style:none;padding:0;margin:18px auto;display:flex;gap:8px;justify-content:center}.opt-HALL-5 .onstage li{border:2px solid var(--curtain);padding:8px 16px;font-family:var(--font-display);font-weight:700;font-size:18px}
.opt-HALL-5 .nextreader{font-size:14px;font-style:italic;color:var(--muted);margin-bottom:10px}
.opt-HALL-5 .poemblock,.opt-HALL-5 .readblock{list-style:none;padding:0;margin:14px auto 0;max-width:322px;width:100%;text-align:left}
.opt-HALL-5 .poemblock li,.opt-HALL-5 .readblock li{display:grid;grid-template-columns:2.6ch 1fr auto;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}
.opt-HALL-5 .rl-no{font-family:var(--font-display);font-weight:700;font-size:13px;color:var(--curtain)}
.opt-HALL-5 .rl-text{font:400 18px/1.3 var(--font-body);min-width:0;overflow-wrap:anywhere}
.opt-HALL-5 .rl-by{font:600 10px var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:right;white-space:nowrap}
.opt-HALL-5 .readblock li{padding:8px 0}.opt-HALL-5 .readblock .rl-text{font-size:25px;line-height:1.28;font-family:var(--font-display)}
.opt-HALL-5 .readblock li.rl-next .rl-text{color:var(--curtain);font-style:italic;border-bottom:2px dashed var(--curtain);padding-bottom:4px}
.opt-HALL-5 .lineup{list-style:none;padding:0;margin:10px auto 0;max-width:322px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:left}
.opt-HALL-5 .lineup li{border:1px solid var(--line);padding:8px 10px;display:flex;flex-direction:column;gap:2px}.opt-HALL-5 .lineup b{font-family:var(--font-display);font-weight:700;font-size:16px}.opt-HALL-5 .lineup span{font-size:11px;color:var(--muted);font-style:italic}
@media (hover:hover){.opt-HALL-5 .lead-btn:hover{filter:brightness(1.08)}.opt-HALL-5 .cast-btn:hover{background:var(--ink);color:var(--cream)}}
@media (prefers-reduced-motion:no-preference){.opt-HALL-5 h1,.opt-HALL-5 .marquee strong{animation:h5rise 460ms cubic-bezier(.2,.8,.2,1) both}.opt-HALL-5 .readblock li{animation:h5rise 380ms cubic-bezier(.2,.8,.2,1) both}@keyframes h5rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:reduce){.opt-HALL-5 *{animation:none!important;transition:none!important}}
`;

  function h5(screen, corpus) {
    var c = corpus;
    if (screen === 'home') return '<main class="bill"><p class="troupe">THE LINEJAM PLAYERS PRESENT</p><h1>A Poem in<br>Nine Voices</h1><p class="sub">Tonight only, in this room.</p><div class="rule"></div><div class="marquee-cta"><button class="lead-btn">Raise the curtain</button><button class="cast-btn">Join the cast</button></div></main>';
    if (screen === 'join') return '<main class="bill"><p class="troupe">TAKE YOUR PLACE</p><h2>Sign the<br>call sheet.</h2><form class="fields"><label>ROOM CODE<input class="code" value="' + c.roomCode + '" aria-label="Room code"></label><label>YOUR NAME<input value="Maya" aria-label="Your name"></label></form><div class="marquee-cta"><button class="lead-btn">Enter ' + c.roomCode + '</button></div></main>';
    if (screen === 'lobby') return '<main class="bill"><p class="troupe">TONIGHT&#39;S CAST</p><div class="marquee"><small>ROOM CODE</small><strong>' + c.roomCode + '</strong></div><ul class="castlist">' + people(c) + '</ul><button class="cast-btn wide">Cast Bashō</button><div class="marquee-cta"><button class="lead-btn">Begin the performance</button></div></main>';
    if (screen === 'write') return '<main class="bill"><p class="troupe">ACT ' + c.game.round + ' OF ' + c.game.totalRounds + ' · FIVE WORDS</p><p class="cue">The line before you</p><p class="preceding">' + c.game.previousLine + '</p><div class="slotrow">' + slots(c) + '</div><p class="cue-note">' + c.game.draft + ' · four of ' + c.game.wordsThisRound + '</p><div class="marquee-cta"><button class="lead-btn">Deliver your line</button></div></main>';
    if (screen === 'wait') return '<main class="bill"><p class="troupe">YOUR LINE IS DELIVERED</p><h2>A short<br>intermission.</h2><p class="sub">Theo and Ravi are still on their lines. The house waits.</p><ul class="onstage"><li>Theo</li><li>Ravi</li></ul><div class="marquee-cta"><button class="cast-btn">I am still here</button></div></main>';
    if (screen === 'reveal') return '<main class="bill"><p class="troupe">THE PROGRAM</p><h2 class="prog-title">' + c.poem.title + '</h2>' + revealPoem(c) + '<p class="cue">Reading order</p>' + lineup(c) + '<div class="marquee-cta"><button class="lead-btn">Begin the reading</button></div></main>';
    return '<main class="bill read"><p class="troupe">NOW READING · <span class="progress">POEM ' + c.reading.position + ' OF ' + c.reading.total + '</span></p><h2 class="prog-title">' + c.reading.reader + ' at the podium</h2>' + readCeremony(c) + '<div class="marquee-cta"><p class="nextreader">' + c.reading.nextReader + ' reads next · line ' + c.reading.revealedLines + ' of ' + c.poem.lines.length + '</p><button class="lead-btn">Reveal next line</button></div></main>';
  }

  /* ---- register ---- */
  function wire(fn, screen) {
    return function (el, corpus) { el.innerHTML = fn(screen, corpus); };
  }
  function screens(fn) {
    return { home: wire(fn, 'home'), join: wire(fn, 'join'), lobby: wire(fn, 'lobby'), write: wire(fn, 'write'), wait: wire(fn, 'wait'), reveal: wire(fn, 'reveal'), read: wire(fn, 'read') };
  }

  window.LANE_SPECS['HALL-1'] = { lane: 'hall', title: 'Pass the Map', move: 'Keep the visible-route handoff system; retire the mess metaphor, grow the word slots so no word clips, and land the finale as a fixed-margin read-aloud ceremony.', css: css1, screens: screens(h1) };
  window.LANE_SPECS['HALL-3'] = { lane: 'hall', title: 'Poem Catalog', move: 'Hold the edition-card catalogue and add a full-poem reveal plus a legible ceremony read screen, all on one alignment law.', css: css3, screens: screens(h3) };
  window.LANE_SPECS['HALL-4'] = { lane: 'hall', title: 'First Edition', move: 'Iterate the catalogue into a fine-press zine: dark ink stock, Anton plates, folio/colophon anatomy, and a reveal-then-read ceremony that unveils an edition line by line.', css: css4, screens: screens(h4) };
  window.LANE_SPECS['HALL-5'] = { lane: 'hall', title: 'Playbill', move: 'Fresh seed: a centered theatrical playbill where the cast is the roster and the read-aloud is the marquee performance, seeded as a selectable theme.', css: css5, screens: screens(h5) };
}());
