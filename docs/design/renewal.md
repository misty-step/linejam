# Linejam design renewal

## Outcome

The operator selected a hybrid of these explorations as Linejam's production
identity: Jelly Chorus's composition and palette, Fold Club's lobby layout and
approachable copy, and Word Carnival's brevity. That decision, its per-surface
consequences and its acceptance bar now live in [DESIGN.md](../../DESIGN.md);
the implementation is in the application source, not here.

This directory is the retained exploration: the audit that motivated the change,
five complete alternatives, and their verification receipts. It is evidence and
reference, not a second component system, and no direction here is the shipped
design. The earlier recommendation in this document (develop Fold Club first)
was superseded by the operator's selection.

## Inspect the work

```bash
pnpm design:explore
# Open http://127.0.0.1:4400
# Without a host pnpm installation: node scripts/design/serve.mjs
# Ctrl-C stops the exploration server.
```

The comparison atlas presents the same view, component, motion or sensory element
in all five directions. Its workbench accepts real typing and keyboard/mouse
interaction; open a direction separately for its complete offline nine-round
sketch. Choose light/dark, reduced motion, viewport and named state cues. Search
the inventory to reach individual treatments and their source owners.

These are **interaction prototypes, not multiplayer implementations**. Local
fixtures represent accounts, other players, publication and persistence. They do
not claim that real sign-in, native sharing or backend authorization occurred.
Fonts and original SVG artwork are served locally; no provider credentials,
remote fonts or telemetry are required.

- [Inventory](../../explorations/renewal/inventory.json), recorded for the exploration: 41 views, 71 component and
  composition owners, 25 motion/lifecycle elements, 13 sensory elements.
- [Audit](../../explorations/renewal/audit-source.json): operator observations,
  source-grounded contributors, consequences and verification questions.
- [Brief](../../explorations/renewal/brief.json): the five independent territories.
- Each territory's `direction.json`: explicit treatment of every inventory ID;
  750 treatments across the five, not 750 independently implemented components.
- Each territory's `verification.json`: exercised browser cases, corrections,
  evidence paths and limitations. The [atlas receipt](../../explorations/renewal/verification.json)
  links them and fingerprints the 67 source, asset, font and per-direction receipt files.
- [References](renewal-references.md): primary sources and the specific principles
  borrowed, with the distinction between maker claims and inspected imagery.

## Five complete alternatives

| Direction            | Identity and composition                                                                                                          | Interaction and sensory language                                                                                                                   | Principal risk                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fold Club**        | Cobalt, bright paper, original folded mark; friendly Bricolage display type; one sheet rather than cards inside cards.            | The received line, writing surface, folded acknowledgement and opened poem are one object. Paper-cut avatars; brief optional physical punctuation. | Literal craft can become fussy. No scrapbook tape, grain, tilted text or decorative stacks around every utility.                                      |
| **Jelly Chorus**     | Expressive soft companions around a quiet writing plane; lavender and restrained DynaPuff branding.                               | Arrivals feel social. Faces accompany explicit human-readable states, never judge speed; companions step aside for writing and reading.            | Can feel childish or make a slow writer feel watched. Adult voice and neutral waiting states are essential.                                           |
| **Midnight Matinee** | A pocket theatre: plum, lavender daylight, restrained gold, readable serif entrance and a generous whole-poem stage.              | Writing is backstage; the complete poem is the performance. Curtain movement stays at the edges and never delays text.                             | Performance pressure and premium/casino associations. Step-in, exit, silent play and daylight remain first-class.                                     |
| **Word Carnival**    | Screen-printed geometric letters, original interlocking mark, graphic color; Bungee only for brand moments, Atkinson for reading. | Count sockets and physical word placement acknowledge the existing constraint; the final artifact is an orderly print.                             | Can imply competitive word puzzles or become loud. No scores, flashing, countdown pressure or correctness beyond word count.                          |
| **Odd Garden**       | An eccentric botanical cast, deep green, warm pale ground and a humane writing/reading face.                                      | Small contributions form an unexpected specimen; original characters make arrival and completion memorable, then recede.                           | Can drift into wellness, collection mechanics or an austere literary journal. Literal game verbs and genuinely odd illustration keep it a party game. |

Each direction includes the ordinary repair and utility surfaces, not just a
landing page: host/join, lobby and shared display, writing, waiting, late arrival,
reading circle, whole poem, recap/rematch, archive, public/private artifact
variants, account states, help, appearance, releases, errors, social cards, image
and print compositions, controls, motion and sensory settings.

## Pre-selection audit (historical)

The operator's reports of noise, poor components, awkward/missing motion,
inconsistent type size and spacing are the starting evidence. Source inspection
locates contributors; it does not invalidate those observations.

| Source-grounded contributor                                                                                                                                 | Design decision                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Custom Tailwind type scale plus stock/arbitrary sizes; very large status/form text beside tiny tracked metadata (`lib/design/tokens.ts`, `app/globals.css`) | One explicit type hierarchy for handheld tasks, utilities and shared-screen reading. Oversized type must earn its place.                                                                   |
| Room code, readiness and player count repeated in chrome, cards, roster and actions (`Lobby`, `RoomChrome`)                                                 | One dominant invitation/readiness composition; optional tools become secondary without disappearing.                                                                                       |
| Grain, accent shadows, borders, blur and nested surfaces compete                                                                                            | One coherent material/depth grammar per direction. Quiet is not the same as sterile.                                                                                                       |
| Host and Join differ in geometry and vocabulary                                                                                                             | A coherent entry family with clear create/join verbs, invite context and keyboard focus.                                                                                                   |
| Large textarea and spacing separate a short carried line from its constraint; unbroken chips can exceed clipped frames (`WritingScreen`, `WordSlots`)       | One compact writing task: prior line, editable contribution, word target, reachable submission. Long text wraps rather than vanishes.                                                      |
| Waiting duplicates progress and crosses out contributors                                                                                                    | Positive personal acknowledgement plus one group-progress signal; names distinguish writing, ready, away and watching. No side game.                                                       |
| Reveal/recap accumulate competing controls; attribution consumes line gutters (`RevealPhase`, `PoemDisplay`, `SessionRecapHub`)                             | An uninterrupted whole poem and one clear continue action; persistent-on-request attribution; completion makes the next social choice obvious.                                             |
| Private exports and public publication sit close together                                                                                                   | Separate keeping from publishing, state one-poem versus whole-set scope, and honor actual viewer capability. Native cancellation must not publish.                                         |
| Small avatars, repeated role/favorite crown, inconsistent favorite feedback                                                                                 | Stable name/shape pairs; distinguish host authority from appreciation. Any change to the current favorite-leader presentation remains an explicit proposal, not a hidden mechanics change. |
| Independent animation loops, delayed reduced-motion states and unused effects                                                                               | A short causal motion score: arrival, readiness, confirmed send, reveal, completion. Reduced motion shows the final state immediately.                                                     |
| Layered recovery banners and inconsistent overlay focus/scroll ownership                                                                                    | Explicit urgency and focus lifecycles. Recovery must tell the truth about unsaved text, connection and available action.                                                                   |
| Full-card sizing assumes little wrapping; print and social artwork have separate composition rules                                                          | One artifact family, but distinct layouts for teaser, complete attributed keepsake and print. Never crop a full poem to make it fit.                                                       |

The full audit preserves the original observations and exact paths. Its design
recommendations are retained history, not a current backlog or a second set of
instructions for component rewrites. [DESIGN.md](../../DESIGN.md) owns the
selected system; follow-on work and current priorities belong in Linear.

## What remains invariant

- Nine human-authored rounds with word targets `1,2,3,4,5,4,3,2,1`.
- A writer sees only the carried previous line. Late arrivals do not alter the
  current assignment matrix or gain hidden content.
- Soft pacing, not forced submission or a new scoring system.
- Complete poems revealed for human reading; no compulsory line-by-line reveal,
  announcer, generated authorship or new synchronized performance protocol.
- Real guest access and explicit, reversible publication boundaries. Private
  saving is not publication; synthetic exploration cannot authorize it.
- All contributors remain attributable. Silent, reduced-motion, keyboard and
  enlarged-text use remain complete experiences, not stripped alternatives.

## Transition record and evidence limits

1. The five sketches were judged at the same moments: arrival, a one-word turn,
   a five-word turn, group waiting, whole-poem reading and choosing what happens
   next. The operator selected across territories rather than one whole skin.
2. The selected system was implemented through the owning production components,
   with the superseded implementation removed rather than kept behind a theme
   switch.
3. Type, shape, spacing and the avatar cast were then checked against long human
   names, long words, light/dark, enlarged text and shared-display use.
4. The same identity carries into archive, account/recovery surfaces and
   generated artifacts.
5. Real groups on phones, with physical keyboards, reconnects and accessibility
   needs, remain the open question. Observation there can still change the
   design; browser verification cannot settle it.

Browser prototype evidence does not establish product demand, physical keyboard
behavior, screen-reader quality, heard audio, native OS delivery or hosted account
integration. Those distinctions are retained in the verification receipts rather
than hidden behind a blanket claim that the redesign is validated.
