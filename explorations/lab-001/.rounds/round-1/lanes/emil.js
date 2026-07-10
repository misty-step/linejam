// Lane: emil — fluid physical interaction (Apple "Designing Fluid Interfaces" + Emil Kowalski craft).
// Three coherent systems. Physics expressed through spatial continuity, sheet/fold
// material metaphors, springy interaction transitions, and gesture affordances that
// read even in a still frame. Every option scoped under .opt-EMIL-N. Classic IIFE.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // Shared tiny spring easing (overshoot for momentum moments only).
  var SPRING = 'cubic-bezier(0.34, 1.4, 0.5, 1)';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // -------------------------------------------------------------------------
  // EMIL-1 — SHEETS. Every navigation is a bottom sheet rising into the thumb
  // zone over a persistent paper base; enter and exit share one vertical path.
  // Translucent material chrome, drag-handle affordance, springy word-slot fill.
  // -------------------------------------------------------------------------
  var css1 =
    "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=IBM+Plex+Sans:wght@400;500;600&display=swap');" +
    '.opt-EMIL-1{--paper:#f2ece1;--ink:#1a1611;--sub:#726858;--line:rgba(26,22,17,.1);--seal:#d0442b;--sealSoft:rgba(208,68,43,.12);--lift:#fffdf8;font-family:"IBM Plex Sans",system-ui,sans-serif;color:var(--ink);background:radial-gradient(120% 80% at 50% -10%,#f7f2e8,#eae1d2);}' +
    '.opt-EMIL-1 .wrap{height:100%;display:flex;flex-direction:column;position:relative;}' +
    '.opt-EMIL-1 .disp{font-family:"Fraunces",serif;font-optical-sizing:auto;line-height:1.02;letter-spacing:-.02em;font-weight:600;}' +
    '.opt-EMIL-1 .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sub);font-weight:600;}' +
    '.opt-EMIL-1 .base{flex:1;padding:56px 26px 20px;display:flex;flex-direction:column;}' +
    '.opt-EMIL-1 .brand{font-size:56px;color:var(--ink);}' +
    '.opt-EMIL-1 .brand em{font-style:normal;color:var(--seal);}' +
    '.opt-EMIL-1 .tag{font-size:17px;color:var(--sub);margin-top:14px;max-width:16ch;line-height:1.35;}' +
    // Rising sheet — translucent material, drag handle, thumb-anchored.
    '.opt-EMIL-1 .sheet{position:absolute;left:0;right:0;bottom:0;background:rgba(255,253,248,.82);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-top:1px solid rgba(255,255,255,.7);border-radius:26px 26px 0 0;box-shadow:0 -18px 44px rgba(45,30,15,.18);padding:12px 22px calc(20px + env(safe-area-inset-bottom));touch-action:none;animation:e1rise .5s ' +
    SPRING +
    ' both;}' +
    '@keyframes e1rise{from{transform:translateY(64px);opacity:.4}to{transform:translateY(0);opacity:1}}' +
    '.opt-EMIL-1 .handle{width:40px;height:5px;border-radius:3px;background:rgba(26,22,17,.22);margin:2px auto 16px;cursor:grab;}' +
    '.opt-EMIL-1 .sheet.tall{top:74px;bottom:0;overflow:auto;}' +
    '.opt-EMIL-1 .btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;border-radius:16px;font-size:17px;font-weight:600;border:none;cursor:pointer;font-family:inherit;transition:transform .12s ease;}' +
    '.opt-EMIL-1 .btn:active{transform:scale(.975);}' +
    '.opt-EMIL-1 .btn.fill{background:var(--seal);color:#fff;box-shadow:0 8px 20px rgba(208,68,43,.28);}' +
    '.opt-EMIL-1 .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);margin-top:10px;}' +
    '.opt-EMIL-1 .field{width:100%;min-height:56px;border-radius:14px;border:1.5px solid var(--line);background:#fffefb;padding:0 16px;font-size:17px;font-family:inherit;color:var(--ink);}' +
    '.opt-EMIL-1 .field:focus{outline:none;border-color:var(--seal);box-shadow:0 0 0 4px var(--sealSoft);}' +
    // Code slots
    '.opt-EMIL-1 .code{display:flex;gap:10px;margin:6px 0 18px;}' +
    '.opt-EMIL-1 .cslot{flex:1;aspect-ratio:1/1.2;border-radius:14px;border:1.5px solid var(--line);background:#fffefb;display:grid;place-items:center;font-family:"Fraunces",serif;font-weight:600;font-size:30px;}' +
    '.opt-EMIL-1 .cslot.on{border-color:var(--seal);background:var(--sealSoft);}' +
    // Lobby
    '.opt-EMIL-1 .bigcode{font-family:"Fraunces",serif;font-weight:900;font-size:76px;letter-spacing:.06em;color:var(--ink);line-height:1;}' +
    '.opt-EMIL-1 .plist{display:flex;flex-direction:column;gap:2px;margin:6px 0;}' +
    '.opt-EMIL-1 .prow{display:flex;align-items:center;gap:12px;padding:13px 4px;border-bottom:1px solid var(--line);}' +
    '.opt-EMIL-1 .dot{width:9px;height:9px;border-radius:50%;flex:none;}' +
    '.opt-EMIL-1 .dot.on{background:#3a9a5b;box-shadow:0 0 0 3px rgba(58,154,91,.18);}' +
    '.opt-EMIL-1 .dot.off{background:#c9c1b4;}' +
    '.opt-EMIL-1 .pname{font-size:17px;font-weight:500;flex:1;}' +
    '.opt-EMIL-1 .badge{font-size:11px;font-weight:600;letter-spacing:.04em;padding:3px 9px;border-radius:999px;background:var(--sealSoft);color:var(--seal);}' +
    '.opt-EMIL-1 .badge.ai{background:rgba(26,22,17,.07);color:var(--sub);}' +
    '.opt-EMIL-1 .addbot{display:flex;align-items:center;gap:10px;padding:14px 4px;color:var(--sub);font-size:15px;font-weight:500;cursor:pointer;}' +
    '.opt-EMIL-1 .addbot span{width:34px;height:34px;border-radius:50%;border:1.5px dashed var(--line);display:grid;place-items:center;font-size:20px;color:var(--seal);}' +
    // Write
    '.opt-EMIL-1 .prog{display:flex;align-items:baseline;gap:10px;color:var(--sub);font-size:13px;font-weight:600;letter-spacing:.02em;}' +
    '.opt-EMIL-1 .prog b{font-family:"Fraunces",serif;font-size:22px;color:var(--ink);font-weight:600;}' +
    '.opt-EMIL-1 .peek{position:relative;margin:18px 0 8px;padding:22px 20px;border-radius:18px;background:#fffefb;border:1px solid var(--line);box-shadow:0 10px 26px rgba(45,30,15,.08);}' +
    '.opt-EMIL-1 .peek:before{content:"passed to you";position:absolute;top:-9px;left:18px;background:var(--seal);color:#fff;font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;padding:3px 9px;border-radius:999px;}' +
    '.opt-EMIL-1 .peekline{font-family:"Fraunces",serif;font-size:26px;line-height:1.2;letter-spacing:-.01em;}' +
    '.opt-EMIL-1 .slots{display:flex;gap:7px;margin:16px 0 10px;flex-wrap:wrap;}' +
    '.opt-EMIL-1 .slot{height:12px;flex:1;min-width:44px;border-radius:6px;background:rgba(26,22,17,.08);transition:background .25s ' +
    SPRING +
    ',transform .25s ' +
    SPRING +
    ';}' +
    '.opt-EMIL-1 .slot.f{background:var(--seal);transform:scaleY(1.15);}' +
    '.opt-EMIL-1 .cnt{font-size:13px;color:var(--sub);font-weight:600;}' +
    '.opt-EMIL-1 .cnt b{color:var(--seal);}' +
    // Wait
    '.opt-EMIL-1 .waiticon{width:76px;height:76px;border-radius:50%;background:var(--sealSoft);display:grid;place-items:center;font-size:34px;margin:0 auto 6px;animation:e1pop .5s ' +
    SPRING +
    ' both;}' +
    '@keyframes e1pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}' +
    '.opt-EMIL-1 .pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--seal);margin-right:7px;animation:e1blink 1.1s ease-in-out infinite;}' +
    '@keyframes e1blink{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}' +
    // Reveal
    '.opt-EMIL-1 .queue{display:flex;flex-direction:column;gap:9px;margin:12px 0 18px;}' +
    '.opt-EMIL-1 .qrow{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:14px;background:#fffefb;border:1px solid var(--line);}' +
    '.opt-EMIL-1 .qrow .num{font-family:"Fraunces",serif;font-size:18px;color:var(--seal);font-weight:600;}' +
    '.opt-EMIL-1 .qrow .r{margin-left:auto;font-size:13px;color:var(--sub);}' +
    '.opt-EMIL-1 .qrow .r b{color:var(--ink);}' +
    '.opt-EMIL-1 .poem{padding:8px 4px 20px;}' +
    '.opt-EMIL-1 .pline{padding:11px 0;border-bottom:1px solid var(--line);}' +
    '.opt-EMIL-1 .pline .t{font-family:"Fraunces",serif;font-size:23px;line-height:1.25;letter-spacing:-.01em;}' +
    '.opt-EMIL-1 .pline .a{font-size:12px;color:var(--sub);margin-top:3px;letter-spacing:.03em;}' +
    '.opt-EMIL-1 .swipehint{text-align:center;color:var(--sub);font-size:13px;margin-top:14px;}' +
    '@media (prefers-reduced-motion: reduce){.opt-EMIL-1 *{animation:none!important;}.opt-EMIL-1 .sheet{animation:none!important;}.opt-EMIL-1 .slot{transition:background .2s ease!important;transform:none!important;}}';

  function e1PlayerRows(corpus) {
    return corpus.players
      .map(function (p) {
        var badge = p.host
          ? '<span class="badge">host</span>'
          : p.kind === 'ai'
            ? '<span class="badge ai">basho bot</span>'
            : '';
        return (
          '<div class="prow"><span class="dot ' +
          (p.present ? 'on' : 'off') +
          '"></span><span class="pname">' +
          esc(p.name) +
          '</span>' +
          badge +
          '</div>'
        );
      })
      .join('');
  }

  function e1DragSheet(el) {
    var sheet = el.querySelector('.sheet');
    if (!sheet) return;
    var handle = sheet.querySelector('.handle');
    if (!handle) return;
    var startY = 0,
      dy = 0,
      dragging = false;
    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      handle.setPointerCapture(e.pointerId);
      sheet.style.transition = 'none';
      handle.style.cursor = 'grabbing';
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = e.clientY - startY;
      // Rubber-band: resist upward, follow downward.
      var v = dy < 0 ? dy * 0.28 : dy * 0.6;
      sheet.style.transform = 'translateY(' + v + 'px)';
    });
    function release() {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = 'grab';
      sheet.style.transition = 'transform .5s ' + SPRING;
      sheet.style.transform = 'translateY(0)';
    }
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);
  }

  function e1WireWordFill(el) {
    var input = el.querySelector('.field.line');
    var slots = el.querySelectorAll('.slot');
    var cnt = el.querySelector('.cnt b');
    if (!input || !slots.length) return;
    function paint() {
      var words = input.value.trim().length
        ? input.value.trim().split(/\s+/)
        : [];
      slots.forEach(function (s, i) {
        s.classList.toggle('f', i < words.length);
      });
      if (cnt) cnt.textContent = Math.min(words.length, slots.length);
    }
    input.addEventListener('input', paint);
    paint();
  }

  var screens1 = {
    home: function (el) {
      el.innerHTML =
        '<div class="wrap"><div class="base">' +
        '<div class="eyebrow">poems by committee</div>' +
        '<h1 class="brand disp">Line<em>jam</em></h1>' +
        '<p class="tag">Pass the poem around the room, one line at a time.</p>' +
        '</div>' +
        '<div class="sheet"><div class="handle"></div>' +
        '<button class="btn fill">Start a game</button>' +
        '<button class="btn ghost">Join a room</button>' +
        '</div></div>';
      e1DragSheet(el);
    },
    join: function (el, corpus) {
      var chars = corpus.roomCode.split('');
      el.innerHTML =
        '<div class="wrap"><div class="base">' +
        '<div class="eyebrow">step into</div>' +
        '<h1 class="brand disp" style="font-size:44px">A room</h1>' +
        '</div>' +
        '<div class="sheet"><div class="handle"></div>' +
        '<div class="eyebrow" style="margin-bottom:8px">room code</div>' +
        '<div class="code">' +
        chars
          .map(function (c, i) {
            return (
              '<div class="cslot ' + (i < 4 ? 'on' : '') + '">' + esc(c) + '</div>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="eyebrow" style="margin-bottom:8px">your pen name</div>' +
        '<input class="field" value="Theo" style="margin-bottom:14px" />' +
        '<button class="btn fill">Join ' +
        esc(corpus.roomCode) +
        '</button>' +
        '</div></div>';
      e1DragSheet(el);
    },
    lobby: function (el, corpus) {
      el.innerHTML =
        '<div class="wrap"><div class="base" style="padding-bottom:0">' +
        '<div class="eyebrow">show this across the table</div>' +
        '<div class="bigcode">' +
        esc(corpus.roomCode) +
        '</div>' +
        '<p class="tag" style="margin-top:8px">Friends type it to drop in.</p>' +
        '</div>' +
        '<div class="sheet tall"><div class="handle"></div>' +
        '<div class="plist">' +
        e1PlayerRows(corpus) +
        '<div class="addbot"><span>+</span>Add a Basho bot</div>' +
        '</div>' +
        '<button class="btn fill" style="margin-top:8px">Start the jam</button>' +
        '</div></div>';
      e1DragSheet(el);
    },
    write: function (el, corpus) {
      var n = corpus.game.wordsThisRound;
      var slots = '';
      for (var i = 0; i < n; i++) slots += '<div class="slot"></div>';
      el.innerHTML =
        '<div class="wrap"><div class="base" style="padding-bottom:0">' +
        '<div class="prog"><b>Round ' +
        corpus.game.round +
        '</b> of ' +
        corpus.game.totalRounds +
        ' &middot; write ' +
        n +
        ' words</div>' +
        '<div class="peek"><div class="peekline">' +
        esc(corpus.game.previousLine) +
        '</div></div>' +
        '<p class="cnt" style="margin-top:12px">This is all you get. Answer it.</p>' +
        '</div>' +
        '<div class="sheet"><div class="handle"></div>' +
        '<div class="slots">' +
        slots +
        '</div>' +
        '<div class="cnt" style="margin-bottom:12px"><b>0</b> of ' +
        n +
        ' words</div>' +
        '<input class="field line" placeholder="your line" value="' +
        esc(corpus.game.draft) +
        '" style="margin-bottom:12px" />' +
        '<button class="btn fill">Pass it on</button>' +
        '</div></div>';
      e1WireWordFill(el);
      e1DragSheet(el);
    },
    wait: function (el, corpus) {
      el.innerHTML =
        '<div class="wrap"><div class="base" style="justify-content:center;text-align:center;align-items:center">' +
        '<div class="waiticon">&#10003;</div>' +
        '<h1 class="disp" style="font-size:34px;margin-top:6px">Your line is in</h1>' +
        '<p class="tag" style="text-align:center;max-width:20ch;margin-top:10px">Nobody sees it yet. That is the fun part.</p>' +
        '</div>' +
        '<div class="sheet"><div class="handle"></div>' +
        '<div style="display:flex;align-items:center;font-size:16px;font-weight:500"><span class="pulse"></span>' +
        esc(corpus.game.waitingOn[0]) +
        ' is still writing</div>' +
        '<p class="cnt" style="margin-top:8px">Round ' +
        corpus.game.round +
        ' of ' +
        corpus.game.totalRounds +
        ' closes when everyone lands.</p>' +
        '</div></div>';
      e1DragSheet(el);
    },
    reveal: function (el, corpus) {
      var q = corpus.revealQueue
        .map(function (item, i) {
          return (
            '<div class="qrow"><span class="num">' +
            String(i + 1).padStart(2, '0') +
            '</span><span style="font-weight:500">' +
            esc(item.poem) +
            '</span><span class="r">read by <b>' +
            esc(item.reader) +
            '</b></span></div>'
          );
        })
        .join('');
      var lines = corpus.poem.lines
        .map(function (l) {
          return (
            '<div class="pline"><div class="t">' +
            esc(l.text) +
            '</div><div class="a">' +
            esc(l.author) +
            '</div></div>'
          );
        })
        .join('');
      el.innerHTML =
        '<div class="wrap"><div class="base" style="overflow:auto;padding-top:44px">' +
        '<div class="eyebrow">the reading</div>' +
        '<h1 class="disp" style="font-size:32px;margin:4px 0 2px">Read them aloud</h1>' +
        '<div class="queue">' +
        q +
        '</div>' +
        '<div class="peek" style="margin:0 0 10px"><div class="eyebrow" style="color:var(--seal)">now reading &middot; ' +
        esc(corpus.poem.title) +
        '</div></div>' +
        '<div class="poem">' +
        lines +
        '</div>' +
        '<p class="swipehint">Swipe up for Poem 02 &uarr;</p>' +
        '</div></div>';
    },
  };

  window.LANE_SPECS['EMIL-1'] = {
    lane: 'emil',
    title: 'Sheets',
    move: 'Every navigation is a translucent bottom sheet rising into the thumb zone; enter and exit share one vertical path.',
    css: css1,
    screens: screens1,
  };

  // -------------------------------------------------------------------------
  // EMIL-2 — REEL. Inverts two load-bearing assumptions: the text input becomes
  // N physical word bays (the constraint is spatial, not a counter), and chrome
  // leaves the top for a horizontal momentum track. Rounds and reveal advance
  // by swipe; velocity/direction telegraphed by chevrons and a filling reel.
  // -------------------------------------------------------------------------
  var css2 =
    "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&display=swap');" +
    '.opt-EMIL-2{--bg:#f6f7fb;--ink:#0f1320;--sub:#59627a;--line:rgba(15,19,32,.12);--volt:#2a45e6;--voltSoft:rgba(42,69,230,.1);--spark:#ff5a1f;font-family:"Space Grotesk",system-ui,sans-serif;color:var(--ink);background:var(--bg);}' +
    '.opt-EMIL-2 .wrap{height:100%;display:flex;flex-direction:column;padding:22px 22px calc(20px + env(safe-area-inset-bottom));}' +
    '.opt-EMIL-2 .mono{font-family:"IBM Plex Mono",monospace;}' +
    // Horizontal reel track (chrome moved off the top).
    '.opt-EMIL-2 .track{display:flex;gap:6px;align-items:center;flex:none;}' +
    '.opt-EMIL-2 .tick{height:5px;flex:1;border-radius:3px;background:var(--line);transition:background .3s ' +
    SPRING +
    ';}' +
    '.opt-EMIL-2 .tick.done{background:var(--ink);}' +
    '.opt-EMIL-2 .tick.now{background:var(--volt);box-shadow:0 0 0 3px var(--voltSoft);}' +
    '.opt-EMIL-2 .tracklabel{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--sub);letter-spacing:.06em;margin-top:8px;flex:none;}' +
    '.opt-EMIL-2 .body{flex:1;display:flex;flex-direction:column;justify-content:center;}' +
    '.opt-EMIL-2 .foot{flex:none;}' +
    '.opt-EMIL-2 h1{font-weight:700;letter-spacing:-.03em;line-height:.96;}' +
    '.opt-EMIL-2 .huge{font-size:64px;}' +
    '.opt-EMIL-2 .kicker{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--volt);font-weight:600;}' +
    '.opt-EMIL-2 .lede{font-size:17px;color:var(--sub);margin-top:14px;line-height:1.35;max-width:20ch;}' +
    '.opt-EMIL-2 .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;border-radius:14px;font-size:17px;font-weight:600;border:none;cursor:pointer;font-family:inherit;transition:transform .12s ease;}' +
    '.opt-EMIL-2 .btn:active{transform:scale(.975);}' +
    '.opt-EMIL-2 .btn.fill{background:var(--volt);color:#fff;box-shadow:0 8px 22px rgba(42,69,230,.3);}' +
    '.opt-EMIL-2 .btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line);margin-top:10px;}' +
    '.opt-EMIL-2 .field{width:100%;min-height:54px;border-radius:12px;border:1.5px solid var(--line);background:#fff;padding:0 15px;font-size:17px;font-family:inherit;color:var(--ink);}' +
    '.opt-EMIL-2 .field:focus{outline:none;border-color:var(--volt);box-shadow:0 0 0 4px var(--voltSoft);}' +
    // Code bays
    '.opt-EMIL-2 .bays{display:flex;gap:8px;}' +
    '.opt-EMIL-2 .bay{flex:1;aspect-ratio:1/1.15;border-radius:12px;border:2px solid var(--line);background:#fff;display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:30px;}' +
    '.opt-EMIL-2 .bay.on{border-color:var(--volt);color:var(--volt);}' +
    // Lobby seats reel
    '.opt-EMIL-2 .code2{font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:82px;letter-spacing:.08em;line-height:1;}' +
    '.opt-EMIL-2 .seats{display:flex;gap:10px;overflow-x:auto;padding:6px 0 10px;margin:0 -22px;padding-left:22px;padding-right:22px;scroll-snap-type:x mandatory;}' +
    '.opt-EMIL-2 .seat{flex:none;width:118px;scroll-snap-align:start;border-radius:16px;padding:16px 14px;background:#fff;border:1.5px solid var(--line);}' +
    '.opt-EMIL-2 .seat.here{border-color:var(--volt);}' +
    '.opt-EMIL-2 .avatar{width:42px;height:42px;border-radius:12px;background:var(--voltSoft);color:var(--volt);display:grid;place-items:center;font-weight:700;font-size:18px;margin-bottom:12px;}' +
    '.opt-EMIL-2 .seat.away .avatar{background:#eceef4;color:#9aa1b3;}' +
    '.opt-EMIL-2 .seat .nm{font-weight:600;font-size:16px;}' +
    '.opt-EMIL-2 .seat .st{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.04em;color:var(--sub);margin-top:3px;}' +
    '.opt-EMIL-2 .seat.here .st{color:var(--volt);}' +
    '.opt-EMIL-2 .seat.add{border-style:dashed;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;color:var(--sub);cursor:pointer;}' +
    '.opt-EMIL-2 .seat.add .avatar{background:transparent;border:1.5px dashed var(--line);color:var(--volt);}' +
    // Write — word bays are the signature
    '.opt-EMIL-2 .ctx{font-size:12px;font-family:"IBM Plex Mono",monospace;letter-spacing:.08em;color:var(--sub);text-transform:uppercase;}' +
    '.opt-EMIL-2 .prev{font-size:28px;font-weight:500;letter-spacing:-.02em;line-height:1.15;margin:8px 0 26px;padding-left:14px;border-left:3px solid var(--volt);}' +
    '.opt-EMIL-2 .wbays{display:flex;gap:8px;margin-bottom:14px;}' +
    '.opt-EMIL-2 .wbay{flex:1;height:66px;border-radius:12px;border:2px dashed var(--line);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;background:#fff;transition:transform .28s ' +
    SPRING +
    ',border-color .2s ease,background .2s ease;}' +
    '.opt-EMIL-2 .wbay .ix{font-family:"IBM Plex Mono",monospace;font-size:10px;color:#aab0c0;}' +
    '.opt-EMIL-2 .wbay .wd{font-size:15px;font-weight:600;color:var(--ink);max-width:100%;overflow:hidden;text-overflow:ellipsis;}' +
    '.opt-EMIL-2 .wbay.filled{border-style:solid;border-color:var(--volt);background:var(--voltSoft);transform:translateY(-3px);}' +
    '.opt-EMIL-2 .wbay.next{border-color:var(--spark);animation:e2wig 1.2s ease-in-out infinite;}' +
    '@keyframes e2wig{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}' +
    '.opt-EMIL-2 .swrow{display:flex;align-items:center;justify-content:space-between;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--sub);margin-bottom:14px;}' +
    // Wait
    '.opt-EMIL-2 .check{width:70px;height:70px;border-radius:18px;background:var(--volt);color:#fff;display:grid;place-items:center;font-size:34px;margin-bottom:22px;animation:e2land .5s ' +
    SPRING +
    ' both;}' +
    '@keyframes e2land{from{transform:translateY(30px) scale(.7);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}' +
    '.opt-EMIL-2 .waitrow{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:500;margin-top:8px;}' +
    '.opt-EMIL-2 .spark{width:9px;height:9px;border-radius:50%;background:var(--spark);animation:e2blink 1s ease-in-out infinite;}' +
    '@keyframes e2blink{0%,100%{opacity:.25}50%{opacity:1}}' +
    // Reveal
    '.opt-EMIL-2 .qcard{display:flex;gap:14px;overflow-x:auto;margin:0 -22px 20px;padding:0 22px;scroll-snap-type:x mandatory;}' +
    '.opt-EMIL-2 .qc{flex:none;width:210px;scroll-snap-align:start;border-radius:16px;padding:16px;background:#fff;border:1.5px solid var(--line);}' +
    '.opt-EMIL-2 .qc .n{font-family:"IBM Plex Mono",monospace;color:var(--volt);font-size:13px;}' +
    '.opt-EMIL-2 .qc .pt{font-size:20px;font-weight:700;margin:4px 0 10px;}' +
    '.opt-EMIL-2 .qc .rd{font-size:13px;color:var(--sub);}' +
    '.opt-EMIL-2 .qc .rd b{color:var(--ink);}' +
    '.opt-EMIL-2 .rline{padding:12px 0;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:12px;}' +
    '.opt-EMIL-2 .rline .rt{font-size:22px;font-weight:500;letter-spacing:-.01em;flex:1;line-height:1.2;}' +
    '.opt-EMIL-2 .rline .ra{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--sub);flex:none;}' +
    '.opt-EMIL-2 .scrollbody{flex:1;overflow:auto;}' +
    '@media (prefers-reduced-motion: reduce){.opt-EMIL-2 *{animation:none!important;}.opt-EMIL-2 .wbay{transition:border-color .2s ease,background .2s ease!important;transform:none!important;}}';

  function e2WireBays(el) {
    var input = el.querySelector('.field.line');
    var bays = el.querySelectorAll('.wbay');
    var used = el.querySelector('.usedcount');
    if (!input || !bays.length) return;
    function paint() {
      var words = input.value.trim().length
        ? input.value.trim().split(/\s+/)
        : [];
      bays.forEach(function (b, i) {
        var wd = b.querySelector('.wd');
        if (i < words.length) {
          b.classList.add('filled');
          b.classList.remove('next');
          if (wd) wd.textContent = words[i];
        } else {
          b.classList.remove('filled');
          if (wd) wd.textContent = '';
          b.classList.toggle('next', i === words.length);
        }
      });
      if (used) used.textContent = Math.min(words.length, bays.length);
    }
    input.addEventListener('input', paint);
    paint();
  }

  var screens2 = {
    home: function (el) {
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track">' +
        [0, 1, 2, 3, 4]
          .map(function (i) {
            return '<div class="tick ' + (i === 0 ? 'now' : '') + '"></div>';
          })
          .join('') +
        '</div><div class="tracklabel">the reel &middot; 9 lines, one room</div>' +
        '<div class="body">' +
        '<div class="kicker">exquisite corpse, out loud</div>' +
        '<h1 class="huge">LINE<br>JAM</h1>' +
        '<p class="lede">One line each. You only see the line before yours.</p>' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Start a game &rarr;</button>' +
        '<button class="btn ghost">Join a room</button></div></div>';
    },
    join: function (el, corpus) {
      var chars = corpus.roomCode.split('');
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track"><div class="tick now"></div><div class="tick"></div><div class="tick"></div><div class="tick"></div><div class="tick"></div></div>' +
        '<div class="tracklabel">joining</div>' +
        '<div class="body">' +
        '<div class="kicker">room code</div>' +
        '<div class="bays" style="margin:12px 0 24px">' +
        chars
          .map(function (c, i) {
            return '<div class="bay ' + (i < 4 ? 'on' : '') + '">' + esc(c) + '</div>';
          })
          .join('') +
        '</div>' +
        '<div class="kicker" style="margin-bottom:8px">pen name</div>' +
        '<input class="field" value="Theo" />' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Slot into ' +
        esc(corpus.roomCode) +
        ' &rarr;</button></div></div>';
    },
    lobby: function (el, corpus) {
      var seats = corpus.players
        .map(function (p) {
          var cls = p.host ? 'here' : p.present ? '' : 'away';
          var st = p.host
            ? 'host'
            : p.kind === 'ai'
              ? 'basho bot'
              : p.present
                ? 'ready'
                : 'away';
          return (
            '<div class="seat ' +
            cls +
            '"><div class="avatar">' +
            esc(p.name[0]) +
            '</div><div class="nm">' +
            esc(p.name) +
            '</div><div class="st">' +
            st +
            '</div></div>'
          );
        })
        .join('');
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track"><div class="tick done"></div><div class="tick now"></div><div class="tick"></div><div class="tick"></div><div class="tick"></div></div>' +
        '<div class="tracklabel">lobby &middot; waiting for the host</div>' +
        '<div class="body" style="justify-content:flex-start;padding-top:14px">' +
        '<div class="kicker">show it across the table</div>' +
        '<div class="code2">' +
        esc(corpus.roomCode) +
        '</div>' +
        '<div class="seats" style="margin-top:18px">' +
        seats +
        '<div class="seat add"><div class="avatar">+</div><div class="nm">Add bot</div><div class="st">Basho</div></div>' +
        '</div>' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Start the jam &rarr;</button></div></div>';
    },
    write: function (el, corpus) {
      var n = corpus.game.wordsThisRound;
      var bays = '';
      for (var i = 0; i < n; i++)
        bays +=
          '<div class="wbay"><span class="ix mono">' +
          (i + 1) +
          '</span><span class="wd"></span></div>';
      var ticks = corpus.wordCounts
        .map(function (_, i) {
          var c =
            i + 1 < corpus.game.round
              ? 'done'
              : i + 1 === corpus.game.round
                ? 'now'
                : '';
          return '<div class="tick ' + c + '"></div>';
        })
        .join('');
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track">' +
        ticks +
        '</div><div class="tracklabel">round ' +
        corpus.game.round +
        ' / ' +
        corpus.game.totalRounds +
        ' &middot; ' +
        n +
        ' words, no more</div>' +
        '<div class="body" style="justify-content:flex-start;padding-top:18px">' +
        '<div class="ctx">the only thing you can see</div>' +
        '<div class="prev">' +
        esc(corpus.game.previousLine) +
        '</div>' +
        '<div class="wbays">' +
        bays +
        '</div>' +
        '<div class="swrow"><span><b class="usedcount" style="color:var(--volt)">0</b> / ' +
        n +
        ' bays</span><span>tap a word to edit</span></div>' +
        '<input class="field line" placeholder="type ' +
        n +
        ' words" value="' +
        esc(corpus.game.draft) +
        '" />' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Send down the line &rarr;</button></div></div>';
      e2WireBays(el);
    },
    wait: function (el, corpus) {
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track"><div class="tick done"></div><div class="tick done"></div><div class="tick done"></div><div class="tick done"></div><div class="tick now"></div></div>' +
        '<div class="tracklabel">round ' +
        corpus.game.round +
        ' &middot; landing</div>' +
        '<div class="body">' +
        '<div class="check">&#10003;</div>' +
        '<h1 style="font-size:38px">Sent.</h1>' +
        '<p class="lede">It is off down the line. You will not see it again until the reveal.</p>' +
        '<div class="waitrow"><span class="spark"></span>' +
        esc(corpus.game.waitingOn[0]) +
        ' is still on the clock</div>' +
        '</div>' +
        '<div class="foot"><button class="btn ghost">Nudge the room</button></div></div>';
    },
    reveal: function (el, corpus) {
      var q = corpus.revealQueue
        .map(function (item, i) {
          return (
            '<div class="qc"><div class="n">' +
            String(i + 1).padStart(2, '0') +
            '</div><div class="pt">' +
            esc(item.poem) +
            '</div><div class="rd">reader <b>' +
            esc(item.reader) +
            '</b></div></div>'
          );
        })
        .join('');
      var lines = corpus.poem.lines
        .map(function (l) {
          return (
            '<div class="rline"><span class="rt">' +
            esc(l.text) +
            '</span><span class="ra">' +
            esc(l.author) +
            '</span></div>'
          );
        })
        .join('');
      el.innerHTML =
        '<div class="wrap">' +
        '<div class="track"><div class="tick done"></div><div class="tick done"></div><div class="tick done"></div><div class="tick done"></div><div class="tick now"></div></div>' +
        '<div class="tracklabel">the reveal &middot; read them out</div>' +
        '<div class="scrollbody" style="margin-top:16px">' +
        '<div class="kicker" style="margin-bottom:10px">reading order</div>' +
        '<div class="qcard">' +
        q +
        '</div>' +
        '<div class="kicker" style="color:var(--ink);margin-bottom:4px">' +
        esc(corpus.poem.title) +
        ' &middot; ' +
        esc(corpus.revealQueue[0].reader) +
        ' reads</div>' +
        lines +
        '</div></div>';
    },
  };

  window.LANE_SPECS['EMIL-2'] = {
    lane: 'emil',
    title: 'Reel',
    move: 'Invert the input into N physical word bays and move chrome off the top into a horizontal momentum track the whole game rides on.',
    css: css2,
    screens: screens2,
  };

  // -------------------------------------------------------------------------
  // EMIL-3 — FOLD. The material IS the paper-folding game. Inverts two things:
  // the reveal is one continuous unfold (not tap-per-poem), and the lobby is a
  // folded sheet with seats along the crease (not a list). While writing you see
  // only the previous line because the paper is literally folded over the rest.
  // Every transition is a crease; fold shadows are functional depth, not decor.
  // -------------------------------------------------------------------------
  var css3 =
    "@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&display=swap');" +
    '.opt-EMIL-3{--paper:#ece3d2;--paper2:#e3d9c4;--ink:#211a10;--sub:#6c6150;--crease:rgba(33,26,16,.16);--seal:#b23524;--sealSoft:rgba(178,53,36,.12);font-family:"IBM Plex Sans",system-ui,sans-serif;color:var(--ink);background:var(--paper);}' +
    '.opt-EMIL-3 .wrap{height:100%;display:flex;flex-direction:column;padding:26px 24px calc(22px + env(safe-area-inset-bottom));position:relative;background:linear-gradient(180deg,#f0e8d8,#e6dcc7);}' +
    '.opt-EMIL-3 .serif{font-family:"Libre Baskerville",Georgia,serif;}' +
    '.opt-EMIL-3 .eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--sub);font-weight:600;}' +
    '.opt-EMIL-3 .body{flex:1;display:flex;flex-direction:column;}' +
    '.opt-EMIL-3 .foot{flex:none;}' +
    // Seal stamp
    '.opt-EMIL-3 .seal{display:inline-grid;place-items:center;width:74px;height:74px;border-radius:14px;background:var(--seal);color:#f3 e6d0;color:#f4ead6;font-family:"Libre Baskerville",serif;font-weight:700;font-size:30px;letter-spacing:.04em;box-shadow:0 6px 16px rgba(178,53,36,.3);transform:rotate(-4deg);}' +
    '.opt-EMIL-3 h1.brand{font-family:"Libre Baskerville",serif;font-weight:700;font-size:52px;line-height:1;letter-spacing:-.01em;margin:22px 0 0;}' +
    '.opt-EMIL-3 .tag{font-size:16px;color:var(--sub);margin-top:14px;line-height:1.4;max-width:20ch;}' +
    '.opt-EMIL-3 .btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;border-radius:4px;font-size:16px;font-weight:600;border:none;cursor:pointer;font-family:inherit;letter-spacing:.01em;transition:transform .12s ease;}' +
    '.opt-EMIL-3 .btn:active{transform:scale(.98);}' +
    '.opt-EMIL-3 .btn.fill{background:var(--ink);color:var(--paper);box-shadow:0 6px 16px rgba(33,26,16,.24);}' +
    '.opt-EMIL-3 .btn.seal{background:var(--seal);color:#f4ead6;box-shadow:0 6px 16px rgba(178,53,36,.28);}' +
    '.opt-EMIL-3 .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--crease);margin-top:10px;}' +
    '.opt-EMIL-3 .field{width:100%;min-height:54px;border:none;border-bottom:2px solid var(--crease);background:transparent;padding:0 2px;font-size:20px;font-family:"Libre Baskerville",serif;color:var(--ink);}' +
    '.opt-EMIL-3 .field:focus{outline:none;border-color:var(--seal);}' +
    // Folded sheet card with crease shadow at top
    '.opt-EMIL-3 .sheetcard{position:relative;border-radius:6px;background:linear-gradient(180deg,#f6efe0,#efe6d3);box-shadow:0 14px 30px rgba(33,26,16,.14),inset 0 1px 0 rgba(255,255,255,.6);padding:26px 22px;}' +
    '.opt-EMIL-3 .crease{height:16px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,rgba(33,26,16,.14),rgba(33,26,16,0));position:relative;}' +
    '.opt-EMIL-3 .crease:after{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:var(--crease);}' +
    // Code slips
    '.opt-EMIL-3 .code{display:flex;gap:10px;margin:8px 0 22px;}' +
    '.opt-EMIL-3 .cslot{flex:1;padding:16px 0;text-align:center;border-radius:4px;background:#f6efe0;border:1px solid var(--crease);font-family:"Libre Baskerville",serif;font-size:30px;font-weight:700;box-shadow:0 3px 8px rgba(33,26,16,.08);}' +
    '.opt-EMIL-3 .cslot.on{border-color:var(--seal);color:var(--seal);}' +
    // Lobby — seats along the fold line
    '.opt-EMIL-3 .foldline{position:relative;margin:20px 0;}' +
    '.opt-EMIL-3 .foldline:before{content:"";position:absolute;left:0;right:0;top:50%;height:0;border-top:2px dashed var(--crease);}' +
    '.opt-EMIL-3 .seatgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;position:relative;}' +
    '.opt-EMIL-3 .seat{display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:6px;background:#f6efe0;box-shadow:0 4px 12px rgba(33,26,16,.1);}' +
    '.opt-EMIL-3 .seat.away{opacity:.5;box-shadow:none;background:transparent;border:1px dashed var(--crease);}' +
    '.opt-EMIL-3 .seat .av{width:34px;height:34px;border-radius:8px;background:var(--sealSoft);color:var(--seal);display:grid;place-items:center;font-weight:700;font-family:"Libre Baskerville",serif;flex:none;}' +
    '.opt-EMIL-3 .seat.away .av{background:rgba(33,26,16,.06);color:var(--sub);}' +
    '.opt-EMIL-3 .seat .nm{font-size:15px;font-weight:500;line-height:1.1;}' +
    '.opt-EMIL-3 .seat .rl{font-size:11px;color:var(--sub);}' +
    '.opt-EMIL-3 .seat.here .rl{color:var(--seal);font-weight:600;}' +
    '.opt-EMIL-3 .seat.add{border:1.5px dashed var(--crease);background:transparent;cursor:pointer;color:var(--sub);}' +
    '.opt-EMIL-3 .seat.add .av{background:transparent;border:1.5px dashed var(--crease);}' +
    // Write — folded, you see only the previous line
    '.opt-EMIL-3 .meta{display:flex;align-items:baseline;gap:8px;}' +
    '.opt-EMIL-3 .meta .r{font-family:"Libre Baskerville",serif;font-size:24px;font-weight:700;}' +
    '.opt-EMIL-3 .meta .of{color:var(--sub);font-size:14px;}' +
    '.opt-EMIL-3 .folded{position:relative;margin:18px 0 10px;}' +
    '.opt-EMIL-3 .hidden-above{height:52px;border-radius:6px 6px 0 0;background:repeating-linear-gradient(180deg,#e7ddc9,#e7ddc9 3px,#e1d6c0 3px,#e1d6c0 6px);box-shadow:inset 0 -10px 14px rgba(33,26,16,.14);position:relative;overflow:hidden;}' +
    '.opt-EMIL-3 .hidden-above:after{content:"8 lines, folded under";position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.08em;color:var(--sub);text-transform:uppercase;}' +
    '.opt-EMIL-3 .exposed{background:#f7f0e1;border-radius:0 0 6px 6px;padding:22px 20px 24px;box-shadow:0 12px 26px rgba(33,26,16,.14);border-top:1.5px solid var(--crease);}' +
    '.opt-EMIL-3 .exposed .lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--seal);font-weight:600;}' +
    '.opt-EMIL-3 .exposed .pl{font-family:"Libre Baskerville",serif;font-size:25px;line-height:1.25;margin-top:8px;}' +
    '.opt-EMIL-3 .wc{display:flex;gap:6px;margin:16px 0 4px;}' +
    '.opt-EMIL-3 .wc i{width:9px;height:9px;border-radius:50%;background:var(--crease);transition:transform .28s ' +
    SPRING +
    ',background .2s ease;font-style:normal;}' +
    '.opt-EMIL-3 .wc i.f{background:var(--seal);transform:scale(1.25);}' +
    '.opt-EMIL-3 .wchint{font-size:13px;color:var(--sub);}' +
    '.opt-EMIL-3 .wchint b{color:var(--seal);}' +
    // Wait
    '.opt-EMIL-3 .foldicon{font-size:44px;margin-bottom:10px;animation:e3crease .55s ' +
    SPRING +
    ' both;transform-origin:top center;}' +
    '@keyframes e3crease{from{transform:perspective(300px) rotateX(-70deg);opacity:0}to{transform:perspective(300px) rotateX(0);opacity:1}}' +
    '.opt-EMIL-3 .stillfold{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:500;margin-top:6px;}' +
    '.opt-EMIL-3 .stillfold i{width:8px;height:8px;border-radius:50%;background:var(--seal);animation:e3blink 1.1s ease-in-out infinite;font-style:normal;}' +
    '@keyframes e3blink{0%,100%{opacity:.3}50%{opacity:1}}' +
    // Reveal — the unfold
    '.opt-EMIL-3 .readers{display:flex;flex-direction:column;gap:8px;margin:12px 0 16px;}' +
    '.opt-EMIL-3 .rr{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:6px;background:#f6efe0;box-shadow:0 3px 10px rgba(33,26,16,.08);}' +
    '.opt-EMIL-3 .rr .n{font-family:"Libre Baskerville",serif;color:var(--seal);font-weight:700;}' +
    '.opt-EMIL-3 .rr .who{margin-left:auto;font-size:13px;color:var(--sub);}' +
    '.opt-EMIL-3 .rr .who b{color:var(--ink);}' +
    '.opt-EMIL-3 .unfold{overflow:hidden;}' +
    '.opt-EMIL-3 .panel{overflow:hidden;max-height:0;opacity:0;transform-origin:top center;transform:perspective(500px) rotateX(-88deg);transition:max-height .5s ' +
    SPRING +
    ',opacity .35s ease,transform .5s ' +
    SPRING +
    ';}' +
    '.opt-EMIL-3 .panel.open{max-height:120px;opacity:1;transform:perspective(500px) rotateX(0);}' +
    '.opt-EMIL-3 .panel .pl{font-family:"Libre Baskerville",serif;font-size:23px;line-height:1.25;padding:11px 0 4px;border-bottom:1px solid var(--crease);}' +
    '.opt-EMIL-3 .panel .au{font-size:11px;color:var(--sub);padding-bottom:9px;letter-spacing:.04em;}' +
    '.opt-EMIL-3 .titlecard{font-family:"Libre Baskerville",serif;font-size:20px;font-weight:700;margin-bottom:4px;}' +
    '.opt-EMIL-3 .scrollbody{flex:1;overflow:auto;}' +
    '@media (prefers-reduced-motion: reduce){.opt-EMIL-3 *{animation:none!important;}.opt-EMIL-3 .panel{transition:opacity .2s ease!important;transform:none!important;}.opt-EMIL-3 .panel.open{max-height:120px;}.opt-EMIL-3 .wc i{transition:background .2s ease!important;transform:none!important;}}';

  function e3WireWordDots(el) {
    var input = el.querySelector('.field.line');
    var dots = el.querySelectorAll('.wc i');
    var hint = el.querySelector('.wchint b');
    if (!input || !dots.length) return;
    function paint() {
      var words = input.value.trim().length
        ? input.value.trim().split(/\s+/)
        : [];
      dots.forEach(function (d, i) {
        d.classList.toggle('f', i < words.length);
      });
      if (hint) hint.textContent = Math.min(words.length, dots.length);
    }
    input.addEventListener('input', paint);
    paint();
  }

  function e3WireUnfold(el) {
    var btn = el.querySelector('.unfoldbtn');
    var panels = el.querySelectorAll('.panel');
    if (!btn || !panels.length) return;
    var reduce =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function openAll() {
      panels.forEach(function (p, i) {
        if (reduce) {
          p.classList.add('open');
        } else {
          setTimeout(function () {
            p.classList.add('open');
          }, i * 140);
        }
      });
      btn.textContent = 'Poem 01, in full';
      btn.disabled = true;
      btn.style.opacity = '.55';
    }
    btn.addEventListener('click', openAll);
  }

  var screens3 = {
    home: function (el) {
      el.innerHTML =
        '<div class="wrap"><div class="body">' +
        '<div style="margin-top:30px"><span class="seal serif">L</span></div>' +
        '<h1 class="brand">Linejam</h1>' +
        '<p class="tag">Fold a poem with the whole table, one line at a time.</p>' +
        '</div>' +
        '<div class="foot">' +
        '<button class="btn fill">Start a game</button>' +
        '<button class="btn ghost">Join a room</button></div></div>';
    },
    join: function (el, corpus) {
      var chars = corpus.roomCode.split('');
      el.innerHTML =
        '<div class="wrap"><div class="body">' +
        '<div class="eyebrow" style="margin-top:24px">step into a room</div>' +
        '<h1 class="brand" style="font-size:38px">The code</h1>' +
        '<div class="code">' +
        chars
          .map(function (c, i) {
            return '<div class="cslot ' + (i < 4 ? 'on' : '') + '">' + esc(c) + '</div>';
          })
          .join('') +
        '</div>' +
        '<div class="eyebrow" style="margin-bottom:4px">sign your name</div>' +
        '<input class="field" value="Theo" />' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Join ' +
        esc(corpus.roomCode) +
        '</button></div></div>';
    },
    lobby: function (el, corpus) {
      var seats = corpus.players
        .map(function (p) {
          var cls = p.host ? 'here' : p.present ? '' : 'away';
          var rl = p.host
            ? 'host'
            : p.kind === 'ai'
              ? 'Basho bot'
              : p.present
                ? 'ready'
                : 'not here yet';
          return (
            '<div class="seat ' +
            cls +
            '"><span class="av">' +
            esc(p.name[0]) +
            '</span><span><span class="nm">' +
            esc(p.name) +
            '</span><br><span class="rl">' +
            rl +
            '</span></span></div>'
          );
        })
        .join('');
      el.innerHTML =
        '<div class="wrap"><div class="body">' +
        '<div class="eyebrow" style="margin-top:12px">everyone gathers</div>' +
        '<div style="display:flex;align-items:center;gap:14px;margin-top:10px">' +
        '<span class="seal serif" style="width:88px;height:88px;font-size:38px">' +
        esc(corpus.roomCode) +
        '</span>' +
        '<p class="tag" style="margin:0">Call it out. Friends fold in from across the table.</p>' +
        '</div>' +
        '<div class="foldline"><div class="seatgrid">' +
        seats +
        '<div class="seat add"><span class="av">+</span><span><span class="nm">Add a bot</span><br><span class="rl">Basho</span></span></div>' +
        '</div></div>' +
        '</div>' +
        '<div class="foot"><button class="btn fill">Start folding</button></div></div>';
    },
    write: function (el, corpus) {
      var n = corpus.game.wordsThisRound;
      var dots = '';
      for (var i = 0; i < n; i++) dots += '<i></i>';
      el.innerHTML =
        '<div class="wrap"><div class="body">' +
        '<div class="meta" style="margin-top:8px"><span class="r serif">Round ' +
        corpus.game.round +
        '</span><span class="of">of ' +
        corpus.game.totalRounds +
        ' &middot; ' +
        n +
        ' words</span></div>' +
        '<div class="folded">' +
        '<div class="hidden-above"></div>' +
        '<div class="exposed"><div class="lbl">the line before yours</div>' +
        '<div class="pl">' +
        esc(corpus.game.previousLine) +
        '</div></div>' +
        '</div>' +
        '<div class="wc">' +
        dots +
        '</div>' +
        '<div class="wchint" style="margin-bottom:8px"><b>0</b> of ' +
        n +
        ' words</div>' +
        '<input class="field line" placeholder="answer it in ' +
        n +
        ' words" value="' +
        esc(corpus.game.draft) +
        '" />' +
        '</div>' +
        '<div class="foot"><button class="btn seal">Fold it under</button></div></div>';
      e3WireWordDots(el);
    },
    wait: function (el, corpus) {
      el.innerHTML =
        '<div class="wrap"><div class="body" style="justify-content:center">' +
        '<div class="foldicon">&#9662;</div>' +
        '<h1 class="brand" style="font-size:34px;margin:0">Folded in</h1>' +
        '<p class="tag" style="margin-top:12px">Your line is creased under. It waits for the reading.</p>' +
        '<div class="stillfold"><i></i>' +
        esc(corpus.game.waitingOn[0]) +
        ' is still folding</div>' +
        '</div>' +
        '<div class="foot"><button class="btn ghost">Round ' +
        corpus.game.round +
        ' of ' +
        corpus.game.totalRounds +
        '</button></div></div>';
    },
    reveal: function (el, corpus) {
      var readers = corpus.revealQueue
        .map(function (item, i) {
          return (
            '<div class="rr"><span class="n serif">' +
            String(i + 1).padStart(2, '0') +
            '</span><span style="font-weight:500">' +
            esc(item.poem) +
            '</span><span class="who">read by <b>' +
            esc(item.reader) +
            '</b></span></div>'
          );
        })
        .join('');
      var panels = corpus.poem.lines
        .map(function (l) {
          return (
            '<div class="panel"><div class="pl">' +
            esc(l.text) +
            '</div><div class="au">' +
            esc(l.author) +
            '</div></div>'
          );
        })
        .join('');
      el.innerHTML =
        '<div class="wrap"><div class="scrollbody">' +
        '<div class="eyebrow" style="margin-top:6px">the reading</div>' +
        '<h1 class="brand" style="font-size:30px;margin:4px 0 0">Unfold it aloud</h1>' +
        '<div class="readers">' +
        readers +
        '</div>' +
        '<div class="titlecard">' +
        esc(corpus.poem.title) +
        ' &middot; ' +
        esc(corpus.revealQueue[0].reader) +
        ' reads</div>' +
        '<div class="unfold">' +
        panels +
        '</div>' +
        '</div>' +
        '<div class="foot"><button class="btn seal unfoldbtn">Unfold the poem</button></div></div>';
      e3WireUnfold(el);
    },
  };

  window.LANE_SPECS['EMIL-3'] = {
    lane: 'emil',
    title: 'Fold',
    move: 'Make the material the paper itself: writing sees only the exposed panel, and the reveal is one continuous unfold instead of tap-per-poem.',
    css: css3,
    screens: screens3,
  };
})();
