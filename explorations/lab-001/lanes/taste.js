// TASTE lane — one kept system proposition plus a first-class theme picker,
// both obeying the leon-taste-skill philosophy end to end: metric-based rules,
// asymmetric layout, a single desaturated accent on a neutral base (max 1
// accent, no AI purple/blue, no pure black), mono numerals, tactile :active
// feedback, motion only on game moments, editorial serif reserved for the
// poetry itself. Mobile-first at 390x844 with the primary action parked in the
// bottom thumb zone.
//
// What survives and what is new:
//
// TASTE-3 SEATS  — the room is a table (KEPT, "very good"). The reveal is now
//                  the reading circle: everyone plays on their own phone, and at
//                  game end each player is handed ONE poem to read aloud when
//                  their turn comes around. Reveal = the queue of readers; read =
//                  your assigned poem shown WHOLE, framed to perform aloud. No
//                  line-by-line unveil, no passed phone.
// TASTE-5 THEMES — the theme picker as a distinct first-class page. Browse 14
//                  systems, each previewed truthfully in its own paper/ink/accent,
//                  hosted inside the dark Seats chrome. (Playbill was killed.)
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // Small trusted-content helper (corpus is fixed, no user input to escape).
  const seatMark = (p) =>
    p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? '' : 'away';

  /* ============================================================= *
   * TASTE-3 · SEATS  (kept; reveal + read reworked to the real read
   * mechanic). The room is a table. Warm charcoal dark, single amber
   * accent, rounded seat tokens, chrome docked in the thumb zone.
   * Reveal is the reading circle: a queue of who has read, who reads
   * now (you), and who is up. Read is your one assigned poem shown
   * WHOLE at once — every line and byline visible, framed to be read
   * aloud to the room, ending in a hand-off of the mic. Poem text
   * obeys the alignment law: it always starts at one fixed column;
   * numbers and bylines never shift it.
   * ============================================================= */
  window.LANE_SPECS['TASTE-3'] = {
    lane: 'taste',
    title: 'Seats',
    move: 'The room is a table (kept): seat tokens in an arc, chrome docked in the thumb zone. New read-aloud ceremony lights one line at a time; wait screen redesigned around round progress; alignment law locks poem text to one column on reveal and read.',
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

/* beads (write) — grow with their word, never clip */
.opt-TASTE-3 .t3-beads { display: flex; gap: 8px; flex-wrap: wrap; }
.opt-TASTE-3 .t3-bead { min-width: 34px; min-height: 40px; padding: 7px 14px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-family: 'Newsreader', serif; font-size: 16px; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); }
.opt-TASTE-3 .t3-bead.set { background: var(--ink); color: var(--tbl); box-shadow: none; }
.opt-TASTE-3 .t3-bead.next { box-shadow: inset 0 0 0 1.5px var(--amber); color: var(--amber); }
.opt-TASTE-3 .t3-in { width: 100%; min-height: 50px; padding: 0 16px; border-radius: 14px; border: none; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); font-family: 'Outfit', sans-serif; font-size: 17px; }
.opt-TASTE-3 .t3-in:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--amber); }
.opt-TASTE-3 .t3-cnt { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }
.opt-TASTE-3 .t3-cnt b { color: var(--amber); }

/* ALIGNMENT LAW — reveal verse rows: fixed number gutter, text at one column, byline trails */
.opt-TASTE-3 .t3-vrow { display: grid; grid-template-columns: 20px 1fr auto; align-items: baseline; column-gap: 12px; padding: 6px 0; }
.opt-TASTE-3 .t3-vrow .vn { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--soft); text-align: right; }
.opt-TASTE-3 .t3-vrow .vt { font-family: 'Newsreader', serif; font-weight: 400; font-size: 25px; line-height: 1.3; letter-spacing: -.01em; }
.opt-TASTE-3 .t3-vrow .vb { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }

/* reveal — the reading circle: a queue of readers around the room */
.opt-TASTE-3 .t3-qrow { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; column-gap: 13px; padding: 13px 14px; border-radius: 16px; background: var(--tbl2); box-shadow: inset 0 0 0 1px var(--line); margin-bottom: 9px; }
.opt-TASTE-3 .t3-qrow.now { box-shadow: inset 0 0 0 1.5px var(--amber); background: #251f16; }
.opt-TASTE-3 .t3-qrow.read { opacity: .62; }
.opt-TASTE-3 .t3-qav { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 15px; }
.opt-TASTE-3 .t3-qrow .qp { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-3 .t3-qrow .qr { font-family: 'Newsreader', serif; font-size: 21px; line-height: 1.1; }
.opt-TASTE-3 .t3-qrow.now .qr { color: var(--amber); }
.opt-TASTE-3 .t3-qrow .qs { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); text-align: right; line-height: 1.4; }
.opt-TASTE-3 .t3-qrow.now .qs { color: var(--amber); }
.opt-TASTE-3 .t3-check { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }

/* read ceremony — the whole assigned poem, shown at once, to read aloud */
.opt-TASTE-3 .t3-stage-head { display: flex; align-items: center; gap: 13px; margin: 12px 0 6px; }
.opt-TASTE-3 .t3-rline { display: grid; grid-template-columns: 20px 1fr auto; align-items: baseline; column-gap: 12px; padding: 9px 0; }
.opt-TASTE-3 .t3-rline + .t3-rline { border-top: 1px solid var(--line); }
.opt-TASTE-3 .t3-rline .vn { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--soft); text-align: right; }
.opt-TASTE-3 .t3-rline .vt { font-family: 'Newsreader', serif; font-weight: 400; font-size: 27px; line-height: 1.28; letter-spacing: -.01em; }
.opt-TASTE-3 .t3-rline .vb { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-3 .t3-progress { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.opt-TASTE-3 .t3-dots { display: flex; gap: 6px; }
.opt-TASTE-3 .t3-pdot { width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); }
.opt-TASTE-3 .t3-pdot.done { background: var(--soft); box-shadow: none; }
.opt-TASTE-3 .t3-pdot.on { background: var(--amber); box-shadow: none; }
.opt-TASTE-3 .t3-passed { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber); }

/* wait redesign — round progress meter + who's still writing */
.opt-TASTE-3 .t3-meter { display: flex; gap: 5px; }
.opt-TASTE-3 .t3-mtick { flex: 1; height: 5px; border-radius: 3px; background: var(--line); }
.opt-TASTE-3 .t3-mtick.in { background: var(--amber); }
.opt-TASTE-3 .t3-waitrow { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-top: 1px solid var(--line); }

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
            <p class="t3-serif t3-deal" style="font-weight:300;font-size:20px;color:var(--soft);line-height:1.4;margin:18px 0 0;max-width:24ch;">A poem the table builds blind, then reads aloud when the last line lands.</p>
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
              <button class="t3-seat empty t3-deal" style="animation-delay:350ms;cursor:pointer;justify-content:center;color:var(--amber);font-weight:500;">+ Add a ghostwriter</button>
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
        const waiting = corpus.game.waitingOn;               // ['Theo','Ravi']
        const total = corpus.players.length;                 // 5
        const inCount = total - waiting.length;              // 3 of 5 lines in
        const ticks = Array.from({ length: total }, (_, i) =>
          `<span class="t3-mtick ${i < inCount ? 'in' : ''}"></span>`
        ).join('');
        const rows = waiting.map((n) =>
          `<div class="t3-waitrow">
             <span class="t3-live t3-glow" style="margin-left:0;"></span>
             <span class="t3-serif" style="font-size:22px;">${n}</span>
             <span class="t3-mono" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-left:auto;">still writing</span>
           </div>`
        ).join('');
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick t3-deal">line delivered</p>
            <h2 class="t3-serif t3-deal" style="font-weight:300;font-size:38px;margin:10px 0 10px;">It's around the table now.</h2>
            <p class="t3-serif" style="font-weight:300;font-size:18px;color:var(--soft);line-height:1.4;max-width:24ch;">Only your five words travel on. The rest of the poem stays hidden.</p>
            <div style="margin-top:30px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
                <p class="t3-mono" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);">round 05 / 09</p>
                <p class="t3-mono" style="font-size:12px;color:var(--soft);"><b style="color:var(--amber);">${inCount}</b> of ${total} in</p>
              </div>
              <div class="t3-meter">${ticks}</div>
            </div>
            <div style="margin-top:28px;">
              <p class="t3-kick" style="margin-bottom:2px;">still writing</p>
              ${rows}
            </div>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-line" disabled>Holding for the table</button>
          </div>`;
      },
      reveal(el, corpus) {
        // Reading circle: everyone is on their own phone. The queue shows who
        // has read, who reads now (you, the device owner), and who is up. No
        // poem text here — the whole poem lives on the read screen.
        const q = corpus.revealQueue;
        const initial = (n) => n.slice(0, 1).toUpperCase();
        const hue = (n) => 'hsl(' + ((n.charCodeAt(0) * 47) % 360) + ' 46% 62%)';
        const you = q.find((e) => e.status === 'now');
        const label = { read: 'read', now: 'you · reading now', next: 'up next', waiting: 'waiting' };
        const rows = q.map((e, i) => {
          const forAi = e.forAi ? `${e.forAi}'s poem` : 'read aloud';
          const avBg = e.status === 'now' ? 'var(--amber)' : hue(e.reader);
          const avInk = e.status === 'now' ? 'var(--amber-ink)' : 'var(--tbl)';
          const right = e.status === 'read'
            ? '<span class="t3-check">read ✓</span>'
            : `<span class="qs">${label[e.status]}</span>`;
          return `<div class="t3-qrow ${e.status} t3-deal" style="animation-delay:${i * 60}ms;">
              <span class="t3-qav" style="background:${avBg};color:${avInk};">${initial(e.reader)}</span>
              <span>
                <span class="qp">${e.poem} · ${forAi}</span><br>
                <span class="qr">${e.reader}</span>
              </span>
              ${right}
            </div>`;
        }).join('');
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick t3-deal">the reading circle</p>
            <h2 class="t3-serif t3-deal" style="font-weight:300;font-size:34px;margin:10px 0 6px;">Round the table, out loud.</h2>
            <p class="t3-serif" style="font-weight:300;font-size:17px;color:var(--soft);line-height:1.4;margin:0 0 22px;max-width:26ch;">Each of you was handed one finished poem. Read yours aloud when the circle reaches you.</p>
            ${rows}
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber">Read yours (${you.poem})</button>
          </div>`;
      },
      read(el, corpus) {
        // Your one assigned poem, shown WHOLE. You read it aloud to the room,
        // then pass the mic to the next reader. No line-by-line unveiling.
        const r = corpus.reading;          // { assigned:'Poem 03', reader:'Maya', position:3, total:5, upNext:'Sam' }
        const lines = corpus.poem.lines;   // all 9, visible at once
        const initial = (n) => n.slice(0, 1).toUpperCase();
        const verses = lines.map((ln, i) =>
          `<div class="t3-rline t3-deal" style="animation-delay:${i * 40}ms;"><span class="vn">${i + 1}</span><span class="vt">${ln.text}</span><span class="vb">${ln.author}</span></div>`
        ).join('');
        const dots = Array.from({ length: r.total }, (_, i) =>
          `<span class="t3-pdot ${i < r.position - 1 ? 'done' : i === r.position - 1 ? 'on' : ''}"></span>`
        ).join('');
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick">your poem to read aloud · ${r.position} of ${r.total}</p>
            <div class="t3-stage-head">
              <span class="t3-av" style="background:var(--amber);width:46px;height:46px;font-size:20px;">${initial(r.reader)}</span>
              <span>
                <span class="t3-serif" style="font-size:27px;display:block;line-height:1.02;">${r.assigned}</span>
                <span class="t3-mono" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);">in ${r.reader}'s voice · ${r.upNext} on deck</span>
              </span>
            </div>
            ${verses}
          </div>
          <div class="t3-dock" id="t3dock">
            <div class="t3-progress">
              <div class="t3-dots">${dots}</div>
              <p class="t3-mono" style="font-size:12px;color:var(--soft);margin-left:auto;">${lines.length} lines · read them all</p>
            </div>
            <button class="t3-btn t3-amber" id="t3done">Done</button>
          </div>`;
        const done = el.querySelector('#t3done');
        done.addEventListener('click', () => {
          done.outerHTML = `<div class="t3-passed t3-deal"><span class="t3-live"></span>Mic passed to ${r.upNext}</div>`;
        });
      },
    },
  };

  /* ============================================================= *
   * TASTE-5 · THEMES  (new: first-class theme picker)
   * A distinct page for browsing and choosing among many systems.
   * The Seats chrome (dark table, amber accent) frames every card,
   * but each card's inner swatch previews the theme TRUTHFULLY in
   * its own paper, ink, and accent — a real poem line rendered in
   * the theme's colors so you feel it before you pick it. The card
   * name and select control stay in the legible amber-on-dark chrome
   * so metadata reads no matter how loud or dark the theme is.
   * Scrolls gracefully past 14 systems on a 390x844 phone; the
   * currently-applied theme keeps an "in use" mark, and the chosen
   * card owns the amber ring plus a >=44px pick target.
   * ============================================================= */
  window.LANE_SPECS['TASTE-5'] = {
    lane: 'taste',
    section: 'SELECTOR',
    title: 'Themes',
    move: 'The theme picker as its own page: every one of 14 systems previews itself in its own paper/ink/accent behind the dark Seats chrome, so each swatch reads truthfully while names and the 44px pick control stay legible. The applied theme keeps an "in use" mark; the chosen card takes the amber ring.',
    css: `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Newsreader:opsz,wght@6..72,300;6..72,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

.opt-TASTE-5 {
  --tbl: #1c1a17; --tbl2: #242019; --ink: #efe8da; --soft: #a99e8b; --line: #35302a;
  --amber: #e0a63f; --amber-ink: #1c1a17;
  background: radial-gradient(120% 70% at 50% 0%, #262119 0%, var(--tbl) 60%);
  color: var(--ink);
  font-family: 'Outfit', system-ui, sans-serif;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}
.opt-TASTE-5 * { box-sizing: border-box; }
.opt-TASTE-5 .t5-head { flex: none; padding: 34px 22px 16px; border-bottom: 1px solid var(--line); }
.opt-TASTE-5 .t5-kick { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--amber); }
.opt-TASTE-5 h1.t5-title { font-family: 'Newsreader', Georgia, serif; font-weight: 300; font-size: 40px; line-height: 1; letter-spacing: -.02em; margin: 8px 0 0; }
.opt-TASTE-5 .t5-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--soft); margin-top: 10px; }
.opt-TASTE-5 .t5-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px 22px 14px; }
.opt-TASTE-5 .t5-dock { flex: none; padding: 14px 22px 24px; border-top: 1px solid var(--line); background: rgba(20,18,15,.65); display: flex; align-items: center; gap: 14px; }

.opt-TASTE-5 .t5-card { display: block; width: 100%; text-align: left; border: none; cursor: pointer; background: var(--tbl2); border-radius: 18px; box-shadow: inset 0 0 0 1px var(--line); padding: 13px 13px 14px; margin-bottom: 12px; transition: transform .16s cubic-bezier(.34,1.56,.64,1), box-shadow .2s; }
.opt-TASTE-5 .t5-card:active { transform: scale(.985); }
.opt-TASTE-5 .t5-card.sel { box-shadow: inset 0 0 0 1.5px var(--amber); }
.opt-TASTE-5 .t5-crow { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.opt-TASTE-5 .t5-name { font-family: 'Newsreader', serif; font-weight: 400; font-size: 23px; line-height: 1; }
.opt-TASTE-5 .t5-card.sel .t5-name { color: var(--amber); }
.opt-TASTE-5 .t5-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); color: var(--soft); }
.opt-TASTE-5 .t5-tag.use { color: var(--amber-ink); background: var(--amber); box-shadow: none; }
.opt-TASTE-5 .t5-pick { margin-left: auto; width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px var(--line); font-family: 'JetBrains Mono', monospace; font-size: 16px; color: transparent; }
.opt-TASTE-5 .t5-card.sel .t5-pick { background: var(--amber); box-shadow: none; color: var(--amber-ink); }

/* truthful swatch — theme previews itself in its own paper/ink/accent */
.opt-TASTE-5 .t5-swatch { border-radius: 12px; padding: 14px 15px 15px; }
.opt-TASTE-5 .t5-line { font-family: 'Newsreader', serif; font-weight: 400; font-size: 19px; line-height: 1.3; display: flex; align-items: center; gap: 10px; }
.opt-TASTE-5 .t5-seal { width: 19px; height: 19px; border-radius: 50%; flex: none; }
.opt-TASTE-5 .t5-vibe { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; margin-top: 11px; }
.opt-TASTE-5 .t5-bar { height: 3px; border-radius: 2px; margin-top: 11px; width: 54px; }

.opt-TASTE-5 .t5-selk { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-5 .t5-selname { font-family: 'Newsreader', serif; font-size: 19px; line-height: 1.1; }
.opt-TASTE-5 .t5-apply { margin-left: auto; min-height: 48px; padding: 0 22px; border: none; border-radius: 999px; background: var(--amber); color: var(--amber-ink); font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 15px; cursor: pointer; transition: transform .16s cubic-bezier(.34,1.56,.64,1), opacity .2s; }
.opt-TASTE-5 .t5-apply:active { transform: scale(.97); }
.opt-TASTE-5 .t5-apply:disabled { opacity: .4; cursor: default; }

.opt-TASTE-5 .t5-in { animation: t5in .4s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes t5in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .opt-TASTE-5 * { animation: none !important; transition: none !important; } }
    `,
    screens: {
      selector(el, corpus) {
        const themes = corpus.themes;
        const CURRENT = 'kenya';                 // the applied theme
        const preview = `${corpus.poem.lines[0].text} ${corpus.poem.lines[2].text}`; // "moonlight over quiet stones"
        let selected = CURRENT;

        el.innerHTML = `
          <div class="t5-head">
            <p class="t5-kick">appearance</p>
            <h1 class="t5-title">Themes</h1>
            <p class="t5-count"><b style="color:var(--ink);">${themes.length}</b> systems · <b style="color:var(--amber);">${themes.filter((t) => t.shipped).length}</b> live, ${themes.filter((t) => !t.shipped).length} in the lab</p>
          </div>
          <div class="t5-body" id="t5body"></div>
          <div class="t5-dock" id="t5dock"></div>`;

        const body = el.querySelector('#t5body');
        const dock = el.querySelector('#t5dock');

        const paint = () => {
          body.innerHTML = themes.map((t, i) => {
            const isSel = t.id === selected;
            const inUse = t.id === CURRENT;
            const tag = inUse
              ? '<span class="t5-tag use">in use</span>'
              : t.shipped ? '<span class="t5-tag">live</span>' : '<span class="t5-tag">lab</span>';
            return `<button class="t5-card ${isSel ? 'sel' : ''} t5-in" style="animation-delay:${Math.min(i, 8) * 40}ms;"
                data-id="${t.id}" aria-pressed="${isSel}" aria-label="${t.name} theme, ${t.vibe}${inUse ? ', currently in use' : ''}">
              <span class="t5-crow">
                <span class="t5-name">${t.name}</span>
                ${tag}
                <span class="t5-pick" aria-hidden="true">${isSel ? '✓' : ''}</span>
              </span>
              <span class="t5-swatch" style="background:${t.paper};color:${t.ink};display:block;">
                <span class="t5-line" style="color:${t.ink};">
                  <span class="t5-seal" style="background:${t.accent};"></span>${preview}
                </span>
                <span class="t5-bar" style="background:${t.accent};display:block;"></span>
                <span class="t5-vibe" style="color:${t.ink};opacity:.72;display:block;">${t.vibe}</span>
              </span>
            </button>`;
          }).join('');
          body.querySelectorAll('.t5-card').forEach((b) => {
            b.addEventListener('click', () => {
              selected = b.dataset.id;
              paint();
              paintDock();
            });
          });
        };

        const paintDock = () => {
          const t = themes.find((x) => x.id === selected);
          const applied = selected === CURRENT;
          dock.innerHTML = `
            <span>
              <span class="t5-selk">${applied ? 'current theme' : 'switch to'}</span><br>
              <span class="t5-selname" ${applied ? '' : 'style="color:var(--amber);"'}>${t.name}</span>
            </span>
            <button class="t5-apply" id="t5apply" ${applied ? 'disabled' : ''}>${applied ? 'In use' : 'Apply theme'}</button>`;
        };

        paint();
        paintDock();
      },
    },
  };

})();
