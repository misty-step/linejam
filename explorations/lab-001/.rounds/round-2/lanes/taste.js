// TASTE lane — two complete system propositions for Linejam, each obeying the
// leon-taste-skill philosophy end to end: metric-based rules, asymmetric layout,
// a single desaturated accent on a neutral base (max 1 accent, no AI purple/blue,
// no pure black), mono numerals, tactile :active feedback, motion only on game
// moments, editorial serif reserved for the poetry itself. Mobile-first at
// 390x844 with the primary action parked in the bottom thumb zone.
//
// Two round-1 seeds were killed by the operator (Counthouse, Overheard) and are
// gone. What survives and what is new:
//
// TASTE-3 SEATS    — the room is a table (KEPT). Wait screen redesigned, the
//                    read-aloud ceremony added as a first-class screen, and the
//                    alignment law applied to reveal + read.
// TASTE-4 PLAYBILL — a warm editorial theatre program (NEW). The whole game is a
//                    printed bill for a poem read aloud; the read screen is the
//                    marquee. Light ivory print, one carmine accent — distinct
//                    territory from the dark table of Seats.
(function () {
  window.LANE_SPECS = window.LANE_SPECS || {};

  // Small trusted-content helper (corpus is fixed, no user input to escape).
  const seatMark = (p) =>
    p.host ? 'host' : p.kind === 'ai' ? 'ghost' : p.present ? '' : 'away';

  /* ============================================================= *
   * TASTE-3 · SEATS  (kept + wait redesigned + read added)
   * The room is a table. Warm charcoal dark, single amber accent,
   * rounded seat tokens arranged in an arc, chrome in the bottom
   * thumb zone. Reveal + read obey the alignment law: poem text
   * always starts at one fixed column; numbers and bylines never
   * shift it. The read screen is the payoff — one line lit at a
   * time, legible held up to the table.
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

/* read ceremony */
.opt-TASTE-3 .t3-stage-head { display: flex; align-items: center; gap: 13px; margin: 12px 0 18px; }
.opt-TASTE-3 .t3-rline { display: grid; grid-template-columns: 20px 1fr auto; align-items: baseline; column-gap: 12px; padding: 9px 0; }
.opt-TASTE-3 .t3-rline .vn { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--soft); text-align: right; padding-top: 8px; }
.opt-TASTE-3 .t3-rline .vt { font-family: 'Newsreader', serif; font-weight: 400; font-size: 29px; line-height: 1.28; letter-spacing: -.01em; }
.opt-TASTE-3 .t3-rline .vb { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-3 .t3-rline.next .vt { color: var(--amber); letter-spacing: .3em; }
.opt-TASTE-3 .t3-rline.next .vn { color: var(--amber); }
.opt-TASTE-3 .t3-progress { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.opt-TASTE-3 .t3-dots { display: flex; gap: 6px; }
.opt-TASTE-3 .t3-pdot { width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); }
.opt-TASTE-3 .t3-pdot.done { background: var(--soft); box-shadow: none; }
.opt-TASTE-3 .t3-pdot.on { background: var(--amber); box-shadow: none; }

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
        const cur = corpus.revealQueue[0];
        const next = corpus.revealQueue[1];
        const verses = corpus.poem.lines.map((ln, i) =>
          `<div class="t3-vrow t3-deal" style="animation-delay:${i * 45}ms;"><span class="vn">${i + 1}</span><span class="vt">${ln.text}</span><span class="vb">${ln.author}</span></div>`
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
            <p class="t3-mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);margin-bottom:8px;">${corpus.poem.title}</p>
            ${verses}
            <p class="t3-mono" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-top:20px;border-top:1px solid var(--line);padding-top:14px;">up next · ${next.reader} reads ${next.poem}</p>
          </div>
          <div class="t3-dock">
            <button class="t3-btn t3-amber">Start reading aloud</button>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;          // Poem 01, Maya, position 1/5, revealed 5, next Theo
        const lines = corpus.poem.lines;   // 9
        let shown = r.revealedLines;       // 5
        const initial = (n) => n.slice(0, 1).toUpperCase();
        el.innerHTML = `
          <div class="t3-body">
            <p class="t3-kick">reading aloud · poem ${r.position} of ${r.total}</p>
            <div class="t3-stage-head">
              <span class="t3-av" style="background:var(--amber);width:46px;height:46px;font-size:20px;">${initial(r.reader)}</span>
              <span>
                <span class="t3-serif" style="font-size:27px;display:block;line-height:1.02;">${r.poem}</span>
                <span class="t3-mono" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);">in ${r.reader}'s voice · ${r.nextReader} on deck</span>
              </span>
            </div>
            <div id="t3rlines"></div>
          </div>
          <div class="t3-dock">
            <div class="t3-progress">
              <div class="t3-dots" id="t3dots"></div>
              <p class="t3-mono" style="font-size:12px;color:var(--soft);margin-left:auto;">line <b style="color:var(--ink);" id="t3ln">5</b> of ${lines.length}</p>
            </div>
            <button class="t3-btn t3-amber" id="t3adv">Reveal the next line</button>
          </div>`;
        const linesEl = el.querySelector('#t3rlines');
        const dotsEl = el.querySelector('#t3dots');
        const lnEl = el.querySelector('#t3ln');
        const adv = el.querySelector('#t3adv');
        dotsEl.innerHTML = Array.from({ length: r.total }, (_, i) =>
          `<span class="t3-pdot ${i < r.position - 1 ? 'done' : i === r.position - 1 ? 'on' : ''}"></span>`
        ).join('');
        const draw = () => {
          const parts = [];
          for (let i = 0; i < lines.length; i++) {
            if (i < shown) {
              parts.push(`<div class="t3-rline"><span class="vn">${i + 1}</span><span class="vt">${lines[i].text}</span><span class="vb">${lines[i].author}</span></div>`);
            } else if (i === shown) {
              parts.push(`<div class="t3-rline next t3-deal"><span class="vn">${i + 1}</span><span class="vt">· · ·</span><span class="vb">next</span></div>`);
            }
          }
          const remaining = lines.length - shown - 1;
          if (shown < lines.length && remaining > 0) {
            parts.push(`<p class="t3-mono" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);margin-top:14px;">${remaining} more line${remaining > 1 ? 's' : ''} to come</p>`);
          }
          linesEl.innerHTML = parts.join('');
          lnEl.textContent = String(Math.min(shown, lines.length));
          adv.textContent = shown >= lines.length ? `Hand the stage to ${r.nextReader}` : 'Reveal the next line';
        };
        adv.addEventListener('click', () => { if (shown < lines.length) { shown++; draw(); } });
        draw();
      },
    },
  };

  /* ============================================================= *
   * TASTE-4 · PLAYBILL  (fresh seed)
   * The whole game is a printed theatre program for a poem read
   * aloud by the company. Warm ivory print, ink near-black, one
   * carmine accent. Playfair Display marquees, mono program labels,
   * ruled cast lists. The read screen is the marquee — the finale
   * the whole app is a bill for. Distinct territory from the dark
   * table of Seats: light editorial print, not a lit room.
   * ============================================================= */
  window.LANE_SPECS['TASTE-4'] = {
    lane: 'taste',
    title: 'Playbill',
    move: 'The game is a printed theatre program for a poem read aloud: ivory print, one carmine accent, Playfair marquees, ruled cast and program lists. The read screen is the billed finale, revealing one line at a time — alignment law keeps every line on one column.',
    css: `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.opt-TASTE-4 {
  --ivory: #f4efe4; --panel: #faf6ec; --ink: #221d16; --soft: #7b7264; --line: #dcd2bf;
  --red: #a5372a; --red-ink: #f7f1e8;
  background: var(--ivory); color: var(--ink);
  font-family: 'Archivo', system-ui, sans-serif;
  display: flex; flex-direction: column;
  -webkit-font-smoothing: antialiased;
}
.opt-TASTE-4 * { box-sizing: border-box; }
.opt-TASTE-4 .pb-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 34px 24px 16px; display: flex; flex-direction: column; }
.opt-TASTE-4 .pb-foot { flex: none; padding: 14px 24px 24px; border-top: 1px solid var(--line); }

.opt-TASTE-4 .pb-kick { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-4 .pb-kick.red { color: var(--red); }
.opt-TASTE-4 .pb-disp { font-family: 'Playfair Display', Georgia, serif; }
.opt-TASTE-4 .pb-num { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
.opt-TASTE-4 .pb-rule { border: none; border-top: 1px solid var(--line); margin: 0; }
.opt-TASTE-4 .pb-rule.ink { border-top: 1.5px solid var(--ink); }

/* masthead marquee */
.opt-TASTE-4 .pb-mast { text-align: center; }
.opt-TASTE-4 h1.pb-title { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 46px; line-height: 1; letter-spacing: .01em; margin: 0; }

/* buttons — ticket */
.opt-TASTE-4 .pb-btn { width: 100%; min-height: 54px; border: none; border-radius: 3px; font-family: 'Archivo', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: transform .12s ease, background .2s, opacity .2s; }
.opt-TASTE-4 .pb-btn:active { transform: translateY(1px); }
.opt-TASTE-4 .pb-fill { background: var(--red); color: var(--red-ink); }
.opt-TASTE-4 .pb-ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
.opt-TASTE-4 .pb-btn:disabled { opacity: .4; cursor: default; }

/* ticket code */
.opt-TASTE-4 .pb-ticket { border: 1.5px solid var(--ink); border-radius: 4px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; background: var(--panel); }
.opt-TASTE-4 .pb-ticket .code { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 42px; letter-spacing: .12em; line-height: 1; }

/* form */
.opt-TASTE-4 label.pb-lab { display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--soft); margin: 0 0 8px; }
.opt-TASTE-4 input.pb-in { width: 100%; min-height: 52px; padding: 0 14px; border: 1.5px solid var(--line); border-radius: 3px; background: var(--panel); font-family: 'Playfair Display', serif; font-size: 22px; color: var(--ink); }
.opt-TASTE-4 input.pb-in:focus { outline: none; border-color: var(--red); }

/* program / cast list — ruled entries */
.opt-TASTE-4 .pb-item { display: grid; grid-template-columns: 34px 1fr auto; align-items: baseline; column-gap: 14px; padding: 15px 0; border-top: 1px solid var(--line); text-align: left; }
.opt-TASTE-4 .pb-item .rn { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }
.opt-TASTE-4 .pb-item .nm { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 500; line-height: 1.1; }
.opt-TASTE-4 .pb-item .rl { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-4 .pb-item .rl.red { color: var(--red); }
.opt-TASTE-4 .pb-item .sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-4 .pb-item.away .nm { color: var(--soft); }

/* write measure — word boxes that GROW with their word, never clip */
.opt-TASTE-4 .pb-prev { font-family: 'Playfair Display', serif; font-weight: 400; font-style: italic; font-size: 27px; line-height: 1.2; letter-spacing: -.01em; }
.opt-TASTE-4 .pb-measure { display: flex; flex-wrap: wrap; gap: 8px; }
.opt-TASTE-4 .pb-word { min-width: 34px; min-height: 42px; padding: 6px 12px; border-bottom: 2px solid var(--line); display: inline-flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; font-size: 19px; color: var(--ink); }
.opt-TASTE-4 .pb-word .ph { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--soft); }
.opt-TASTE-4 .pb-word.set { border-bottom-color: var(--ink); }
.opt-TASTE-4 .pb-word.next { border-bottom-color: var(--red); }
.opt-TASTE-4 .pb-cnt { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--soft); }
.opt-TASTE-4 .pb-cnt b { color: var(--red); }

/* ALIGNMENT LAW — reveal + read poem lines: fixed number gutter, text at one column, byline trails */
.opt-TASTE-4 .pb-line { display: grid; grid-template-columns: 26px 1fr auto; align-items: baseline; column-gap: 14px; padding: 8px 0; }
.opt-TASTE-4 .pb-line .ln { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--soft); text-align: right; }
.opt-TASTE-4 .pb-line .lt { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 26px; line-height: 1.28; letter-spacing: -.005em; }
.opt-TASTE-4 .pb-line .la { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }

/* read ceremony marquee */
.opt-TASTE-4 .pb-stagehead { text-align: center; margin: 6px 0 16px; }
.opt-TASTE-4 .pb-rline { display: grid; grid-template-columns: 26px 1fr auto; align-items: baseline; column-gap: 14px; padding: 10px 0; }
.opt-TASTE-4 .pb-rline .ln { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--soft); text-align: right; padding-top: 9px; }
.opt-TASTE-4 .pb-rline .lt { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 30px; line-height: 1.26; letter-spacing: -.01em; }
.opt-TASTE-4 .pb-rline .la { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--soft); }
.opt-TASTE-4 .pb-rline.next .lt { color: var(--red); letter-spacing: .3em; }
.opt-TASTE-4 .pb-rline.next .ln { color: var(--red); }
.opt-TASTE-4 .pb-prog { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.opt-TASTE-4 .pb-dots { display: flex; gap: 6px; }
.opt-TASTE-4 .pb-pdot { width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); }
.opt-TASTE-4 .pb-pdot.done { background: var(--soft); box-shadow: none; }
.opt-TASTE-4 .pb-pdot.on { background: var(--red); box-shadow: none; }

/* wait */
.opt-TASTE-4 .pb-wrow { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-top: 1px solid var(--line); }
.opt-TASTE-4 .pb-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--red); flex: none; }

.opt-TASTE-4 .pb-in-anim { animation: pbin .6s cubic-bezier(.16,1,.3,1) both; }
@keyframes pbin { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.opt-TASTE-4 .pb-pulse { animation: pbpulse 1.8s ease-in-out infinite; }
@keyframes pbpulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .opt-TASTE-4 * { animation: none !important; transition: none !important; } }
    `,
    screens: {
      home(el) {
        el.innerHTML = `
          <div class="pb-body" style="justify-content:center;">
            <div class="pb-mast pb-in-anim">
              <p class="pb-kick" style="border-top:1.5px solid var(--ink);border-bottom:1px solid var(--line);padding:10px 0;">A party reading in nine lines</p>
              <h1 class="pb-title" style="margin:22px 0;">LINEJAM</h1>
              <p class="pb-disp" style="font-style:italic;font-size:20px;color:var(--soft);border-top:1px solid var(--line);border-bottom:1.5px solid var(--ink);padding:14px 0;line-height:1.35;">Write one line. Pass it on.<br>Hear the whole thing read aloud.</p>
            </div>
            <div style="text-align:center;margin-top:30px;">
              <p class="pb-kick">the meter</p>
              <p class="pb-num pb-disp" style="font-size:24px;letter-spacing:.12em;margin:8px 0 6px;">1 · 2 · 3 · 4 · <span style="color:var(--red);">5</span> · 4 · 3 · 2 · 1</p>
              <p class="pb-kick">words per line</p>
            </div>
          </div>
          <div class="pb-foot">
            <button class="pb-btn pb-fill" style="margin-bottom:10px;">Start tonight's reading</button>
            <button class="pb-btn pb-ghost">Join with a code</button>
          </div>`;
      },
      join(el) {
        el.innerHTML = `
          <div class="pb-body">
            <p class="pb-kick">Admission</p>
            <h2 class="pb-disp" style="font-weight:600;font-size:34px;margin:8px 0 30px;">Take your seat</h2>
            <label class="pb-lab">room code</label>
            <div class="pb-ticket pb-in-anim" style="margin-bottom:28px;">
              <span class="code">PLUM</span>
              <span class="pb-kick" style="text-align:right;line-height:1.5;">admit<br>one</span>
            </div>
            <label class="pb-lab">billed as</label>
            <input class="pb-in" value="Wren" aria-label="pen name" />
          </div>
          <div class="pb-foot">
            <button class="pb-btn pb-fill">Take your place</button>
          </div>`;
      },
      lobby(el, corpus) {
        const cast = corpus.players.map((p, i) => {
          const mark = seatMark(p);
          const role = mark === 'host' ? '<span class="rl red">Host</span>'
            : mark === 'ghost' ? '<span class="rl">Ghostwriter</span>'
            : mark === 'away' ? '<span class="rl">Finding seat</span>' : '<span class="rl">Company</span>';
          const rn = String(i + 1).padStart(2, '0');
          return `<div class="pb-item ${p.present ? '' : 'away'} pb-in-anim" style="animation-delay:${i * 60}ms;"><span class="rn">${rn}</span><span class="nm">${p.name}</span>${role}</div>`;
        }).join('');
        el.innerHTML = `
          <div class="pb-body">
            <p class="pb-kick">Room code</p>
            <div class="pb-ticket pb-in-anim" style="margin:8px 0 22px;">
              <span class="code">${corpus.roomCode}</span>
              <span class="pb-kick" style="text-align:right;line-height:1.5;">read it<br>aloud</span>
            </div>
            <p class="pb-kick" style="margin-bottom:2px;">Tonight's company</p>
            <div>${cast}
              <button class="pb-item pb-in-anim" style="width:100%;background:none;cursor:pointer;">
                <span class="rn" style="color:var(--red);">+</span><span class="nm" style="color:var(--red);">Add a ghostwriter</span><span class="rl">AI</span>
              </button>
            </div>
          </div>
          <div class="pb-foot">
            <button class="pb-btn pb-fill">Begin the reading</button>
          </div>`;
      },
      write(el, corpus) {
        const g = corpus.game;
        const drafted = g.draft.split(' ');
        const total = g.wordsThisRound;
        const measure = Array.from({ length: total }, (_, i) => {
          const w = drafted[i];
          const cls = w ? 'set' : i === drafted.length ? 'next' : '';
          return `<span class="pb-word ${cls}">${w ? w : `<span class="ph">${i + 1}</span>`}</span>`;
        }).join('');
        el.innerHTML = `
          <div class="pb-body">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <p class="pb-kick red">Your cue</p>
              <p class="pb-kick">Line <span class="pb-num">05</span> of <span class="pb-num">09</span></p>
            </div>
            <hr class="pb-rule" style="margin:14px 0 24px;">
            <p class="pb-kick" style="margin-bottom:10px;">The line handed to you</p>
            <p class="pb-prev pb-in-anim">${g.previousLine}</p>
            <hr class="pb-rule" style="margin:24px 0;">
            <p class="pb-kick" style="margin-bottom:12px;">Your reply, exactly five words</p>
            <div class="pb-measure" id="pbmeasure">${measure}</div>
            <p class="pb-cnt" style="margin-top:14px;"><b id="pbn">${drafted.length}</b> / ${total} words</p>
          </div>
          <div class="pb-foot">
            <input class="pb-in" id="pbw" value="${g.draft} " aria-label="your line" style="font-size:19px;margin-bottom:10px;">
            <button class="pb-btn pb-fill" id="pbsend" disabled>Add one more word</button>
          </div>`;
        const input = el.querySelector('#pbw');
        const wrap = el.querySelector('#pbmeasure');
        const nEl = el.querySelector('#pbn');
        const send = el.querySelector('#pbsend');
        const paint = () => {
          const words = input.value.trim().split(/\s+/).filter(Boolean).slice(0, total);
          wrap.querySelectorAll('.pb-word').forEach((b, i) => {
            b.className = 'pb-word';
            if (words[i]) { b.textContent = words[i]; b.classList.add('set'); }
            else { b.innerHTML = `<span class="ph">${i + 1}</span>`; if (i === words.length) b.classList.add('next'); }
          });
          nEl.textContent = String(words.length);
          if (words.length === total) { send.disabled = false; send.textContent = 'Pass it on'; }
          else { send.disabled = true; send.textContent = 'Add one more word'; }
        };
        input.addEventListener('input', paint);
        paint();
      },
      wait(el, corpus) {
        const waiting = corpus.game.waitingOn;      // ['Theo','Ravi']
        const total = corpus.players.length;        // 5
        const inCount = total - waiting.length;     // 3
        const rows = waiting.map((n) =>
          `<div class="pb-wrow"><span class="pb-dot pb-pulse"></span><span class="pb-disp" style="font-size:24px;">${n}</span><span class="pb-kick" style="margin-left:auto;">still writing</span></div>`
        ).join('');
        el.innerHTML = `
          <div class="pb-body">
            <p class="pb-kick">In the wings</p>
            <h2 class="pb-disp pb-in-anim" style="font-weight:600;font-size:36px;margin:8px 0 10px;">Your line's delivered.</h2>
            <p class="pb-disp" style="font-style:italic;font-size:19px;color:var(--soft);line-height:1.35;max-width:24ch;">Only your five words travel on. The rest of the poem stays out of sight.</p>
            <hr class="pb-rule" style="margin:26px 0 16px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <p class="pb-kick">Round <span class="pb-num">05</span> / <span class="pb-num">09</span></p>
              <p class="pb-kick"><b style="color:var(--red);">${inCount}</b> of ${total} lines in</p>
            </div>
            <div style="margin-top:16px;">
              <p class="pb-kick" style="margin-bottom:2px;">Waiting on the company</p>
              ${rows}
            </div>
          </div>
          <div class="pb-foot">
            <button class="pb-btn pb-ghost" disabled>Holding for the company</button>
          </div>`;
      },
      reveal(el, corpus) {
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
        const program = corpus.revealQueue.map((q, i) => {
          const on = i === 0;
          const meta = q.forAi ? `<span class="sub">${q.reader} · ${q.forAi}'s poem</span>` : `<span class="sub">${q.reader} reads</span>`;
          return `<div class="pb-item pb-in-anim" style="animation-delay:${i * 50}ms;"><span class="rn"${on ? ' style="color:var(--red);"' : ''}>${roman[i]}</span><span class="nm"${on ? ' style="color:var(--red);"' : ''}>${q.poem}</span>${meta}</div>`;
        }).join('');
        const lines = corpus.poem.lines.map((ln, i) =>
          `<div class="pb-line pb-in-anim" style="animation-delay:${i * 45}ms;"><span class="ln">${i + 1}</span><span class="lt">${ln.text}</span><span class="la">${ln.author}</span></div>`
        ).join('');
        el.innerHTML = `
          <div class="pb-body">
            <div class="pb-mast" style="margin-bottom:18px;">
              <p class="pb-kick" style="border-top:1.5px solid var(--ink);padding-top:10px;">The Program</p>
              <p class="pb-disp" style="font-style:italic;font-size:15px;color:var(--soft);margin-top:6px;">Five poems, read in order, aloud</p>
            </div>
            <div style="margin-bottom:26px;">${program}</div>
            <hr class="pb-rule ink" style="margin:0 0 14px;">
            <p class="pb-kick red" style="margin-bottom:2px;">First to the stage</p>
            <h2 class="pb-disp" style="font-weight:600;font-size:27px;margin:6px 0 12px;">${corpus.poem.title} · ${corpus.revealQueue[0].reader}</h2>
            ${lines}
          </div>
          <div class="pb-foot">
            <button class="pb-btn pb-fill">Start the reading aloud</button>
          </div>`;
      },
      read(el, corpus) {
        const r = corpus.reading;          // Poem 01, Maya, position 1/5, revealed 5, next Theo
        const lines = corpus.poem.lines;   // 9
        let shown = r.revealedLines;       // 5
        el.innerHTML = `
          <div class="pb-body">
            <div class="pb-stagehead">
              <p class="pb-kick red">Now reading · poem ${r.position} of ${r.total}</p>
              <h2 class="pb-disp" style="font-weight:700;font-size:34px;margin:8px 0 4px;">${r.poem}</h2>
              <p class="pb-disp" style="font-style:italic;font-size:19px;color:var(--soft);">in ${r.reader}'s voice</p>
            </div>
            <hr class="pb-rule ink" style="margin-bottom:4px;">
            <div id="pbrlines"></div>
          </div>
          <div class="pb-foot">
            <div class="pb-prog">
              <div class="pb-dots" id="pbdots"></div>
              <p class="pb-kick">Line <span class="pb-num" id="pbln">5</span> of ${lines.length}</p>
            </div>
            <button class="pb-btn pb-fill" id="pbadv">Reveal the next line</button>
          </div>`;
        const linesEl = el.querySelector('#pbrlines');
        const dotsEl = el.querySelector('#pbdots');
        const lnEl = el.querySelector('#pbln');
        const adv = el.querySelector('#pbadv');
        dotsEl.innerHTML = Array.from({ length: r.total }, (_, i) =>
          `<span class="pb-pdot ${i < r.position - 1 ? 'done' : i === r.position - 1 ? 'on' : ''}"></span>`
        ).join('');
        const draw = () => {
          const parts = [];
          for (let i = 0; i < lines.length; i++) {
            if (i < shown) {
              parts.push(`<div class="pb-rline"><span class="ln">${i + 1}</span><span class="lt">${lines[i].text}</span><span class="la">${lines[i].author}</span></div>`);
            } else if (i === shown) {
              parts.push(`<div class="pb-rline next pb-in-anim"><span class="ln">${i + 1}</span><span class="lt">· · ·</span><span class="la">next</span></div>`);
            }
          }
          const remaining = lines.length - shown - 1;
          if (shown < lines.length && remaining > 0) {
            parts.push(`<p class="pb-kick" style="margin-top:14px;">${remaining} more line${remaining > 1 ? 's' : ''} to come</p>`);
          }
          linesEl.innerHTML = parts.join('');
          lnEl.textContent = String(Math.min(shown, lines.length));
          adv.textContent = shown >= lines.length ? `Hand the stage to ${r.nextReader}` : 'Reveal the next line';
        };
        adv.addEventListener('click', () => { if (shown < lines.length) { shown++; draw(); } });
        draw();
      },
    },
  };
})();
