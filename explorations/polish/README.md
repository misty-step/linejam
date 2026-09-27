# Linejam polish exploration

Design-studio loop for the operator's request: world-class UI, UX and aesthetic polish
inside Linejam's existing identity. Nothing here changes the live product; `DESIGN.md`
remains the contract until a direction is accepted.

| File | What it is |
| --- | --- |
| `brief.md` | Intake: jobs, locked requirements, motion rule, ranked survey gaps with evidence, references. |
| `concepts/` | Six divergent directions as real HTML, each with a README (stance, IA, motion spec, answers to the gaps, risks, verdict). |
| `critique.md` | Comparative critique, the synthesis, and the decisions only the operator can make (D1 to D4). |
| `synthesis/` | Tucked In, the recommended direction: spec (`README.md`), foundation API (`FOUNDATION.md`), and every surveyed state rebuilt as a screen. |
| `kit/` | Shared prototype kit: tokens generated from `lib/design/tokens.ts`, the shipped fonts (symlinked from `public/fonts`), the eight shipped characters, sample content, a real QR, and the screen harness. |
| `tools/` | `pairs.json` (every before state paired with its after state) and `pair_gallery.py` (builds the review gallery, fails closed on missing images). |

## Viewing

Serve this directory and open any page:

```sh
python3 -m http.server 7788 --bind 127.0.0.1 --directory explorations/polish
# http://127.0.0.1:7788/synthesis/index.html            board of every state
# http://127.0.0.1:7788/synthesis/index.html?group=reveal
# http://127.0.0.1:7788/synthesis/index.html?screen=31-writing-r5-under-count&theme=dark
# http://127.0.0.1:7788/concepts/<id>/index.html        each divergent concept
```

`?theme=dark` renders Dark, `?text=200` renders 200% text, `?screen=<id>` one state.

The review copy at `/home/phaedrus/review/linejam/index.html` includes the
before/after gallery, motion strips and three clickable HTML finalists: conservative
Tidy Room, tactile Passing Notes and the recommended Tucked In synthesis. Use the
browser Back control to return from a prototype. The other concepts remain in the
comparison with their captures and rejection reasons. These are proposals, not
live game routes; no backend operation or production change is implied.

## Evidence

Screenshots and recordings are not committed. They live in
`~/.cache/visual-states/linejam/20260926-polish/`:

- `before/`: today's app, captured from a real four-player game plus a late joiner
  and a fresh visitor on the isolated local stack on `linejam-ws` (revision `66d448d`),
  with `manifest.json` (states, coverage, limitations, findings).
- `concepts/<id>/`: each direction in Light and Dark plus its acceptance motion.
- `after/`: the synthesis, one image per paired state and variant, plus `after/motion/`.
- `concepts/synthesis/_sheet.png`: five paired Light/Dark states from the after
  captures, assembled for the direction comparison.
- `prototype/`: three clickable finalists and a standalone kit with copied fonts.
- `RESUME.md` and `notes/`: review note, critique and synthesis spec.
- `index.html`: the gallery, with 114 declared comparisons and checked links.

To rebuild from the retained captures, first bundle the prototype assets beside
them; `--check` rejects missing finalist pages, notes, images and motion videos.
Run from the repository root:

```sh
run="$HOME/.cache/visual-states/linejam/20260926-polish"
mkdir -p "$run/prototype/kit" "$run/prototype/synthesis" \
  "$run/prototype/concepts/tidy-room" "$run/prototype/concepts/passing-notes" \
  "$run/notes" "$HOME/review/linejam"
cp -RL explorations/polish/kit/. "$run/prototype/kit/" # copy fonts, not the symlink
cp -R explorations/polish/synthesis/. "$run/prototype/synthesis/"
for id in tidy-room passing-notes; do
  cp -R "explorations/polish/concepts/$id/." "$run/prototype/concepts/$id/"
done
cp explorations/polish/critique.md "$run/notes/critique.md"
cp explorations/polish/synthesis/README.md "$run/notes/synthesis.md"
cp explorations/polish/RESUME.md "$run/RESUME.md"
python3 explorations/polish/tools/pair_gallery.py --run "$run" --check
for dir in before after concepts prototype notes; do
  mkdir -p "$HOME/review/linejam/$dir"
  cp -R "$run/$dir/." "$HOME/review/linejam/$dir/"
done
cp "$run"/{index.html,RESUME.md} "$HOME/review/linejam/"
```

The rebuilt `run/index.html` and the published `review/linejam/index.html` have
the same relative links. Prototype captures prove appearance, not product
behavior. The before captures prove what the current product renders on the
isolated stack, not a hosted deployment.
