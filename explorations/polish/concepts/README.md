# Divergent concepts, inside the identity

Every concept keeps the locked identity in `../brief.md`: tokens, DynaPuff and Nunito
Sans roles, the eight-character cast, left-aligned whole poems. They differ in
structure, behavior and composition. Each is built as real HTML on the shared kit
(`../kit/`) so the fonts, colors, cast and copy are exact.

| # | Concept | Range | Archetype | Divergence claim |
| --- | --- | --- | --- | --- |
| 1 | Tidy Room | conservative | operate | Same screens and components as today; changes only hierarchy, chrome and copy so each screen has one focal point. |
| 2 | Passing Notes | evolutionary | operate | Writing, waiting and the next round become one continuous surface around a single note object whose fold and pass carry the state (object and behavior layers). |
| 3 | Round Table | radical | monitor | A persistent ring of seats, the cast around one table, is the content model for lobby, writing, waiting and reading (structure layer). |
| 4 | Poem Shape | radical | explore | The 1-2-3-4-5-4-3-2-1 silhouette is the progress and navigation spine; every screen shows where the group is in the shape (content-model layer). |
| 5 | Cast Companion | evolutionary | operate | Status and feedback move from text badges into the cast: your character stays with you and takes your line; roster states are character props (component and behavior layers). |
| 6 | Lights Down (wildcard) | out of frame | monitor | During reading, listeners' phones go dark and quiet and only the reader's phone is a page; deliberately breaks "no stage state" to test a quiet-listener idea. |

## Dimension positions

| Dimension | Tidy Room | Passing Notes | Round Table | Poem Shape | Cast Companion | Lights Down |
| --- | --- | --- | --- | --- | --- | --- |
| Primary job emphasis | clarity per phase | the pass | who is here | where we are | how I am doing | whose turn |
| Navigation / content | phase screens | one continuous desk | spatial ring | silhouette spine | phase screens, cast-led | phase screens, reading event |
| Layout | single column | centered object | ring and center | rail and content | column with companion | full-bleed reading |
| Density | airy | one object | people-first | data-calm | airy | minimal |
| Typography | Nunito hierarchy | Nunito on paper | names as labels | tabular counts | names primary | large reader name |
| Palette / material | flat tokens | paper white on lavender | flat, lit seats | violet bars | cast accents | Dark for listeners |
| Components | existing, fewer cards | note with fold | seats | bars and slots | character plus prop | page and listener card |
| Motion | three short fades | fold, pass, arrive, unfold | one light around the ring | bars fill | one settle per change | lights dim, page glows |
| Organization | by phase | by object | by person | by poem and time | by person | by turn |

## Common screen set (so critique compares like with like)

All at 390x844 CSS px, sample content from `../kit/content.js` (you are Juniper,
the host, reader of Poem 4). Every screen also renders with `?theme=dark`.

| Screen id | State |
| --- | --- |
| `lobby-host` | Host lobby: code 9A UK with QR, four players including the long name, Start enabled. |
| `writing` | Round 5 of 9 (5 words). Received line "the kettle keeps secrets". Typed "and nobody asked" (3 of 5). Working input: typing updates the count; at exactly 5 words Submit enables; Submit plays the acceptance choreography into the waiting composition. |
| `waiting` | After your round-5 line was accepted: Wren submitted, Basil writing, Marguerite away, Pim (joined late) watching. |
| `reading-turn` | Reading circle while Marguerite reads Poem 1; you hold Poem 4, last in the order. |
| `poem-open` | Poem 1 open, all nine lines together, with attribution handled by the concept. A working open action plays the concept's poem-open choreography. |

Each concept folder holds `index.html`, `style.css`, optional `app.js`, and a
`README.md` with stance, IA and journey, motion spec, cited principles, how it
answers the ranked gaps, risks, and what it does not cover. No raster images.
