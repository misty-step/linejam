#!/usr/bin/env python3
"""Build the Linejam polish review gallery: ranked gaps, directions, and before/after
pairs for every surveyed state. Images stay outside Git in the run directory.

Usage:
  pair_gallery.py --run ~/.cache/visual-states/linejam/<run> [--check]

--check exits 1 when declared evidence, notes or clickable finalist pages are missing.
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def variant_key(after: dict) -> str:
    """File stem for one rendered after state; identical variants share a capture."""
    parts = [after["screen"]]
    if after.get("theme", "light") != "light":
        parts.append(after["theme"])
    if after.get("vp", "390") != "390":
        parts.append(f"vp{after['vp']}")
    if after.get("text"):
        parts.append(f"t{after['text']}")
    if after.get("scroll"):
        parts.append(after["scroll"])
    if after.get("full"):
        parts.append("full")
    if after.get("reduce"):
        parts.append("reduce")
    return "__".join(parts)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def image(rel: str, alt: str, exists: bool) -> str:
    if not exists:
        return f'<div class="missing">Missing: {esc(rel)}</div>'
    return (
        f'<a href="{esc(rel)}" target="_blank" rel="noopener">'
        f'<img loading="lazy" src="{esc(rel)}" alt="{esc(alt)}"></a>'
    )


def variant_label(after: dict) -> str:
    bits = []
    if after.get("theme") == "dark":
        bits.append("Dark")
    vp = after.get("vp", "390")
    bits.append({"390": "390x844", "320": "320x568", "kb": "390x460 keyboard height", "desk": "1280x800"}[vp])
    if after.get("text"):
        bits.append(f"{after['text']}% text")
    if after.get("scroll"):
        bits.append("scrolled to bottom")
    if after.get("full"):
        bits.append("full page")
    return ", ".join(bits)


def build(run: Path, pairs_doc: dict, check: bool) -> tuple[str, list[str]]:
    before_manifest = load(run / "before" / "manifest.json")
    before = {s["id"]: s for s in before_manifest["states"]}
    findings = {f["id"]: f for f in before_manifest.get("findings", [])}
    problems: list[str] = []
    for rel in ("RESUME.md", "notes/critique.md", "notes/synthesis.md"):
        if not (run / rel).is_file():
            problems.append(f"review note missing: {rel}")
    phases = pairs_doc["phases"]
    rows_by_phase: dict[str, list[str]] = {p["id"]: [] for p in phases}

    for pair in pairs_doc["pairs"]:
        b_id = pair.get("before")
        after = pair["after"]
        key = variant_key(after)
        after_rel = f"after/{key}.png"
        after_ok = (run / after_rel).is_file()
        if not after_ok:
            problems.append(f"after missing: {after_rel} (for {b_id or pair.get('beforeSkipped') or key})")
        if b_id:
            state = before.get(b_id)
            if state is None or state.get("status") != "captured":
                problems.append(f"before not captured: {b_id}")
                before_html = f'<div class="missing">Before state {esc(b_id)} not captured</div>'
                before_note = ""
            else:
                rel = f"before/{state['file']}"
                ok = (run / rel).is_file()
                if not ok:
                    problems.append(f"before missing: {rel}")
                before_html = image(rel, f"Before: {b_id}", ok)
                before_note = state.get("note", "")
        else:
            skipped = pair.get("beforeSkipped")
            reason = before.get(skipped, {}).get("reason") if skipped else None
            before_html = '<div class="none">Not captured before</div>'
            before_note = reason or pair.get("note", "")
        gaps = " ".join(
            f'<a class="gap" href="#{esc(g)}" title="{esc(findings.get(g, {}).get("text", ""))}">{esc(g)}</a>'
            for g in pair.get("gaps", [])
        )
        title = b_id or f"{after['screen']} (new)"
        extra = f'<p class="note">{esc(pair["note"])}</p>' if pair.get("note") and b_id else ""
        rows_by_phase[pair["phase"]].append(
            f"""<article class="pair" id="pair-{esc(title)}">
  <header><h3>{esc(title)}</h3><span class="gaps">{gaps}</span></header>
  <p class="note">{esc(before_note)}</p>{extra}
  <div class="images">
    <figure><figcaption>Before, today's app</figcaption>{before_html}</figure>
    <figure><figcaption>After, Tucked In: <code>{esc(after['screen'])}</code>, {esc(variant_label(after))}</figcaption>{image(after_rel, f"After: {key}", after_ok)}</figure>
  </div>
</article>"""
        )

    gap_items = "\n".join(
        f'<li id="{esc(g["id"])}"><strong>{esc(g["id"])}</strong> {esc(g["text"])}</li>'
        for g in before_manifest.get("findings", [])
    )

    # Three already-built HTML candidates, not three new visual directions. The last
    # recombines the first two with the retained pieces of the other four concepts.
    finalist_screens = {
        "tidy-room": ("lobby-host", "writing", "reading-turn"),
        "passing-notes": ("lobby-host", "writing", "reading-turn"),
        "synthesis": ("13-lobby-host-ready", "31-writing-r5-under-count", "39-reveal-reading-now-reader"),
    }
    finalists = []
    for d in pairs_doc["directions"]:
        if d["id"] not in finalist_screens:
            continue
        base = d["prototype"].split("?")[0]
        if not (run / base).is_file():
            problems.append(f"clickable finalist missing: {base}")
        links = " ".join(
            f'<a href="{esc(base)}?screen={esc(screen)}">{label}</a>'
            for label, screen in zip(("Lobby", "Write", "Read"), finalist_screens[d["id"]])
        )
        finalists.append(
            f'<li><strong>{esc(d["name"])}</strong> <span>{esc(d["verdict"])}</span>'
            f'<p>{esc(d["critique"])}</p><div class="try">{links}</div></li>'
        )

    directions = []
    for d in pairs_doc.get("directions", []):
        sheet_rel = f"concepts/{d['id']}/_sheet.png"
        strip_rel = f"concepts/{d['id']}/_motion-accept.png"
        sheet_ok = (run / sheet_rel).is_file()
        strip_ok = (run / strip_rel).is_file()
        if check and not sheet_ok:
            problems.append(f"direction sheet missing: {sheet_rel}")
        if check and d["id"] != "synthesis" and not strip_ok:
            problems.append(f"direction motion missing: {strip_rel}")
        directions.append(
            f"""<article class="direction" id="dir-{esc(d['id'])}">
  <header><h3>{esc(d['name'])}</h3><span class="tag">{esc(d['range'])}</span><span class="verdict">{esc(d['verdict'])}</span></header>
  <p>{esc(d['stance'])}</p>
  {f'<p class="try"><a href="{esc(d["prototype"])}">Open clickable HTML</a></p>' if d.get('prototype') else ''}
  <p class="note">{esc(d['critique'])}</p>
  {image(sheet_rel, f"{d['name']} screens, light and dark", sheet_ok)}
  {('<p class="note">Line accepted, at quarter speed:</p>' + image(strip_rel, f"{d['name']} acceptance motion", strip_ok)) if strip_ok else ''}
</article>"""
        )

    motion = []
    before_strip = before.get("99-motion-filmstrip")
    if before_strip:
        rel = f"before/{before_strip['file']}"
        before_ok = (run / rel).is_file()
        if not before_ok:
            problems.append(f"before motion missing: {rel}")
        motion.append(
            f'<article class="motion"><h3>Before: submit, wait, next round</h3><p class="note">{esc(before_strip.get("note", ""))}</p>{image(rel, "Before motion", before_ok)}</article>'
        )
    for m in pairs_doc.get("motion", []):
        rel = f"after/motion/{m['id']}.png"
        video_rel = f"after/motion/{m['id']}.webm"
        ok = (run / rel).is_file()
        if not ok:
            problems.append(f"motion missing: {rel}")
        if not (run / video_rel).is_file():
            problems.append(f"motion video missing: {video_rel}")
        motion.append(
            f'<article class="motion"><h3>After: {esc(m["title"])}</h3><p class="note">Changed frames at quarter speed, from <code>{esc(m["screen"])}</code>. Recording: <a href="{esc(video_rel)}">webm</a>.</p>{image(rel, m["title"], ok)}</article>'
        )

    out_of_scope = "\n".join(
        f"<li><strong>{esc(o['before'])}</strong> {esc(o['reason'])}</li>" for o in pairs_doc.get("outOfScope", [])
    )
    nav = " ".join(
        [
            '<a href="#finalists">Try the finalists</a>',
            '<a href="#gaps">Ranked gaps</a>',
            '<a href="#directions">All directions</a>',
            *(f'<a href="#phase-{esc(p["id"])}">{esc(p["title"])}</a>' for p in phases),
            '<a href="#motion">Motion</a>',
            '<a href="#decisions">Decisions</a>',
        ]
    )
    sections = "\n".join(
        f'<section id="phase-{esc(p["id"])}"><h2>{esc(p["title"])}</h2>{"".join(rows_by_phase[p["id"]])}</section>'
        for p in phases
    )
    summary = pairs_doc.get("summary", "")
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Linejam polish: survey, directions, before and after</title>
<style>
body{{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f3f2f5;color:#1f1b24}}
main{{max-width:1180px;margin:0 auto;padding:clamp(12px,3vw,24px)}}
h1{{margin:0 0 4px;font-size:1.6rem;line-height:1.2}} h2{{margin:40px 0 12px;font-size:1.3rem;border-bottom:1px solid #d9d5de;padding-bottom:6px}} section{{scroll-margin-top:64px}}
h3{{margin:0;font-size:1rem}}
nav{{position:sticky;top:0;background:#f3f2f5;padding:10px 0;z-index:1;display:flex;gap:16px;overflow-x:auto;white-space:nowrap;border-bottom:1px solid #d9d5de}}
nav a{{flex:none;color:#4b2386}}
.lede{{max-width:80ch}} .note{{color:#5b5563;margin:4px 0;font-size:.875rem;max-width:90ch}}
.pair,.direction,.motion{{background:#fff;border:1px solid #e3e0e7;border-radius:12px;padding:14px;margin:12px 0}}
.pair header,.direction header{{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}}
.images{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:8px}}
figure{{margin:0;min-width:0}} figcaption{{font-size:.8rem;color:#5b5563;margin-bottom:4px}}
.images img{{width:100%;max-width:360px;border:1px solid #e3e0e7;border-radius:8px;display:block}}
.direction img,.motion img{{width:100%;border:1px solid #e3e0e7;border-radius:8px;display:block}}
.gap{{font-size:.75rem;background:#efe8ff;color:#4b2386;border-radius:999px;padding:1px 8px;text-decoration:none}}
.tag{{font-size:.75rem;background:#eef0f3;border-radius:999px;padding:1px 8px}} .verdict{{font-size:.8rem;color:#205b43;font-weight:600}}
.missing,.none{{display:grid;place-items:center;min-height:120px;max-width:360px;border:1px dashed #c9c3d1;border-radius:8px;color:#6b6475;font-size:.85rem;text-align:center;padding:12px}}
.missing{{border-color:#b3261e;color:#b3261e}} code{{font-size:.8rem}}
.finalists{{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}
.finalists li{{background:white;border:1px solid #d9d5de;border-radius:12px;padding:16px}}
.finalists span{{display:block;color:#205b43;font-size:.85rem}} .finalists p{{margin:8px 0}}
.try{{display:flex;flex-wrap:wrap;gap:8px}} .try a{{display:inline-block;padding:10px 14px;border-radius:8px;background:#4b2386;color:white;font-weight:600;text-decoration:none;min-height:44px;box-sizing:border-box}}
a:focus-visible{{outline:3px solid #4b2386;outline-offset:3px}}
@media (max-width:700px){{.images,.finalists{{grid-template-columns:1fr}}.direction img,.motion img{{max-width:100%}}}}
</style></head><body><main>
<h1>Linejam polish: survey, directions, before and after</h1>
<p class="lede">{esc(summary)}</p>
<p class="note">For the decision and verification limits, read the <a href="RESUME.md">short review note</a>. Use your browser's Back control to return from a prototype.</p>
<nav>{nav}</nav>
<section id="finalists"><h2>Try three HTML finalists</h2>
<p class="lede">These are interactive proposals with sample players and simulated acceptance. They do not join a real room or save poems. Tidy Room is the conservative baseline; Passing Notes tests the fold; Tucked In is the recombined recommendation. Choose a direction before any production implementation.</p>
<ul class="finalists">{''.join(finalists)}</ul></section>
<section id="gaps"><h2>Ranked gaps from the survey</h2><ol class="gaps-list">{gap_items}</ol></section>
<section id="directions"><h2>Six directions and the synthesis</h2>{''.join(directions)}</section>
{sections}
<section id="motion"><h2>Motion</h2>{''.join(motion)}</section>
<section id="decisions"><h2>Decisions before implementation</h2>
<ol>
<li><strong>Reading turns.</strong> Recommended: share a Done reading signal, then move the reader lamp and show the recap only after the final reader finishes. Without a backend change, the current app still advances on opening a poem.</li>
<li><strong>Recap favorites.</strong> Recommended: personal favorites only; no ranked crown or heart count.</li>
<li><strong>Follow along.</strong> Recommended: a quiet listener action once the reader opens the poem, for anyone who needs to read it while listening.</li>
<li><strong>Line action.</strong> Recommended: “Tuck it in” with “Tucking in…” while pending, then “Tucked into the poem.” after acceptance. Alternative: retain “Submit”.</li>
</ol><p class="note">Read the <a href="notes/critique.md">comparative critique</a> and <a href="notes/synthesis.md">synthesis spec</a> for constraints, rejected options and implementation mapping. No decision here changes the live product.</p></section>
<section id="out-of-scope"><h2>Out of scope</h2><ul>{out_of_scope}</ul></section>
</main></body></html>
"""
    return page, problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--pairs", type=Path, default=HERE / "pairs.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    run = args.run.expanduser().resolve()
    page, problems = build(run, load(args.pairs), args.check)
    (run / "index.html").write_text(page, encoding="utf-8")
    print(f"wrote {run / 'index.html'}")
    if problems:
        print(f"{len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        return 1 if args.check else 0
    print("gallery: every declared image present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
