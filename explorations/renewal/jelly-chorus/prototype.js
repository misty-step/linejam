'use strict';
// Offline, synthetic design sketches. No gameplay, account or telemetry requests.
const CATALOG = {"view":[{"id":"app-shell","label":"Application shell and identity","description":"The joined mark anchors an open lavender field. Practical navigation sits on one quiet line above the content plane; focused play keeps only home, help and appearance."},{"id":"home","label":"Start or join a game","description":"A split entrance pairs a short DynaPuff headline with three original jelly silhouettes passing one white writing plane. A three-step strip explains the real game below."},{"id":"host-entry","label":"Create a room","description":"One small companion sits beside the arrival heading; a plain white name form has one large start-room button and a subordinate avatar drawer link."},{"id":"join-entry","label":"Join by code or invitation","description":"The same quiet name plane adds a literal four-letter code field; invitation state locks the code and moves attention to pen name."},{"id":"room-lobby","label":"Room lobby and roster","description":"A large room destination tops one shared white plane. Named silhouettes form a shallow curved chorus along its lower edge; the host action stays beneath the people."},{"id":"lobby-presentation","label":"Lobby shared-screen presentation","description":"The shared display enlarges the code and chorus on the same single plane. A destination panel reserves QR space without inventing a live scannable code."},{"id":"room-writing","label":"Compose and submit a hidden line","description":"One unshaped white writing plane contains only the preceding line, exact next word target, textarea and count. A tiny companion retreats outside the text edge on wide screens."},{"id":"room-waiting","label":"Submitted and group-waiting state","description":"The accepted line receipt sits above a quiet group-presence row on the shared plane. Waiting remains informational, not an empty spinner."},{"id":"late-join-spectator","label":"Late join and spectator view","description":"A quiet companion and plain watching note replace the writing plane; current group progress is visible without any hidden draft."},{"id":"reveal-circle","label":"Reveal assignments and reading circle","description":"A reading-order list replaces the lobby chorus. The current reader gets a small companion and one open-poem action; unrevealed poems remain as truthful nine-line silhouettes."},{"id":"poem-reading","label":"Whole poem reading and in-room reread","description":"The full nine-line poem is a generous left-aligned white plane with a quiet reader line above and one small marginal companion outside the text."},{"id":"reveal-presentation","label":"Shared-screen reveal and reading stage","description":"An enlarged complete-poem plane takes almost the entire shared display; a restrained reader identity sits above it and running order follows."},{"id":"session-recap","label":"Completed room recap and rematch","description":"The finished set is arranged as a readable poem sheet plus a practical side column for private saving and continuing together. A small chorus closes the evening, not a leaderboard."},{"id":"room-unavailable","label":"Missing, closed, expired or nonmember room","description":"A still companion holds an empty plane beside a direct unavailable heading; no secret roster, poem snippet or nonexistent-room diagnosis is exposed."},{"id":"room-recovery","label":"Room-level and phase-level recovery","description":"Keep the room shell and replace only the failed content plane with a readable recovery block; retained draft text is explicitly distinguished from confirmed delivery."},{"id":"guest-session-recovery","label":"Guest connection/authentication recovery","description":"A name-preserving entry plane shows a guest connection alert and retry; the brand companion stays neutral at the margin."},{"id":"connection-notice","label":"Offline, reconnecting and restored status","description":"A compact in-flow transport strip appears above the writing plane; the draft and count remain visible below it."},{"id":"deployment-update","label":"Updated deployment notice","description":"A persistent slim update strip sits above the current task plane and never covers the textarea or utility controls."},{"id":"archive","label":"Personal archive","description":"A quiet collection heading and preservation note sit above two broad poem sheets, not a dense stats dashboard. Personal favorites remain a private convenience."},{"id":"poem-detail","label":"Participant poem detail and archive reread","description":"The same whole-poem plane used in reading appears in stable page flow with an archive return link and a separate private/public status footer."},{"id":"public-poem","label":"Outsider public or unavailable poem","description":"An explicitly public complete poem uses the same restrained plane, but nonparticipant actions omit favorite and revoke. Private/pending fallback contains no poem text."},{"id":"poem-sharing","label":"Poem link sharing and cancellation","description":"An inline publication section sits beside the complete poem, visually separate from private download. The consent text names one poem, not the whole room."},{"id":"recap-sharing","label":"Whole-session link sharing","description":"The same consent treatment expands its scope to the whole set and lists every included synthetic poem before its action."},{"id":"poem-image-export","label":"Downloadable full poem image","description":"A tall full-image specimen keeps all nine lines and every line attribution; the small joined mark sits in the footer, not over the poem."},{"id":"poem-print","label":"Single-poem print output","description":"Ink-on-white whole-poem print composition removes controls, companions, color panels and shadows while retaining all human attribution."},{"id":"public-recap","label":"Public session recap and whole-set export","description":"A public set heading precedes every complete poem article with starter, reader and all authors. A small chorus appears only in the set footer."},{"id":"sign-in","label":"Sign-in entry and provider form","description":"A practical account form plane stands beside a still public synthetic poem example; local accounts-unavailable is a complete alternative, not a fake working provider."},{"id":"sign-up","label":"Sign-up entry and provider form","description":"The same optional account plane explains preservation plainly and keeps the public example secondary; no mascot onboarding checklist."},{"id":"auth-callback","label":"Account completion and guest migration","description":"A quiet completion plane describes linking the existing guest work, with a neutral companion and recoverable error section."},{"id":"profile","label":"Identity and account status","description":"A plain identity summary pairs the chosen silhouette with the visible pen name, session scope and optional provider-managed account links."},{"id":"account-controls","label":"Account popover and provider account management","description":"A bounded account menu groups profile, poems and provider management under a stable name-bearing trigger."},{"id":"help","label":"How to play dialog","description":"A concise rules plane uses the real nine-count shape and three numbered game steps, with a single quiet companion below rather than decorative comic panels."},{"id":"appearance","label":"Color-mode controls and popovers","description":"Light, dark and system choices use native radio rows with a live small writing-plane preview; sound and motion are separate explicit preferences."},{"id":"releases","label":"Product release notes","description":"A plain reading column carries version/date and useful product notes; one joined mark in the header is enough personality."},{"id":"releases-feed","label":"Syndicated release feed","description":"A restrained feed-reader specimen shows title, date, excerpt and link; raw XML is available through a native disclosure."},{"id":"not-found","label":"Not-found fallback","description":"A neutral jelly holds an empty plane beneath a concise missing-page heading; there is no enormous decorative 404 blocking the exit."},{"id":"route-error","label":"Route error boundary","description":"A plain recoverable error plane leaves the surrounding navigation usable; the companion is static and subordinate."},{"id":"global-error","label":"Root application error boundary","description":"A self-sufficient high-contrast emergency section uses system-font fallback, plain text and native buttons even if normal identity resources fail."},{"id":"site-social-preview","label":"Site social-link artwork","description":"A fixed-proportion light artwork specimen places the joined wordmark and a short party-game line beside the original three-character chorus."},{"id":"poem-social-preview","label":"Poem public-link preview artwork","description":"The public teaser shows three opening lines on a plain light sheet and modest attribution count, with one marginal companion. Private fallback is only joined branding and an empty shape."},{"id":"recap-social-preview","label":"Session public-link preview artwork","description":"A light set-level composition pairs two slim poem silhouettes/previews under the joined mark and an explicit set title; no winning-poem hero."}],"component":[{"id":"root-layout","label":"RootLayout","description":"Open lavender shell, joined mark and one white content plane; nonvisual provider wrappers do not become fake visual cards."},{"id":"header","label":"Header and account adapters","description":"Joined mark plus quiet named help and appearance controls; account/archive live in a bounded drawer on narrow screens."},{"id":"footer","label":"Footer","description":"A quiet baseline for rules, release notes and sketch/comparison return; no decorative chorus row."},{"id":"home-page","label":"Home","description":"Headline beside original chorus passing a white writing plane, then the real three-step game sequence."},{"id":"host-page","label":"HostPage","description":"Plain pen-name plane and one small margin companion; optional avatar drawer never blocks create."},{"id":"join-page","label":"JoinPage","description":"Literal code/name sequence on the same plain plane, with synthetic DEMO destination explicitly labeled."},{"id":"room-page","label":"RoomPage","description":"Phase shell dispatches chorus lobby, quiet composer and complete reading plane rather than exposing orchestration internals."},{"id":"unexpected-room-state","label":"UnexpectedRoomState","description":"A neutral shared-plane fallback gives refresh/rejoin explanation and a direct home exit."},{"id":"lobby","label":"Lobby","description":"Destination above a curved named chorus, role-sensitive start/leave below."},{"id":"writing-screen","label":"WritingScreen","description":"Quiet round shell with one composer; no-assignment uses an actual watching explanation."},{"id":"writing-composer","label":"WritingComposer","description":"Previous line, exact target, plain textarea, count strokes and Send line; character retreats outside the sheet."},{"id":"waiting-screen","label":"WaitingScreen","description":"Accepted receipt and neutral named presence; no pulsing active writers or strike-throughs."},{"id":"reveal-phase","label":"RevealPhase","description":"Vertical reading order with current human reader and one Reveal and read action; unrevealed work stays a silhouette."},{"id":"poem-display","label":"PoemDisplay","description":"Generous complete-poem plane, persistent native author disclosure and optional artifact footer."},{"id":"session-recap-hub","label":"SessionRecapHub","description":"Completed set with practical private-save/continue column; personal hearts replace room-ranking crown."},{"id":"stage-shell","label":"StageShell","description":"Spacious shared-display shell, current phase and permanent Exit presentation; no theatre curtain metaphor."},{"id":"lobby-stage","label":"LobbyStage","description":"Extra-large destination and stable full-name chorus instead of tiny illustrated attendance badges."},{"id":"lobby-join-qr","label":"LobbyJoinQr","description":"Framed destination module with readable demo join link; no fake scannable QR decoration."},{"id":"reveal-stage","label":"RevealStage","description":"One enlarged whole-poem plane with reader identity and running order beneath."},{"id":"room-chrome","label":"RoomChrome","description":"Compact joined mark, literal round status and small tools drawer; code is a lobby priority, not repeated clutter."},{"id":"focused-entry-appearance","label":"FocusedEntryAppearance","description":"Small named appearance button opens the same bounded choice drawer as global chrome."},{"id":"color-mode-control","label":"ColorModeControl","description":"Native light/dark/system radio rows with a quiet writing-plane preview."},{"id":"help-modal","label":"HelpModal","description":"Real nine-count shape and three rule steps with one subordinate companion inside native dialog."},{"id":"connection-status","label":"ConnectionStatus","description":"In-flow transport strip above composer; hollow offline mark plus literal text."},{"id":"deployment-skew-observer","label":"DeploymentSkewObserver","description":"Persistent update strip with explicit reload; nonvisual rejection bridge is not a fake UI card."},{"id":"room-panel-error-boundary","label":"RoomPanelErrorBoundary","description":"Failed plane replaced by calm recovery block; room navigation and retained-draft explanation remain."},{"id":"auth-error-state","label":"AuthErrorState","description":"Guest-retry plane with inline error, not an account upsell."},{"id":"accounts-unavailable","label":"AccountsUnavailable","description":"Truthful local-account explanation, still companion and Play as guest."},{"id":"archive-page","label":"ArchivePage","description":"Broad readable poem sheets and modest preservation note, not a stats dashboard or invented filter UI."},{"id":"archive-info-strip","label":"ArchiveInfoStrip","description":"Plain browser-session scope note with optional account link; no warning mascot or upsell card."},{"id":"archive-stats","label":"ArchiveStats","description":"Four quiet factual totals in a row, not motivational score tiles."},{"id":"stat-line","label":"StatLine","description":"Nunito label and modest DynaPuff quantity distinguish count from poem text."},{"id":"archive-stats-skeleton","label":"ArchiveStatsSkeleton","description":"Static neutral bars reserve the modest statistics space with one loading status."},{"id":"poem-card","label":"PoemCard","description":"Broad plain sheet, truthful shape, visible first line/byline; favorite is outside Read link."},{"id":"poem-card-skeleton","label":"PoemCardSkeleton","description":"Static line shape and byline placeholders reserve actual sheet geometry."},{"id":"empty-archive","label":"EmptyArchive","description":"Open empty writing plane and quiet companion invite Start or Join; no trophy or sorrow."},{"id":"poem-silhouette","label":"PoemSilhouette","description":"Nine rounded strokes follow 1,2,3,4,5,4,3,2,1, left aligned like actual poem lines."},{"id":"poem-silhouette-compact","label":"PoemSilhouetteCompact","description":"Retire unused extra variant; render canonical nine-line shape in a clearly labeled retirement specimen."},{"id":"author-dots","label":"AuthorDots","description":"Distinct tiny silhouettes with always-readable contributor names/count and native full-name disclosure."},{"id":"author-dots-inline","label":"AuthorDotsInline","description":"Retire unused gradient-underline variant in favor of plain author-name line."},{"id":"poem-detail","label":"PoemDetail","description":"Access-aware owner around complete-poem plane with return path and separate privacy actions."},{"id":"recap-page","label":"RecapPage","description":"Every poem is a full article with starter, reader and all line authors under public-set heading."},{"id":"recap-export-button","label":"RecapExportButton","description":"Literal Print or save as PDF action outside poem articles."},{"id":"auth-layout","label":"AuthLayout","description":"Optional account form plane and still synthetic public-poem example; joined mark is guest-safe exit."},{"id":"sign-in-page","label":"SignInPage","description":"Nunito provider-appearance specimen on plain plane with visible guest continuation."},{"id":"sign-up-page","label":"SignUpPage","description":"Coherent optional preservation form, never a gameplay gate."},{"id":"auth-callback-page","label":"AuthCallbackPage","description":"Neutral completion plane with guest-work safety and retry/home on migration failure."},{"id":"auth-showcase","label":"AuthShowcase","description":"Complete synthetic poem and attribution with tiny margin companion; not animated marketing."},{"id":"profile-page","label":"ProfilePage","description":"Noneditable identity summary with pen name, silhouette and browser/account scope."},{"id":"releases-page","label":"ReleasesPage","description":"Readable product-note column, small version/date and native technical disclosure."},{"id":"release-card","label":"ReleaseCard","description":"Article separated by one rule, product prose before technical change groups."},{"id":"technical-details","label":"TechnicalDetails","description":"Native details/summary puts technical content quietly beneath human-facing updates."},{"id":"not-found-page","label":"NotFound","description":"Neutral original jelly and literal missing-page heading, not giant ornamental 404."},{"id":"route-error-page","label":"Error","description":"Task-neutral failure copy on plain plane with Retry and Home."},{"id":"global-error-page","label":"GlobalError","description":"Self-sufficient emergency block with system-font fallback, no dependent art or providers."},{"id":"button","label":"Button","description":"Solid plum commit, outline secondary and quiet utility; soft action corners without blob containers."},{"id":"input","label":"Input","description":"Plain rectangular native field, Nunito label and modest corners, never blob-filled."},{"id":"label","label":"Label","description":"Sentence-case Nunito metadata instead of tracked uppercase mono decoration."},{"id":"alert","label":"Alert","description":"Straight leading rule and icon, literal title/body/action, distinct from the cast."},{"id":"avatar","label":"Avatar","description":"Original arch, twin-lobed and rounded-square non-gendered silhouettes with selectable brow/accessory."},{"id":"host-badge","label":"HostBadge","description":"Plain Host text on small rectangular tint; deliberately no favorite crown."},{"id":"loading-state","label":"LoadingState","description":"Still companion, neutral bridge-shape placeholder and explicit busy copy."},{"id":"round-clock","label":"RoundClock","description":"Quiet optional soft-pacing text instead of urgent draining line; overtime says no deadline."},{"id":"stamp-animation","label":"StampAnimation","description":"Replace rotated stamp with one 410ms squash-and-settle of actual arriving companion."},{"id":"word-slots","label":"WordSlots","description":"Small count strokes and numeric sentence below input, not duplicate typed-word chips."},{"id":"heart-button","label":"HeartButton","description":"Quiet outlined heart plus Favorite, separate from reading/navigation and room ranking."},{"id":"site-social-card","label":"Site ImageResponse composition","description":"Joined wordmark and original chorus in light 1200:630 specimen with short game sentence."},{"id":"poem-preview-card","label":"poemPreviewCardElement","description":"Three authorized teaser lines on plain light plane with modest attribution and companion."},{"id":"poem-fallback-card","label":"poemFallbackCardElement","description":"Joined branding and empty true nine-count shape only, no blurred private text."},{"id":"poem-full-card","label":"poemFullCardElement","description":"Tall whole-poem sheet with nine lines, per-line authors and restrained footer mark."},{"id":"recap-social-card","label":"Recap ImageResponse composition","description":"Set title with two authorized preview columns; no favorite hierarchy."}],"motion":[{"id":"global-reduced-motion","label":"Global reduced-motion policy","description":"Final static positions for the whole chorus and writing plane; explicit replay still announces the outcome.","timing":"0ms with OS or local reduce enabled; no preserved stagger delay.","reducedMotion":"OS preference cannot be overridden off by the sketch; local override can reduce further."},{"id":"color-mode-transition","label":"useColorMode / applyColorMode","description":"Apply independently authored light/dark tokens without fading readable text or inverting illustration.","timing":"Immediate mode switch; no page-wide color sweep.","reducedMotion":"Identical immediate switch, native checked state remains visible."},{"id":"viewport-projection","label":"useVisualViewport","description":"Natural in-flow composer, growing textarea and safe-area padding replace fixed keyboard-covering trays.","timing":"Functional viewport reflow only, never animated keyboard chasing.","reducedMotion":"Same geometry; actual mobile software keyboard needs Main runtime inspection."},{"id":"writing-focus-scroll","label":"Writing focus and round reset","description":"New round heading receives focus once; focus-textarea action uses nearest automatic scrolling only.","timing":"Immediate focus and auto scroll; no 300ms delayed camera move.","reducedMotion":"Same functional focus, no smooth motion."},{"id":"button-press","label":"Shared button and native control feedback","description":"Commit button moves down 2px on deliberate press; no squash of text or disabled controls.","timing":"180ms one shot; hover lift 140ms only for buttons.","reducedMotion":"No transforms, transition or movement; fill and native focus carry state."},{"id":"stamp-arrival","label":"StampAnimation / animate-stamp","description":"New companion squashes once along the shared chorus baseline, never staggered from invisible.","timing":"410ms squash/settle, no per-player delay.","reducedMotion":"Static final silhouette and Just joined text instantly."},{"id":"loading-indicators","label":"Loading pulse and auth spinner","description":"Still bridge-shaped placeholder and explicit busy sentence replace pulses and spinners.","timing":"No loop; busy state lasts only as actual operation does.","reducedMotion":"Same readable static content."},{"id":"fade-up-entrances","label":"Common fade/slide entrances","description":"Retire scattered upward slides; one quiet whole-plane appearance on deliberate phase change.","timing":"140ms opacity for utilities, 300ms for complete poem; no stagger.","reducedMotion":"Immediate fully opaque content with identical focus/order."},{"id":"archive-card-interaction","label":"Archive stagger and hover detail","description":"Retire hover lift, hidden arrows and stagger; Read poem and Favorite stay visible.","timing":"Immediate border/fill and native focus; no card movement.","reducedMotion":"Identical static layout."},{"id":"silhouette-bars","label":"Poem silhouette bar reveal","description":"All nine true-count strokes remain visible at once; no horizontal growth on hover.","timing":"0ms static pattern.","reducedMotion":"Same complete pattern and accessible count sequence."},{"id":"contributor-hover","label":"AuthorDots hover and stagger","description":"Retire bouncing anonymous dots; native name disclosure opens on deliberate action.","timing":"Immediate disclosure; no delay or scale.","reducedMotion":"Same persistent name list, no timed disappearance."},{"id":"waiting-presence-pulse","label":"Active writer presence pulse","description":"Retire pulsing active-writer rings and struck-through names; neutral presence list stays still.","timing":"No repeating motion or urgency state.","reducedMotion":"Same named presence and group-waiting explanation."},{"id":"round-clock-drain","label":"useRoundClock and soft pacing line","description":"Replace visual drain with quiet soft-pacing language; overtime explicitly allows continued writing.","timing":"Functional copy change only, no ticking visual or live countdown.","reducedMotion":"Same no-deadline meaning and enabled valid submission."},{"id":"word-slot-feedback","label":"WordSlots fill and overflow feedback","description":"Small markers fill instantly beside one numeric count sentence; overflow changes text and border, not input geometry.","timing":"Immediate visual state; 500ms debounced polite count announcement.","reducedMotion":"Same immediate fill/text, no per-slot delay."},{"id":"ready-seal-loop","label":"Writing ready-state emphasis","description":"Delete infinite ready ring; valid input shows Ready to send and a solid enabled button.","timing":"No loop; readiness is stable until count changes.","reducedMotion":"Identical textual readiness and enabled native button."},{"id":"submission-confirmation","label":"Submit confirmation and waiting handoff","description":"Stored local line receipt appears first, then one margin-companion squash; waiting handoff is explicit in this offline sketch.","timing":"410ms one shot; no arbitrary hold before next real state.","reducedMotion":"Receipt and final pose immediately; no forced confirmation wait."},{"id":"author-attribution-reveal","label":"Poem author-marker reveal","description":"Native Show authors disclosure reveals persistent per-line human names, not a two-second tooltip.","timing":"Immediate open/close, no auto-hide timer.","reducedMotion":"Same persistent disclosure and keyboard semantics."},{"id":"help-open-close","label":"Help modal entrance and focus lifecycle","description":"Bounded native dialog appears in place, locks background scroll, closes with Escape and restores trigger.","timing":"140ms opacity on open; immediate close.","reducedMotion":"No animation; focus lifecycle unchanged."},{"id":"chrome-popover-feedback","label":"Header/room/entry popover controls","description":"Help, appearance, avatar and account share one bounded native drawer lifecycle.","timing":"140ms opacity only, no spring movement.","reducedMotion":"Immediate panel; same close and focus restoration."},{"id":"reading-target-focus","label":"Reveal reading focus and announcements","description":"Full poem appears together; heading receives one focus move and status names reader, not every line.","timing":"300ms whole-plane open or 0ms when rereading.","reducedMotion":"Whole text immediately visible; same heading focus and semantic order."},{"id":"stage-roster-highlight","label":"Stage join highlight","description":"New named member receives a static Just joined chip and one restrained companion settle.","timing":"410ms character settle; chip remains until next sketch state, not a hurried timer.","reducedMotion":"Chip appears immediately and shape remains still."},{"id":"favorite-crown-ceremony","label":"Room-favorite crown and burst","description":"Retire crown, burst and leader-change audio. Favorite is a private heart toggle with a plain confirmation.","timing":"Immediate pressed fill; no ranking ceremony.","reducedMotion":"Identical pressed state and readable status."},{"id":"ceremony-effects-hook","label":"useCeremonyEffects audio/haptic gating","description":"One shared opt-in audio context plays a bounded soft marimba-like cue only on deliberate confirmed local action.","timing":"260ms maximum envelope, rate limited; no background track, speech or random squeaks.","reducedMotion":"Sound remains off by default and may be previewed explicitly; reduced motion removes visual movement, never text feedback."},{"id":"profile-image-hover","label":"Account profile image filter","description":"Retire grayscale-to-color hover filter; stable chosen silhouette or provider photo is always shown consistently.","timing":"No hover animation or filter.","reducedMotion":"Identical still identity and visible pen name."},{"id":"unmounted-motion-definitions","label":"Defined but unmounted motion","description":"Explicitly retire unmounted breathing, typewriter and final-line wipe effects; specimen shows a static full poem and a still companion.","timing":"No animation definitions retained for these unused effects.","reducedMotion":"Same complete readable poem, no delayed opacity or clipping."}],"sensory":[{"id":"brand-identity","label":"Existing visual identity is replaceable","description":"Lavender field, one unshaped white plane, plum action and original mint/peach/lavender chorus; quiet writing is recognizably the same identity.","risk":"Soft silhouettes may read young; require adult audience evaluation rather than claiming universal warmth."},{"id":"wordmark-and-logo","label":"Wordmark and generated circular mark","description":"Original joined twin-jelly mark paired with DynaPuff Linejam; two peaks join as one outline without a copied mascot.","risk":"Joined mark must stay distinct at 16px; the faces are subordinate details, not required recognition."},{"id":"device-brand-assets","label":"Browser and installation icon assets","description":"Compact joined mark on solid lavender or plum tile; no wordmark crammed into favicon size, no adaptive inversion.","risk":"These are original icon design specimens, not installed production manifests or verified OS assets."},{"id":"paper-grain-and-depth","label":"Grain, paper, blur and shadows","description":"No grain, blur, gradients or photoreal material; a shallow flat shadow grounds the shared plane while text stays clean.","risk":"Soft edges could blur state hierarchy, so interactive borders and text states stay sharp."},{"id":"typographic-voice","label":"Type roles and local text styling","description":"DynaPuff 500/600 for arrival headings and mark; Nunito Sans for all controls, names, poems, provider and export text.","risk":"Display face can become childish or hard to scan; never use it for long instruction or poem body."},{"id":"player-identity","label":"Player and author identity markers","description":"Three original non-gendered silhouettes with optional eyebrows and one simple accessory; names always primary.","risk":"Shape/color is weak identity and may carry unintended associations; no gender or achievement labels."},{"id":"word-pattern-shape","label":"Nine-line poem shape","description":"Nine visible strokes encode the exact 1,2,3,4,5,4,3,2,1 words; full poem sample has the same truthful shape.","risk":"Do not turn the pattern into scoring, progress rewards or a writing prompt."},{"id":"icon-vocabulary","label":"Shared icon vocabulary","description":"Original simple rounded line SVGs for help, appearance, heart, lock, copy, download, sound and exit, always paired with labels where space permits.","risk":"A face or crown cannot mean both authority and success; Host is literal text, favorites have no crowns."},{"id":"ceremony-audio","label":"Synthesized ceremony tones","description":"Original brief soft marimba-like two-partial tone, low gain, after deliberate local acknowledgement only; no constant music or per-keystroke sound.","risk":"Audio comfort cannot be judged from screenshots; nearby people and hearing sensitivity justify silence-first design."},{"id":"ceremony-haptics","label":"Ceremony vibration patterns","description":"Retire vibration patterns completely; the acknowledgement remains visible text and optional audio, never a device buzz.","risk":"Browser support and unpleasant device intensity make unrequested haptics unreliable and intrusive."},{"id":"share-artifacts","label":"Public preview and private full-image artifacts","description":"Light public teaser and neutral private fallback are distinct from full mode-aware attributed private image; mark stays in margin.","risk":"Public previews must not contain hidden private fixture text, and browser download start is not proof of disk save."},{"id":"native-platform-surfaces","label":"Native share, download and print affordances","description":"App controls say what the browser owns; no fabricated OS share/print sheet is drawn inside the prototype.","risk":"OS UI varies by browser and platform; only Main can claim observed native behavior, not screenshot specimens."},{"id":"public-auth-showcase","label":"Auth poem example and optional provider imagery","description":"Only a labeled synthetic complete poem and optional original companion accompany account appearance; no private source material or copied provider photo.","risk":"Specimen does not establish which external provider flows are configured or authenticate anyone."}]};

const params = new URLSearchParams(location.search);
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const query = {
  surface: CATALOG[params.get('surface')] ? params.get('surface') : 'view',
  id: params.get('id') || 'home',
  state: params.get('state') || 'default',
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
  reduced: params.get('reduced') === '1',
  embed: params.get('embed') === '1'
};
const SHAPE = [1,2,3,4,5,4,3,2,1];
const SAMPLE = ['Somewhere','marmalade moonlight','follows our umbrellas','through the sleeping station','where all the clocks sing','softly into empty cups','until morning forgets','our names','again'];
const NAMES = ['Ari','Jo','Nima'];
const AVATARS = ['arch','twins','square'];
const AVATAR_NAMES = { arch: 'Arch', twins: 'Double', square: 'Square', none: 'No avatar' };
const local = { name: 'Ari', avatar: 'arch', accessory: 'none', round: 0, lines: [], draft: null, active: false, accepted: false, favorite: false, public: false, setPublic: false, sound: false, volume: .3, reader: 'Ari', modePreference: query.mode, sending: false, authorOpen: false };
let audioContext;
let lastCue = 0;
let toastTimer;
let countTimer;
let returnFocus;
const app = document.querySelector('#application');
const dialog = document.querySelector('#drawer');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words = value => value.trim().split(/\s+/u).filter(Boolean);
const normalized = value => value.replace(/\s+/gu, ' ').trim();
const is = (...states) => states.includes(query.state);
const button = (label, action, extra = '', kind = '') => `<button class="button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const go = (id, label, kind = 'secondary', state = 'default') => button(label, 'navigate', `data-view="${id}" data-state="${state}"`, kind);
const icon = name => {
  const paths = {
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 2-2.4 2.1-2.4 3.7M12 17h.01"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.8-3 2 2 0 0 1 1.8-3H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7.5 10h.01M10 6.8h.01M14.5 7h.01M17 10.5h.01"/>',
    heart: '<path d="M20 5.8c-2.5-2.7-6.5-1.4-8 1-1.5-2.4-5.5-3.7-8-1C.5 9.7 5.5 15.1 12 20c6.5-4.9 11.5-10.3 8-14.2Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
    copy: '<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 7V3H4v14h4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    sound: '<path d="m11 4-5 4H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 4-5 4H3v8h3l5 4ZM16 9l5 6m0-6-5 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    menu: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    share: '<path d="M12 16V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/>',
    print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6Z"/>'
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
};
function mark(className = 'brand-symbol') {
  return `<svg class="${className}" viewBox="0 0 64 54" fill="none" aria-hidden="true"><path d="M4 39C2 27 7 10 18 8c8-2 12 5 14 10 3-8 9-12 17-8 11 5 14 25 10 32-4 8-17 4-25 3-9-1-27 6-30-6Z" fill="currentColor"/><path d="M13 31c4-5 7-4 10 0m18 0c3-5 7-4 10 0" stroke="var(--base)" stroke-width="3" stroke-linecap="round"/></svg>`;
}
function character(shape = 'arch', accessory = 'none') {
  if (shape === 'none') return '<circle cx="60" cy="65" r="35" fill="var(--soft)" stroke="var(--line)" stroke-width="2"/><path d="M43 65h34" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
  const silhouettes = {
    arch: '<path d="M15 102C8 89 17 75 18 59c1-26 12-44 32-46 27-4 43 14 46 39 3 24 23 33 14 49-5 10-22 9-35 5-18-5-50 12-60-4Z" fill="#C5ADF1"/>',
    twins: '<path d="M11 102c-6-17 6-36 6-49-1-27 13-43 27-34 7 4 9 13 14 17 4-19 15-30 30-23 17 8 17 34 19 54 2 16 13 32 5 40-10 9-21 0-36-1-23-1-56 14-65-4Z" fill="#B6F1D0"/>',
    square: '<path d="M17 28C30 15 72 15 91 24c17 8 16 28 14 43-1 15 12 29 4 40-8 11-25 1-46 2-16 0-37 8-46-2C6 95 13 77 12 62c-2-14-4-24 5-34Z" fill="#FFB887"/>'
  };
  const brows = shape === 'twins' ? '<path d="m37 53 12 3m22-3 11-3"/>' : shape === 'square' ? '<path d="M34 48q8-5 15-1m21 0q7-4 14 1"/>' : '<path d="M33 49q7-7 15-3m23 1q7-5 13 2"/>';
  const extra = accessory === 'glasses' ? '<g fill="none" stroke="#39234E" stroke-width="2.5"><rect x="27" y="54" width="28" height="20" rx="8"/><rect x="64" y="54" width="28" height="20" rx="8"/><path d="M55 61h9"/></g>' : accessory === 'cap' ? '<path d="M29 29c4-14 28-21 43-8l8 9Z" fill="#39234E"/><path d="M55 29h37" stroke="#39234E" stroke-width="5" stroke-linecap="round"/>' : '';
  return `${silhouettes[shape] || silhouettes.arch}<g fill="none" stroke="#39234E" stroke-width="3.2" stroke-linecap="round">${brows}<path d="M49 84q11 8 22-1"/></g><ellipse cx="42" cy="65" rx="3.5" ry="5" fill="#39234E"/><ellipse cx="77" cy="65" rx="3.5" ry="5" fill="#39234E"/>${extra}`;
}
function avatar(shape = local.avatar, accessory = local.accessory, className = '') {
  return `<div class="avatar ${className}" aria-hidden="true"><svg viewBox="0 0 120 120">${character(shape, accessory)}</svg></div>`;
}
function heroArt() {
  return `<figure class="hero-art"><svg viewBox="0 0 580 450" role="img" aria-label="Three original jelly companions gather around a shared writing sheet"><path d="M48 346c29-27 467-34 489-2 23 32-4 63-51 69-67 9-342 16-408-2-42-11-56-40-30-65Z" fill="#C7B8DB" opacity=".6"/><path d="M65 334c50-27 415-29 456 0l-20 46c-72 28-319 31-417 0Z" fill="#FFFFFF"/><g transform="translate(203 35) scale(1.95)">${character('twins','none')}</g><g transform="translate(27 161) scale(1.65) rotate(-8 60 75)">${character('arch','cap')}</g><g transform="translate(363 162) scale(1.62) rotate(7 60 75)">${character('square','glasses')}</g><path d="M151 325c36-17 63-30 103-14m123-1c28-2 44 4 66 20" stroke="#39234E" stroke-width="7" stroke-linecap="round" fill="none"/><path d="m175 297 216 10-18 69-211-14Z" fill="#FFFFFF" stroke="#A68DBF" stroke-width="2"/><path d="m200 325 112 6m-115 12 151 7" stroke="#826A96" stroke-width="5" stroke-linecap="round"/><path d="m381 293 8-44" stroke="#39234E" stroke-width="7" stroke-linecap="round"/><path d="m380 294-1 10 7-8Z" fill="#39234E"/></svg><figcaption>Different people. One unexpected poem.</figcaption></figure>`;
}
function header(focused = false) {
  return `<header class="app-header"><a href="?surface=view&id=home&mode=${query.mode}" class="wordmark" data-action="navigate" data-view="home" aria-label="Linejam home">${mark()}<span>linejam</span></a><nav class="header-actions" aria-label="Game navigation">${focused ? '' : `<button class="button quiet account-nav" data-action="navigate" data-view="archive">Your poems</button>`}<button class="icon-button" data-action="help" aria-label="How to play">${icon('help')}</button><button class="icon-button" data-action="appearance" aria-label="Appearance and comfort">${icon('palette')}</button><button class="icon-button" data-action="menu" aria-label="More options">${icon('menu')}</button></nav></header>`;
}
function footer() {
  return `<footer class="app-footer"><span class="sketch-label">Synthetic design sketch. No live room or account.</span><nav aria-label="Footer"><a href="../">Compare directions</a><a href="?surface=view&id=releases" data-action="navigate" data-view="releases">What changed</a><button class="link-button small" data-action="help">How to play</button></nav></footer>`;
}
function alertBox(title, text, tone = '', actions = '') {
  return `<div class="alert ${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${icon(tone === 'success' ? 'check' : 'info')}<div><strong>${title}</strong><p>${text}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
}
function silhouette(compact = false) {
  return `<div class="poem-silhouette ${compact ? 'compact' : ''}" role="img" aria-label="Nine lines: 1, 2, 3, 4, 5, 4, 3, 2, 1 words">${SHAPE.map(n => `<span style="width:${n * 27}px"></span>`).join('')}</div>`;
}
function roundTrack(round = local.round) {
  return `<div class="round-track" role="img" aria-label="Round ${round + 1} of nine; word counts 1,2,3,4,5,4,3,2,1">${SHAPE.map((n,i) => `<span class="${i === round ? 'current' : i < round ? 'complete' : ''}" style="height:${n * 4 + 4}px"></span>`).join('')}</div>`;
}
function chorus(full = false, statuses = false) {
  const names = is('empty') ? [local.name] : full || is('full','long-text') ? [local.name,'Jo','Nima','River with an exceptionally long pen name','Sasha','Kit','Morgan','Tala'] : [local.name,'Jo','Nima'];
  return `<div class="chorus" aria-label="Illustrative people, not live players">${names.map((name,i) => `<div class="person" ${i === 0 ? 'data-companion' : ''}>${avatar(i === 0 ? local.avatar : AVATARS[i % 3], i === 1 ? 'glasses' : i === 2 ? 'cap' : local.accessory)}<span class="name">${esc(name)}</span><span class="status">${i === 0 && !is('participant') ? '<span class="host-badge">Host</span>' : statuses && i === 1 ? 'Away' : statuses && i === 2 ? 'Watching' : 'Here'}</span></div>`).join('')}</div>`;
}
function home() {
  return `<section class="hero"><div class="hero-copy"><h1>A little strange.<br>Better together.</h1><p>Write one line. Pass it on.<br>Read what happened.</p><div class="actions">${go('join-entry','Join a room','')}${go('host-entry','Start a room')}</div><div class="hero-note">2–8 people. Nine rounds. No account needed.</div></div>${heroArt()}</section><section class="how-strip" aria-label="How the game works"><div class="how-step"><span class="step-number">1</span><div><h3>Bring your people</h3><p>Gather in a room, near or far.</p></div></div><div class="how-step"><span class="step-number">2</span><div><h3>Add just one line</h3><p>You only see the line before yours.</p></div></div><div class="how-step"><span class="step-number">3</span><div><h3>Read it all together</h3><p>Nine lines. A very unlikely ending.</p></div></div></section>`;
}
function entry(kind = 'join') {
  const join = kind === 'join';
  if (is('loading')) return loading(join ? 'Preparing your guest entry' : 'Preparing a room');
  return `<section class="entry-layout"><div class="entry-aside"><h1>${join ? 'Join your people.' : 'Make room for a few words.'}</h1><p>${join ? 'An invitation, a pen name, and you are in.' : 'Invite a few people. You do not need to know what you will write.'}</p>${avatar(join ? 'square' : 'twins','none')}</div><form class="paper entry-paper" id="entry-form" data-kind="${kind}"><p class="contract-note">Local design sketch. DEMO is not a real room code.</p>${is('error') ? alertBox(join ? 'Could not join this room' : 'Could not create the room', 'Your pen name is still here. Try the local sketch again.', 'error') : ''}${is('recovery') ? alertBox('Ready to try again','Your pen name has been kept. No account is needed.') : ''}${join ? `<div class="field"><label for="room-code">Room code</label><input id="room-code" name="code" value="${is('empty') ? '' : 'DEMO'}" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" ${is('invite') ? 'readonly' : ''} required aria-describedby="code-help"><small id="code-help">${is('invite') ? 'Filled from your illustrative invitation.' : 'Use DEMO to explore. Four letters, no live room.'}</small></div>` : ''}<div class="field"><label for="pen-name">Your pen name</label><input id="pen-name" name="name" placeholder="What should we call you?" value="${is('empty') ? '' : esc(local.name)}" maxlength="80" autocomplete="nickname" required aria-describedby="name-help"><small id="name-help">A first name, nickname, anything you answer to.</small></div><div class="avatar-option">${avatar()}<div><button class="link-button" type="button" data-action="avatar">Change your companion</button><p>Optional. A pen name is all you need.</p></div></div><div id="entry-error" class="field-error" role="alert"></div><button class="button" type="submit" ${is('pending') ? 'disabled aria-busy="true"' : ''}>${is('pending') ? (join ? 'Joining sketch…' : 'Creating sketch…') : join ? 'Join this sketch' : 'Start this sketch'}</button><p class="small muted">No network requests. The people in the next screen are illustrative fixtures.</p></form></section>`;
}
function destination() {
  return `<div class="room-code"><div><span class="muted">Your room · design sketch</span><strong>DEMO</strong><span class="small muted">Not a real room code</span></div>${button(`${icon('copy')} Copy demo code`,'copy-code','','secondary')}</div>`;
}
function lobby(presentation = false) {
  if (is('loading')) return loading('Preparing the room');
  return `<section class="${presentation ? 'stage-surface' : 'room-layout'}"><div class="room-heading"><div><h1>${presentation ? 'There is room for you.' : 'The words can wait.'}</h1><p>${presentation ? 'Join on your phone. This display keeps everyone in view.' : 'Get everyone here first. Then see what happens.'}</p></div>${presentation ? button('Exit presentation','navigate','data-view="room-lobby"','secondary') : avatar('twins')}</div><div class="paper">${destination()}${chorus(presentation, is('away'))}<div class="lobby-bottom"><p>${is('empty') ? 'One person is here. At least two people are needed for a game.' : is('participant') ? 'The host starts when everyone is here. There is no need to hurry.' : 'Everyone starts with one word. Nine rounds, one surprise at the end.'}</p>${presentation ? go('join-entry', 'Open demo invitation', '', 'invite') : is('participant') ? go('home','Leave room') : button('Start game','start',is('empty') ? 'disabled' : '')}</div>${is('error') ? `<div style="margin-top:20px">${alertBox('The game did not start','Everyone is still in the lobby. Try again when you are ready.','error')}</div>` : ''}${!presentation ? `<details style="margin-top:25px"><summary>Room tools</summary><div class="stack-tight" style="padding-top:16px"><p class="small muted">Demo join destination only. No fabricated scannable QR code.</p><div class="actions">${go('join-entry', 'Open demo invitation', 'secondary', 'invite')}${go('lobby-presentation','Present room')}${button('Close room','close-room','','quiet')}</div></div></details>` : ''}</div></section>`;
}
function effectiveRound() { return local.active ? local.round : is('first') ? 0 : is('last') ? 8 : 3; }
function draftForState() {
  if (local.draft !== null) return local.draft;
  if (is('exact','accepted','pending','recovery','error')) return SAMPLE[effectiveRound()];
  if (is('overflow')) return 'a very long line with too many words for this round today';
  if (is('long-text')) return 'Extraordinarilyuninterruptedwordsthatrunbeyondthenormalwidth';
  if (is('offline','restored')) return 'through the sleeping';
  return '';
}
function wordFeedback(value, target, readyLabel = 'Ready to send') {
  const count = words(value).length;
  const delta = target - count;
  return `<span>${count} / ${target} words · ${delta === 0 ? readyLabel : delta > 0 ? `Add ${delta} ${delta === 1 ? 'word' : 'words'}` : `Remove ${-delta} ${delta === -1 ? 'word' : 'words'}`}</span><span class="word-slots" aria-hidden="true">${Array.from({length:Math.max(target,Math.min(count,10))},(_,i)=>`<span class="${i < count ? i >= target ? 'over' : 'filled' : ''}"></span>`).join('')}${count > 10 ? `<span class="small">+${count - 10}</span>` : ''}</span>`;
}
function connectionStrip(state = query.state) {
  const restored = state === 'recovery' || state === 'restored';
  return `<div class="connection-strip" role="status"><span class="status-copy"><span class="status-dot ${restored ? '' : 'offline'}" aria-hidden="true"></span><span>${restored ? 'Connection restored. Your draft is still here.' : state === 'pending' ? 'Reconnecting. Your draft is still here.' : 'Offline. You can keep writing; sending will wait.'}</span></span>${restored ? '' : button('Restore sketch connection','recover','','quiet')}</div>`;
}
function writing({connectionNotice = false} = {}) {
  if (is('loading')) return loading('Finding your next line');
  if (is('accepted')) return waiting(false, true);
  const round = effectiveRound();
  const target = SHAPE[round];
  const draft = draftForState();
  const previous = local.active ? local.lines[round - 1] : SAMPLE[round - 1];
  const exact = words(draft).length === target;
  const sending = is('pending') && !connectionNotice;
  const disconnected = is('offline') || (connectionNotice && !is('restored','recovery'));
  const readyLabel = sending ? 'Sending line' : disconnected ? 'Ready when connected' : 'Ready to send';
  return `<section class="writing-layout"><div class="round-header"><h1>Round ${round + 1} of 9</h1>${roundTrack(round)}</div>${is('offline') && !connectionNotice ? `<div style="margin-bottom:18px">${connectionStrip()}</div>` : ''}<div class="paper writing-paper">${avatar(local.avatar,local.accessory,'margin-companion')}<div class="writing-context"><span>${round === 0 ? 'The first line starts with you' : 'Only the previous line'}</span><p class="previous-line">${round === 0 ? 'One word. Your choice.' : esc(previous || SAMPLE[round - 1])}</p></div><h2 class="writing-prompt">Write exactly ${target} ${target === 1 ? 'word' : 'words'}.</h2>${is('restored','recovery') ? `<p class="small muted" style="margin-bottom:12px">Your unsent draft has been restored in this sketch.</p>` : ''}<form id="writing-form"><div class="field writing-field"><label class="sr-only" for="line-draft">Your ${target}-word line</label><textarea id="line-draft" name="line" maxlength="500" rows="3" placeholder="Your line goes here" aria-describedby="word-feedback writing-privacy" ${sending ? 'readonly aria-busy="true"' : ''}>${esc(draft)}</textarea></div><div id="word-feedback" class="word-status" data-valid="${exact}" data-over="${words(draft).length > target}">${wordFeedback(draft,target,readyLabel)}</div><div id="writing-error" role="alert" class="field-error">${is('error') ? 'This line was not accepted. Your draft is still here; try sending again.' : ''}</div><div class="writing-submit"><p id="writing-privacy">Only this line passes to the next person.</p><button class="button" id="send-line" type="submit" data-blocked="${disconnected || sending}" ${!exact || disconnected || sending ? 'disabled' : ''}>${sending ? 'Sending line…' : is('error') ? 'Try sending again' : 'Send line'}</button></div></form></div><p class="quiet-note">No deadline. Take the time you need. <span class="sketch-label">${local.active ? 'You are writing a local nine-round sketch.' : 'Synthetic assignment, not live gameplay.'}</span></p>${local.active ? '' : `<div class="actions" style="margin-top:15px">${button('Try all nine rounds','start','','quiet')}</div>`}</section>`;
}
function waiting(spectator = false, accepted = false) {
  if (is('loading')) return loading('Checking the room');
  const final = local.active && local.round === 8;
  const line = local.active ? local.lines[local.round] : SAMPLE[effectiveRound()];
  if (is('error')) return `<section class="writing-layout stack"><h1 class="writing-prompt">Room updates paused.</h1><div class="paper stack">${alertBox('Your accepted line is still here','This offline error specimen cannot show the next room update. Your line does not need to be sent again.','error')}<div class="accepted-line">${esc(line || local.draft || SAMPLE[3])}</div>${button('Restore sketch updates','recover')}<p class="small muted">A local recovery control, not a live connection or a deadline.</p></div></section>`;
  return `<section class="writing-layout"><div class="round-header"><h1>${spectator ? 'Watching this game' : `Round ${(local.active ? local.round : 3) + 1} of 9`}</h1>${roundTrack(local.active ? local.round : 3)}</div><div class="paper accepted-view">${avatar(spectator ? 'square' : local.avatar,local.accessory,accepted || local.accepted ? 'squash' : '')}<h1>${spectator ? 'You are here for the reveal.' : final ? 'Nine lines, together.' : 'Line accepted.'}</h1><p class="muted">${spectator ? 'This game was already underway. Watch the poems unfold, then join the writing next game.' : final ? 'Your final line is safely in this local sketch. The complete poem is ready to read.' : 'Your part is in. The next round begins when everyone has sent a line.'}</p>${spectator ? '' : `<div class="accepted-line">${esc(line || local.draft || SAMPLE[3])}</div>`}<div class="neutral-wait"><span class="wait-mark" aria-hidden="true"></span><span>${is('ready') || final ? 'Ready for the next part' : spectator ? 'Watching, not counted as a waiting writer' : 'Waiting together, not keeping score'}</span></div>${chorus(false,true)}<div class="actions">${spectator ? go('reveal-circle','Preview completed reveal','') : button(final ? 'Open full reveal' : 'Next round in sketch','next-round')}</div><p class="small muted" style="margin-top:14px">Sketch controls advance the local fixture. No server or other writer is connected.</p></div>${!spectator ? `<details style="margin-top:24px"><summary>Host: end this game</summary><div class="stack-tight" style="padding-top:15px"><p>End the game and return everyone to the lobby? Unfinished poems stay hidden.</p><div class="actions">${button('Keep writing','cancel-end','','secondary')}${button('End game and return to lobby','end-game','','quiet')}</div></div></details>` : ''}</section>`;
}
function readingCircle() {
  if (is('loading','pending')) return loading(is('pending') ? 'Opening the assigned poem' : 'Getting the reading order');
  if (is('empty')) return emptyState('The reading circle is not ready yet.','No complete poem is available in this state. Partial poems stay hidden.','room-waiting','Back to the room');
  return `<section class="room-layout"><div class="room-heading"><div><h1>Time to hear<br>what happened.</h1><p>One person reads. Everyone gets the whole poem.</p></div>${avatar('twins')}</div><div class="paper stack"><div class="reader-row">${avatar(local.avatar)}<div><strong>${is('spectator') ? 'Ari reads first' : is('fallback') ? 'You can step in for Jo' : `${esc(local.name)} reads first`}</strong><p>${is('spectator') ? 'You can follow along when the poem opens.' : 'Your assigned poem is ready. No performance required.'}</p></div></div>${silhouette()}${is('error') ? alertBox('The poem did not open','The assignment has not changed. Try opening it again.','error') : ''}<div class="actions">${go('poem-reading',is('fallback') ? 'Step in and read' : is('reread') ? 'Read the poem again' : 'Reveal and read','')}${go('reveal-presentation','Present reveal')}</div><div class="stack-tight"><h3>Reading order</h3>${[local.name,'Jo','Nima'].map((name,i)=>`<div class="connection-strip"><span>${esc(name)}</span><span class="muted">${i === 0 ? 'Reading now' : i === 1 ? 'Up next' : 'After Jo'}</span></div>`).join('')}</div><p class="small muted">Synthetic reading-order sketch. The interactive path contains one locally written poem; no other human submissions are fabricated.</p></div><div class="actions" style="margin-top:25px">${go('session-recap','Preview private recap','quiet')}</div></section>`;
}
function poemLines(teaser = false) {
  const lines = local.active && local.lines.length === 9 ? local.lines : SAMPLE;
  return `<ol class="poem-lines">${lines.slice(0,teaser ? 3 : 9).map(line=>`<li>${esc(line)}</li>`).join('')}</ol>`;
}
function authorDetails() {
  const custom = local.active && local.lines.length === 9;
  return `<details class="poem-authors" ${local.authorOpen ? 'open' : ''}><summary>Show every line's author</summary><ol style="margin:12px 0 0;padding-left:24px">${SHAPE.map((_,i)=>`<li>${custom ? `${esc(local.name)} (local single-writer sketch)` : `${NAMES[i % 3]} (synthetic attribution)`}</li>`).join('')}</ol></details>`;
}
function poemSheet(teaser = false, privateFallback = false) {
  if (privateFallback) return `<article class="paper poem-paper"><div class="wordmark">${mark()}<span>linejam</span></div><h2 class="poem-title">A poem made together.</h2>${silhouette()}<p class="muted">This poem is private or unavailable. No preview text is shown.</p></article>`;
  return `<article class="paper poem-paper" aria-label="${teaser ? 'Synthetic public poem teaser' : 'Complete nine-line poem'}"><span class="poem-number">${teaser ? 'Public teaser · synthetic sample' : local.active && local.lines.length === 9 ? 'Your local sketch · nine lines' : 'Poem 1 · synthetic nine-line sample'}</span><h2 class="poem-title">${local.active && local.lines.length === 9 ? esc(local.lines[0]) : 'Somewhere'}</h2>${poemLines(teaser)}${teaser ? '<p class="poem-authors">Three illustrative contributors. Full poem only on its authorized page.</p>' : authorDetails()}${avatar('square','none','poem-corner')}</article>`;
}
function heart(label = true) {
  return `<button class="heart" data-action="favorite" aria-label="${local.favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${local.favorite}" ${is('pending') ? 'disabled' : ''}>${icon('heart')}${label ? '<span>Favorite</span>' : ''}</button>`;
}
function reading({presentation = false, detail = false, publicView = false} = {}) {
  if (is('loading','pending')) return loading(publicView && is('pending') ? 'Preparing this shared poem' : 'Opening the complete poem');
  if (publicView && is('private','revoked','empty','error')) return emptyState('This poem is private or unavailable.','There is no poem text to show at this link. Ask the person who sent it, or start a game of your own.','home','Return home');
  if (presentation && is('empty')) return emptyState('No poems are ready to read.','The complete poems will appear here when the reading circle is ready.','reveal-circle','Exit presentation');
  return `<section class="${presentation ? 'stage-surface' : 'reveal-layout'}">${detail || publicView ? `<div class="actions" style="margin-bottom:23px">${go(publicView ? 'home' : 'archive',publicView ? 'Back to Linejam' : 'Back to your poems','quiet')}<span class="privacy-line">${icon('lock')}${publicView || local.public ? 'Explicitly public sketch' : 'Private poem sketch'}</span></div>` : `<div class="reader-row">${avatar(local.avatar)}<div><strong>${esc(local.reader)} is reading</strong><p>The whole poem. Your own pace.</p></div>${button('Pass the reading','pass-reader','','quiet')}</div>`}${poemSheet()}<div class="reveal-actions">${publicView ? '<span class="small muted">Synthetic public view; no participant controls.</span>' : heart()}<div class="actions">${detail || publicView ? `${go('poem-sharing','Share poem','secondary')}${button(`${icon('download')} Save privately`,'download','','secondary')}${button(icon('print'),'print','aria-label="Print poem"','quiet')}` : go(presentation ? 'reveal-circle' : 'session-recap',presentation ? 'Finish poem' : 'Done reading','')}</div></div>${presentation ? `<div class="actions" style="margin-top:25px">${go('reveal-circle','Exit presentation','quiet')}</div>` : ''}${is('error') ? `<div style="margin-top:18px">${alertBox('That action did not finish','The complete poem is still here. Try again without changing its privacy.','error')}</div>` : ''}<p class="quiet-note">${local.active && local.lines.length === 9 ? 'Every line above was entered in this local single-writer sketch.' : 'Synthetic poem and illustrative author names. This is not evidence of a live game.'}</p></section>`;
}
function publishPanel(set = false) {
  const published = set ? local.setPublic : local.public;
  return `<section class="publish-panel"><h2>${set ? 'Share this whole set?' : 'Want to share a link?'}</h2><p>${set ? 'A public link includes every poem in this set and all author names.' : 'A public link includes this poem and all author names.'} Saving a private copy is a different action.</p><div class="privacy-line">${icon('lock')}<strong>${published ? 'Public in this local consent sketch' : 'Private in this local consent sketch'}</strong></div><div class="actions" style="margin-top:16px">${published ? button('Make private again','revoke',`data-set="${set}"`,'secondary') : button(set ? 'Review whole-set sharing' : 'Review poem sharing','publish',`data-set="${set}"`,'secondary')}</div></section>`;
}
function recap(setSharing = false) {
  if (is('loading')) return loading('Gathering your completed poems');
  if (is('empty')) return emptyState('The set is not complete yet.','Unfinished poems stay hidden. Return to the room to see its current state.','room-waiting','Back to room');
  return `<section class="recap-layout"><div class="recap-heading"><div><h1>That came from<br>all of you.</h1><div class="privacy-line">${icon('lock')}Private until you choose otherwise.</div></div>${avatar('twins')}</div><div class="recap-grid">${poemSheet()}<aside class="recap-aside"><section><h2>Keep the words.</h2><p class="muted">A private copy is yours to keep. It does not make a public link.</p><div class="actions" style="margin-top:17px">${button(`${icon('download')} Download synthetic artwork`,'download')}${go('poem-reading','Read the poem again')}${go('archive','Your poems','quiet')}</div></section><section><h2>Stay a little longer?</h2><div class="actions">${button('Start next game','start')}${go('room-lobby','Back to lobby')}${go('home','Exit room','quiet')}</div></section>${publishPanel(setSharing)}${is('error') ? alertBox('The next action did not finish','Your completed poem is still available here. Try again.','error') : ''}</aside></div><p class="quiet-note">${local.active && local.lines.length === 9 ? 'This local sketch contains your nine entered lines.' : 'One full synthetic poem shown; no hidden real session or generated authors.'} No scores, rankings or room-favorite crown.</p></section>`;
}
function loading(message = 'Loading your poems') {
  return `<section class="empty-composition paper loading-state" aria-busy="true" role="status">${avatar('twins')}<div class="loading-shape" aria-hidden="true"></div><h1 style="font-size:2rem">${message}</h1><p>No progress is being invented. This is the selected loading-state sketch.</p>${button('Show recovered sketch','recover','','secondary')}</section>`;
}
function emptyState(title, text, destinationId = 'host-entry', action = 'Start a room') {
  return `<section class="empty-composition">${avatar('square')}<h1>${title}</h1><p class="muted">${text}</p><div class="actions">${go(destinationId,action,'')}${destinationId !== 'home' ? go('home','Return home','quiet') : ''}</div></section>`;
}
function recovery(id) {
  if (is('loading')) return loading(id === 'guest-session-recovery' ? 'Preparing your guest session' : 'Loading the room');
  if (is('recovery')) return id === 'guest-session-recovery' ? entry('join') : writing();
  if (id === 'room-unavailable') return emptyState('This room is not available.','The invitation may have changed, the room may be closed, or you may need to rejoin. No private room details are shown.','join-entry','Check the room code');
  if (id === 'not-found') return emptyState('Nothing at this address.','Let us get you back to the table.','home','Return home');
  if (id === 'global-error') return `<section class="paper profile-layout" style="font-family:system-ui,sans-serif"><h1 style="font:700 2rem/1.2 system-ui,sans-serif">Linejam could not start.</h1><p style="margin-block:20px">This recovery screen does not need the normal game view. Your device has not been asked to publish or send anything.</p><div class="actions">${button('Reload the sketch','recover')}${go('home','Return home','secondary')}</div></section>`;
  const guest = id === 'guest-session-recovery';
  return `<section class="profile-layout"><div class="page-intro compact"><h1>${guest ? 'Your guest session needs another try.' : id === 'route-error' ? 'This page could not load.' : 'The room view could not load.'}</h1><p>${guest ? 'An account is not the solution to a connection problem.' : 'The view has stopped, not your ability to recover.'}</p></div><div class="paper stack">${alertBox(guest ? 'Guest connection unavailable' : 'This part did not load',guest ? 'Your pen name is still in this sketch. Try the guest connection again.' : 'Your unsent local draft stays here. It has not been accepted or published.','error')}<div class="actions">${button(guest ? 'Try guest connection again' : 'Try this view again','recover')}${go('home','Return home','secondary')}</div></div></section>`;
}
function archiveStats(skeleton = false, single = false) {
  return `<div class="stats" ${skeleton ? 'aria-busy="true" aria-label="Loading archive totals"' : 'aria-label="Personal collection facts"'}>${[['1','poem'],[local.favorite ? '1' : '0','favorites'],['3','illustrative contributors'],['9','lines in this sample']].slice(0,single ? 1 : 4).map(([n,label])=>`<div>${skeleton ? '<span class="loading-shape" aria-hidden="true"></span>' : `<strong>${n}</strong>`}<span>${label}</span></div>`).join('')}</div>`;
}
function authorGroup(inline = false) {
  return `<div class="author-dots">${inline ? '' : AVATARS.map(a=>avatar(a,'none')).join('')}<span>Ari, Jo and Nima · synthetic names</span></div>`;
}
function archiveCard(skeleton = false) {
  if (skeleton) return `<article class="archive-card" aria-busy="true" aria-label="Loading poem">${silhouette()}<span class="loading-shape" aria-hidden="true"></span><p class="muted">Loading a poem…</p></article>`;
  return `<article class="archive-card"><div class="sample-row spaced"><span class="small muted">Private · synthetic sample</span>${heart(false)}</div><a href="?surface=view&id=poem-detail" data-action="navigate" data-view="poem-detail"><h2>${esc(local.active && local.lines.length === 9 ? local.lines[0] : 'Somewhere')}</h2></a>${silhouette()}<p class="muted">Nine human lines become one unexpected thing. This card uses a synthetic fixture.</p><footer>${authorGroup()}${go('poem-detail','Read','quiet')}</footer></article>`;
}
function archive() {
  if (is('empty')) return emptyState('Nothing here yet.','Your completed poems will live here. Start with a few people and one word.','host-entry','Start a room');
  if (is('error')) return recovery('guest-session-recovery');
  return `<section class="archive-layout"><div class="page-intro"><h1>Your poems.</h1><p>${is('account') ? 'A connected-account appearance sketch. No online account is active here.' : 'A little collection of things you could not have written alone.'}</p></div><div class="archive-bar"><p class="small muted">${is('account') ? 'An online account can preserve real poems across devices in the integrated app.' : 'Guest work belongs to the local game and this browser session, not an online account.'}</p>${go('host-entry','Start a room','secondary')}</div><div class="archive-grid">${archiveCard(is('loading'))}${is('loading') ? archiveCard(true) : `<div class="stack-tight" style="padding:20px 8px"><h2 style="font-size:1.7rem">Worth keeping.</h2><p class="muted">Private saving is not public sharing. You choose whether a link leaves the room.</p>${go('sign-in','Optional account entry','quiet')}</div>`}</div>${archiveStats(is('loading'))}</section>`;
}
function publicRecap() {
  if (is('private','revoked','empty','error')) return emptyState('This set is private or unavailable.','No poem text is included in this fallback.','home','Return home');
  if (is('loading')) return loading('Preparing the shared set');
  return `<section class="reveal-layout"><div class="page-intro"><h1>A set made together.</h1><p>Explicitly public · synthetic collection of one complete poem.</p></div><div class="stack">${poemSheet()}<p class="small muted">Starter: Ari. Reader: Jo. Every attribution is illustrative, not a real contribution claim.</p><div class="actions">${button(`${icon('print')} Print or save as PDF`,'print')}${go('join-entry','Join a room')}${go('host-entry','Start a room','quiet')}</div></div></section>`;
}
function accountsUnavailable() {
  return `<div class="stack">${avatar('twins')}<h2>Accounts are not connected here.</h2><p class="muted">This design sketch does not connect to an online account. In local play, poems belong to the local game and are tied to this browser's guest session.</p>${go('home','Play as a guest','')}</div>`;
}
function accountEntry(signup = false) {
  return `<section class="entry-layout"><div class="entry-aside"><h1>${signup ? 'Keep coming back.' : 'Keep the words.'}</h1><p>An account is optional. The game comes first.</p>${avatar('arch','glasses')}</div><div class="paper entry-paper">${is('default','local','empty') ? accountsUnavailable() : `<p class="contract-note">Provider appearance specimen only. No credentials, account or verification are sent.</p><h2>${is('verification') ? 'Check your email' : is('recovery') ? 'Get back to your account' : signup ? 'Create an account' : 'Sign in'}</h2>${is('error') ? alertBox('This example could not continue','Your guest work would stay attached to the existing session.','error') : ''}<form id="account-fixture" class="stack-tight"><div class="field"><label for="account-example">${is('verification') ? 'Verification code (specimen)' : 'Email address (specimen)'}</label><input id="account-example" value="${is('verification') ? '000000' : 'poet@example.invalid'}" readonly aria-describedby="provider-disclaimer"></div><p id="provider-disclaimer" class="small muted">Read-only visual fixture. Enabled provider methods need real integration inspection.</p>${button(is('pending') ? 'Checking specimen…' : 'Preview next account state','account-next',is('pending') ? 'disabled' : '')}</form>${go('home','Continue as a guest','quiet')}`}</div></section>`;
}
function callback() {
  if (is('local','empty')) return `<section class="paper profile-layout">${accountsUnavailable()}</section>`;
  if (is('error')) return `<section class="paper profile-layout stack"><h1 style="font-size:2.4rem">Your guest work is still here.</h1>${alertBox('Account connection did not finish','The sketch has not moved or removed any guest work. No online migration is connected.','error')}<div class="actions">${button('Preview retry','recover')}${go('home','Continue as guest','secondary')}</div></section>`;
  return loading('Connecting your existing poems');
}
function profile(accountMenu = false) {
  return `<section class="profile-layout"><div class="page-intro"><h1>${accountMenu ? 'Account options.' : 'You, in a few words.'}</h1></div><div class="paper"><div class="profile-avatar">${avatar()}<div><h2 style="font:800 1.6rem/1.3 'Nunito Sans',sans-serif;overflow-wrap:anywhere">${esc(is('long-text') ? 'A very long pen name without an easy stopping point' : local.name)}</h2><p class="muted">${is('account') ? 'Connected-account visual specimen' : 'Guest in this local sketch'}</p></div></div><div class="stack"><p>${is('account') ? 'poet@example.invalid is a synthetic provider identity. Account management belongs to the configured provider, not an invented local editor.' : 'This pen name identifies your contributions. Your companion is optional and does not authenticate you.'}</p><p class="small muted">${is('account') ? 'No real account is connected in this prototype.' : 'Local game and browser-session access is different from online account preservation.'}</p><div class="actions">${button('Change companion','avatar','','secondary')}${go('archive','Your poems','secondary')}${is('account') ? button('Provider account options','provider-info','','quiet') : go('sign-in','Optional sign in','quiet')}</div>${is('account') ? button('Preview signed-out state','guest-mode','','quiet') : ''}</div></div></section>`;
}
function helpContent() {
  return `<div class="stack"><p>A collaborative poem, one small surprise at a time.</p><ol class="help-sequence"><li><strong>Gather 2–8 people.</strong>Everyone writes a line in each round.</li><li><strong>See only the previous line.</strong>The rest stays hidden while you write.</li><li><strong>Follow the word count.</strong>Nine rounds: 1, 2, 3, 4, 5, 4, 3, 2, 1 words.</li><li><strong>Read the completed poems together.</strong>All nine lines appear at once. No scores, no generated writers.</li></ol><div class="sample-row">${silhouette()}${avatar('twins')}</div><p class="small muted">The word counter helps with the constraint, not the quality of your writing. There is no hard deadline.</p></div>`;
}
function appearanceContent() {
  return `<div class="stack"><fieldset style="margin:0;padding:0;border:0"><legend class="field-label" style="margin-bottom:13px">Color palette</legend><div class="stack-tight">${['light','dark','system'].map(mode=>`<label class="check-control"><input type="radio" name="appearance-mode" value="${mode}" ${local.modePreference === mode ? 'checked' : ''}>${mode === 'system' ? 'Use device setting' : mode[0].toUpperCase() + mode.slice(1)}</label>`).join('')}</div></fieldset><label class="check-control"><input type="checkbox" data-setting="reduced" ${query.reduced || systemMotion.matches ? 'checked' : ''} ${systemMotion.matches ? 'disabled' : ''}>Reduce motion${systemMotion.matches ? ' (your device setting is already on)' : ''}</label><p class="small muted">No blinking, breathing or waiting loops in either setting.</p>${soundControls()}${button('Choose a companion','avatar','','secondary')}</div>`;
}
function releaseEntry() {
  return `<article class="release-entry"><time>6 September 2026 · synthetic release specimen</time><h2>A quieter place for the next line.</h2><p>This design note shows how product updates would read in Jelly Chorus. It is not a claim that these changes have shipped.</p><details><summary>Technical details</summary><div style="padding-top:12px"><h3>Interface</h3><ul><li>Plain writing plane with visible exact-count feedback.</li><li>Original local vector art and bundled typography.</li></ul><h3>Accessibility</h3><ul><li>Explicit silent and reduced-motion alternatives.</li><li>Natural text wrapping and persistent author disclosure.</li></ul></div></details></article>`;
}
function releases(feed = false) {
  return `<section class="releases"><div class="page-intro"><h1>${feed ? 'Updates, in your reader.' : 'What changed.'}</h1><p>${feed ? 'External RSS reader specimen. The reader controls its own appearance.' : 'Useful notes first. Technical detail when you want it.'}</p></div>${is('empty') ? '<p class="muted">No release notes in this selected empty specimen.</p>' : releaseEntry()}${feed ? `<details style="margin-block:24px"><summary>View synthetic RSS content</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem">${esc(rssText())}</pre></details>${button('Download synthetic RSS','download-rss','','secondary')}` : go('releases-feed','Preview RSS feed','quiet')}</section>`;
}
function socialCard(kind = 'site', fallback = false) {
  if (kind === 'site') return `<div class="social-art"><div><div class="wordmark">${mark()}<span>linejam</span></div><h2>Your words.<br>Their words.<br>Something unexpected.</h2><p>One line at a time. Nine rounds together.</p></div>${heroArt()}</div>`;
  if (fallback) return `<div class="social-art fallback-art"><div><div class="wordmark">${mark()}<span>linejam</span></div><h2>${kind === 'recap' ? 'A set made together.' : 'A poem made together.'}</h2><p>Private or unavailable. No poem text in this preview.</p>${silhouette()}</div>${avatar('twins')}</div>`;
  return `<div class="social-art ${kind === 'recap' ? 'set-art' : ''}"><div><div class="wordmark">${mark()}<span>linejam</span></div><h2>${kind === 'recap' ? 'An evening in nine lines.' : 'A poem made together.'}</h2><span class="small muted">Explicit public preview · synthetic fixture</span></div><div class="stack-tight">${poemLines(true)}<p class="small muted">Ari, Jo and Nima · illustrative authors</p>${kind === 'recap' ? silhouette() : ''}</div></div>`;
}
function shareView(set = false) {
  return `<section class="recap-layout"><div class="page-intro compact"><h1>${set ? 'Share the whole set.' : 'Let the words travel.'}</h1><p>Private saving and public sharing are different choices.</p></div><div class="recap-grid">${poemSheet()}<aside class="recap-aside">${publishPanel(set)}${is('error') ? alertBox('The link did not activate','The poem is still private in this sketch. A delivered but inactive link must not be called shared.','error') : is('pending') ? alertBox('Preparing a link','This pending-state sketch has not made any content public.') : is('canceled','recovery') ? alertBox('Sharing canceled','Nothing was made public. You can keep reading or save a private copy.','success') : ''}<div class="actions">${button('Preview native share of sketch text','native-share','','secondary')}${button('Download a private synthetic copy','download','','quiet')}${go('session-recap','Back to private recap','quiet')}</div><p class="small muted">No real poem URL is created. Native sharing uses generic design-sketch text only, not your local draft.</p></aside></div></section>`;
}
function exportView(print = false) {
  if (is('private','empty','error') && !print) return emptyState('This image is unavailable.','No private poem is exposed by an unavailable export. Return to your own poems.','archive','Your poems');
  return `<section class="reveal-layout"><div class="page-intro compact"><h1>${print ? 'Words, on paper.' : 'Keep a private copy.'}</h1><p>${print ? 'Your browser controls print and Save as PDF. Canceling does not change the poem.' : 'Complete words, complete attribution. No public link required.'}</p></div>${poemSheet()}<div class="actions" style="margin-top:26px">${button(print ? `${icon('print')} Open browser print` : `${icon('download')} Download synthetic SVG`,print ? 'print' : 'download',is('pending') ? 'disabled' : '')}${go('session-recap','Back to recap','quiet')}</div><p class="quiet-note">${print ? 'Print styling removes actions, companions and backgrounds.' : 'This prototype creates local SVG artwork, not a server-rendered PNG. All author labels stay in the file.'}</p></section>`;
}
function renderView(id) {
  switch (id) {
    case 'app-shell': return `<section class="profile-layout"><div class="page-intro"><h1>A little room for words.</h1><p>The joined mark finds home. The rest stays quiet until you need it.</p></div><div class="paper stack"><h2>The shared plane</h2><p>General navigation wraps this one content space. Focused play removes the extra utilities, not help or recovery.</p><div class="actions">${go('host-entry','Try focused entry','')}${button('Open navigation','menu','','secondary')}</div></div></section>`;
    case 'home': return home();
    case 'host-entry': return entry('host');
    case 'join-entry': return entry('join');
    case 'room-lobby': return lobby();
    case 'lobby-presentation': return lobby(true);
    case 'room-writing': return writing();
    case 'room-waiting': return waiting();
    case 'late-join-spectator': return waiting(true);
    case 'reveal-circle': return readingCircle();
    case 'poem-reading': return reading();
    case 'reveal-presentation': return reading({presentation:true});
    case 'session-recap': return recap();
    case 'room-unavailable': case 'room-recovery': case 'guest-session-recovery': case 'not-found': case 'route-error': case 'global-error': return recovery(id);
    case 'connection-notice': return `<section class="writing-layout stack">${is('default') ? '<p class="small muted">Connection-notice specimen shown offline below. Healthy connection renders no notice in play.</p>' : ''}${connectionStrip()}${writing({connectionNotice:true})}</section>`;
    case 'deployment-update': return `<section class="profile-layout stack">${is('empty','loading') ? '<p class="muted">No update notice: version is healthy or unknown.</p>' : alertBox('A newer version is available','Finish or copy your draft before reloading. This sketch does not poll a deployment.','',button('Reload sketch view','recover','','secondary'))}${writing()}</section>`;
    case 'archive': return archive();
    case 'poem-detail': return reading({detail:true});
    case 'public-poem': return reading({publicView:true});
    case 'poem-sharing': return shareView();
    case 'recap-sharing': return shareView(true);
    case 'poem-image-export': return exportView();
    case 'poem-print': return exportView(true);
    case 'public-recap': return publicRecap();
    case 'sign-in': return accountEntry();
    case 'sign-up': return accountEntry(true);
    case 'auth-callback': return callback();
    case 'profile': return profile();
    case 'account-controls': return profile(true);
    case 'help': return `<section class="profile-layout"><div class="page-intro"><h1>Nine rounds.<br>One line at a time.</h1></div><div class="paper stack">${helpContent()}${button('Open the rules dialog','help')}</div></section>`;
    case 'appearance': return `<section class="profile-layout"><div class="page-intro"><h1>Make yourself comfortable.</h1></div><div class="paper">${appearanceContent()}</div></section>`;
    case 'releases': return releases();
    case 'releases-feed': return releases(true);
    case 'site-social-preview': case 'poem-social-preview': case 'recap-social-preview': return `<section class="showcase"><div class="showcase-head"><h1>${id === 'site-social-preview' ? 'A hello outside the room.' : 'A preview, not the whole story.'}</h1><p>Original social-art composition. Light artwork stays light in either surrounding palette.</p></div>${socialCard(id === 'site-social-preview' ? 'site' : id === 'recap-social-preview' ? 'recap' : 'poem',is('private','revoked','pending','empty','error'))}<p class="showcase-note">Synthetic artwork, not an exported production endpoint or a live public poem.</p></section>`;
    default: return emptyState('That surface is not in this sketch.','Use the labeled exploration selectors to choose an inventoried surface.','home','Go to the entrance');
  }
}

const OWNER_VIEW = {
  'root-layout':'app-shell','home-page':'home','host-page':'host-entry','join-page':'join-entry','room-page':'room-lobby','unexpected-room-state':'room-recovery','lobby':'room-lobby','writing-screen':'room-writing','writing-composer':'room-writing','waiting-screen':'room-waiting','reveal-phase':'reveal-circle','poem-display':'poem-reading','session-recap-hub':'session-recap','stage-shell':'lobby-presentation','lobby-stage':'lobby-presentation','reveal-stage':'reveal-presentation','archive-page':'archive','poem-detail':'poem-detail','recap-page':'public-recap','auth-layout':'sign-in','sign-in-page':'sign-in','sign-up-page':'sign-up','auth-callback-page':'auth-callback','profile-page':'profile','releases-page':'releases','not-found-page':'not-found','route-error-page':'route-error','global-error-page':'global-error'
};
function componentBody(id) {
  if (OWNER_VIEW[id]) return renderView(OWNER_VIEW[id]);
  switch (id) {
    case 'header': return `<div class="stack">${header()}<div class="paper"><p>Header specimen: joined mark, practical navigation and three named utility controls. Open More options for account/archive links on a phone.</p>${is('account') ? `<p class="privacy-line">Signed-in appearance fixture for ${esc(local.name)}. No provider session.</p>` : ''}</div></div>`;
    case 'footer': return footer();
    case 'lobby-join-qr': return `<div class="stack">${destination()}<div class="receipt">${icon('share')}<div><h3>Open this demo invitation</h3><p>The prototype offers a readable link instead of a fabricated scan code. Production QR must encode the actual authorized invitation.</p></div></div>${go('join-entry','Open demo join destination','')}</div>`;
    case 'room-chrome': return `<div class="stack">${header(true)}<div class="round-header"><h2 style="font:800 1.2rem 'Nunito Sans',sans-serif">Round 4 of 9</h2>${roundTrack(3)}</div><div class="actions">${button('Room tools','room-tools','','secondary')}${button('Copy demo code','copy-code','','quiet')}</div>${is('error') ? alertBox('Could not copy','The illustrative code is DEMO. Select it manually.','error') : ''}<p class="muted">The code stays out of the input area. Tools disclose it only when needed.</p></div>`;
    case 'focused-entry-appearance': return `<div class="stack">${button(`${icon('palette')} Appearance`,'appearance','','secondary')}<div class="field"><label for="focused-name">Pen name stays in place</label><input id="focused-name" value="${esc(local.name)}" autocomplete="nickname"></div><p class="muted">The same appearance drawer opens above this entry surface and restores its trigger on close.</p></div>`;
    case 'color-mode-control': return appearanceContent();
    case 'help-modal': return `<div class="stack">${helpContent()}${button('Open interactive help dialog','help')}</div>`;
    case 'connection-status': return `<div class="stack">${is('empty') ? '<p>Healthy connection: no banner is rendered in play.</p>' : connectionStrip()}<div class="field"><label for="connection-draft">Retained draft specimen</label><textarea id="connection-draft" rows="3">${esc(local.draft ?? 'through the sleeping')}</textarea></div></div>`;
    case 'deployment-skew-observer': return is('empty','loading') ? '<p>Healthy or unknown version. The interface correctly stays free of an update notice.</p>' : alertBox('A newer version is available','Finish or copy your draft before a user-controlled reload.','',button('Reload sketch view','recover','','secondary'));
    case 'room-panel-error-boundary': return `<div class="stack">${alertBox('This room panel could not load','Your local draft remains below. It is not an accepted contribution.','error')}<div class="field"><label for="boundary-draft">Unsent draft</label><textarea id="boundary-draft" rows="2">${esc(local.draft ?? 'through the sleeping')}</textarea></div>${button('Restore the writing sketch','navigate','data-view="room-writing"')}</div>`;
    case 'auth-error-state': return `<div class="stack">${alertBox('Guest connection unavailable','Your name is still here. Retry without creating an account.','error')}${button('Try guest connection again','navigate','data-view="join-entry"')}</div>`;
    case 'accounts-unavailable': return accountsUnavailable();
    case 'archive-info-strip': return `<div class="stack-tight"><p>${is('account') ? 'Your account can preserve poems across devices in the connected app. This is a visual fixture, not a connected account.' : 'Your poems belong to the local game and are tied to this browser guest session. They are not saved to an online account.'}</p>${is('account') ? go('poem-detail','Read your poem','quiet') : go('sign-in','Optional account entry','quiet')}</div>`;
    case 'archive-stats': return archiveStats();
    case 'stat-line': return archiveStats(false,true);
    case 'archive-stats-skeleton': return archiveStats(true);
    case 'poem-card': return archiveCard();
    case 'poem-card-skeleton': return archiveCard(true);
    case 'empty-archive': return `<div class="empty-composition" style="margin-block:0">${avatar('square')}<h2>${is('filtered') ? 'No poems in this specimen.' : 'The first poem is still ahead.'}</h2><p class="muted">${is('filtered') ? 'Unused filtered variant, shown for inventory completeness. This does not introduce a search workflow.' : 'Bring a few people and one word. Finished poems will have a place here.'}</p><div class="actions">${go('host-entry','Start a room','')}${go('join-entry','Join a room')}</div></div>`;
    case 'poem-silhouette': return `<div class="sample-row" style="align-items:start">${silhouette()}<div><h3>Nine lines, one shared shape.</h3><p class="muted">1, 2, 3, 4, 5, 4, 3, 2, 1 words. Always visible; no hover reveal.</p>${go('room-writing','Try the word constraint','quiet')}</div></div>`;
    case 'poem-silhouette-compact': return `<div class="stack"><h3>Unused variant retired</h3><p>The canonical nine-line silhouette replaces a second compact grammar. This is its alignment specimen, not a mounted route.</p>${silhouette()}</div>`;
    case 'author-dots': return `<div class="stack">${authorGroup()}${authorDetails()}<p class="small muted">Shapes supplement names. No anonymous color-only attribution.</p></div>`;
    case 'author-dots-inline': return `<div class="stack"><h3>Unused gradient variant retired</h3>${authorGroup(true)}<p class="muted">Use plain readable names, not a colored underline. Empty attribution omits the line.</p></div>`;
    case 'recap-export-button': return `<div class="stack">${button(`${icon('print')} Print or save as PDF`,'print')}<p class="muted">Opens the real browser print surface. Canceling does not report success or publish the set.</p>${poemSheet()}</div>`;
    case 'auth-showcase': return `<div class="stack"><h3>A public-example placement, not private content</h3>${is('empty') ? '<p>No public example available. Keep the account form useful without filling it with a private poem.</p>' : poemSheet()}<p class="small muted">Every name and line in this example is synthetic. No source poem or provider photo is fetched.</p></div>`;
    case 'release-card': return releaseEntry();
    case 'technical-details': return `<details ${is('open') ? 'open' : ''}><summary>Technical details</summary><div class="stack-tight" style="padding-top:16px"><h3>Interface</h3><ul><li>Original joined-jelly vectors.</li><li>In-flow exact-count writing plane.</li></ul><h3>Accessibility</h3><ul><li>Native dialog focus lifecycle.</li><li>No continuous animation or default audio.</li></ul><p class="small muted">Synthetic release-detail specimen, not shipped release claims.</p></div></details>`;
    case 'button': return `<div class="stack"><div class="sample-row">${button('Send line','demo-commit',is('disabled') ? 'disabled' : '')}${button('Back to lobby','navigate','data-view="room-lobby"','secondary')}${button('How to play','help','','quiet')}</div><div class="sample-row">${button('Sending line…','demo-commit','disabled aria-busy="true"')}${button('Waiting for two people','demo-commit','disabled','','')}</div><p class="muted">Disabled controls always have a reason. Focus and pressed states do not depend on character motion.</p><div id="component-feedback" role="status"></div></div>`;
    case 'input': return `<div class="stack"><div class="field"><label for="input-example">Your pen name</label><input id="input-example" value="${is('empty') ? '' : esc(is('long-text') ? 'An extraordinarily long pen name' : local.name)}" placeholder="What should we call you?" ${is('disabled') ? 'disabled' : ''} ${is('error') ? 'aria-invalid="true"' : ''} aria-describedby="input-help"><small id="input-help">${is('error') ? 'Enter a pen name with at least one non-space character.' : 'Visible labels stay after typing.'}</small></div><div class="field"><label for="invitation-example">Room code from invitation</label><input id="invitation-example" value="DEMO" readonly><small>Synthetic invitation; read-only, not disabled.</small></div></div>`;
    case 'label': return `<div class="stack"><div><p class="field-label">Private poem</p><p class="muted">Metadata is sentence-case text, not a form label.</p></div><div class="field"><label for="label-demo">Your pen name</label><input id="label-demo" value="Ari"><small>This label is associated with its actual native input.</small></div></div>`;
    case 'alert': return `<div class="stack">${alertBox('Your draft is still here','Reconnect before sending. Keep editing if you would like.','')}${alertBox('Line accepted','The locally accepted text is ready for the next part.','success')}${alertBox('Line was not accepted','Your draft has been kept. Try sending again.','error',button('Preview recovery','recover','','secondary'))}</div>`;
    case 'avatar': return `<div class="stack">${avatarChoices()}<div class="actions">${button('Open optional avatar drawer','avatar','','secondary')}${go('join-entry','Join with just a name','quiet')}</div><p class="muted">Choose an accessory or none. Names stay primary; no avatar step is required to join.</p></div>`;
    case 'host-badge': return `<div class="sample-row">${avatar('twins','none')}<div><h3>Ari <span class="host-badge">Host</span></h3><p class="muted">Room authority, not a crown or score.</p></div>${avatar('square','none')}<div><h3>Jo</h3><p class="muted">Participant</p></div></div>`;
    case 'loading-state': return loading('Preparing the room');
    case 'round-clock': return `<div class="stack"><div class="clock">${icon('clock')}<span>${is('overtime') ? 'Still time to write. There is no deadline.' : 'Take your time. There is no deadline.'}</span></div><p class="muted">The soft pacing window never prevents a valid line from being sent. No red warning face, draining ring or spoken countdown.</p>${go('room-writing','Return to a calm composer','')}</div>`;
    case 'stamp-animation': return `<div class="motion-demo"><div data-motion-target>${avatar('twins','none')}</div><h3>Ari joined the room</h3><p class="muted">One companion settle, not a generic rotated stamp.</p>${button('Replay arrival','replay','data-motion="stamp-arrival"','secondary')}</div>`;
    case 'word-slots': return `<div class="stack"><div class="field"><label for="slot-demo">Try a three-word line</label><input id="slot-demo" value="${is('overflow') ? 'too many words arrive here' : is('empty') ? '' : 'follows our umbrellas'}" aria-describedby="slot-feedback"></div><div class="word-status" id="slot-feedback">${wordFeedback(is('overflow') ? 'too many words arrive here' : is('empty') ? '' : 'follows our umbrellas',3)}</div><p class="muted">Only count strokes mirror the constraint. The input stays plain, stable and editable.</p></div>`;
    case 'heart-button': return `<div class="stack"><div class="sample-row">${heart()}<p class="muted">Your private favorite, not a room ranking.</p></div>${is('error') ? alertBox('Favorite did not update','The previous choice stays selected. Try again.','error') : ''}</div>`;
    case 'site-social-card': return socialCard('site');
    case 'poem-preview-card': return socialCard('poem',is('private','pending','error'));
    case 'poem-fallback-card': return socialCard('poem',true);
    case 'poem-full-card': return `<div class="stack">${poemSheet()}${button('Download full synthetic artwork','download','','secondary')}</div>`;
    case 'recap-social-card': return socialCard('recap',is('private','pending','error'));
    default: return `<p role="alert">This component requires a renderer. Use an inventoried selection.</p>`;
  }
}
function avatarChoices() {
  return `<div class="avatar-grid">${AVATARS.map(shape=>`<button class="avatar-choice" data-action="choose-avatar" data-avatar="${shape}" aria-pressed="${local.avatar === shape}">${avatar(shape,local.accessory)}<span>${AVATAR_NAMES[shape]}</span></button>`).join('')}</div>`;
}
function soundControls() {
  return `<div class="sound-controls"><div class="actions">${button(`${icon(local.sound ? 'sound' : 'mute')} ${local.sound ? 'Sound enabled · turn off' : 'Enable sound'}`,'sound',`aria-pressed="${local.sound}"`,'secondary')}${button('Play cue','cue',local.sound ? '' : 'disabled','secondary')}</div><div class="field"><label for="cue-volume">Cue volume</label><input id="cue-volume" data-setting="volume" type="range" min="0" max=".6" step=".05" value="${local.volume}"></div><p class="small muted">Silent by default. One original soft marimba-like note, only after activation. No vibration, music or per-keystroke sounds.</p></div>`;
}
const MOTION_STYLE = {
  'global-reduced-motion':'squash','color-mode-transition':'','viewport-projection':'','writing-focus-scroll':'','button-press':'press-once','stamp-arrival':'squash','loading-indicators':'','fade-up-entrances':'fade-once','archive-card-interaction':'','silhouette-bars':'','contributor-hover':'','waiting-presence-pulse':'','round-clock-drain':'','word-slot-feedback':'','ready-seal-loop':'','submission-confirmation':'squash','author-attribution-reveal':'','help-open-close':'fade-once','chrome-popover-feedback':'fade-once','reading-target-focus':'open-once','stage-roster-highlight':'squash','favorite-crown-ceremony':'','ceremony-effects-hook':'squash','profile-image-hover':'','unmounted-motion-definitions':''
};
function motionBody(id) {
  switch (id) {
    case 'global-reduced-motion': return `<div class="motion-demo"><div data-motion-target>${avatar()}</div><h3>Line accepted, in either setting.</h3><label class="check-control"><input type="checkbox" data-setting="reduced" ${query.reduced || systemMotion.matches ? 'checked' : ''} ${systemMotion.matches ? 'disabled' : ''}>Reduce motion${systemMotion.matches ? ' (device preference)' : ''}</label></div>`;
    case 'color-mode-transition': return `<div data-motion-target class="stack"><div class="receipt">${avatar()}<div><h3>The words never fade out.</h3><p>Switch palette immediately; the illustration is not inverted.</p></div></div>${button('Switch palette','toggle-mode','','secondary')}</div>`;
    case 'viewport-projection': case 'writing-focus-scroll': return `<div data-motion-target class="stack"><div class="field"><label for="focus-demo">Your line</label><textarea id="focus-demo" rows="4">through the sleeping station</textarea></div><p class="muted">The action remains in flow below the textarea. Keyboard geometry is functional, never animated.</p>${button('Focus the writing field','focus-demo','','secondary')}</div>`;
    case 'button-press': return `<div class="motion-demo"><div data-motion-target>${button('Accept local line','demo-commit')}</div><p class="muted">A brief physical press; text stays stable.</p></div>`;
    case 'stamp-arrival': case 'stage-roster-highlight': return `<div class="motion-demo"><div data-motion-target>${avatar('twins','none')}</div><h3>Ari <span class="host-badge">Just joined</span></h3><p class="muted">One arrival, no hidden staggered roster.</p></div>`;
    case 'loading-indicators': return `<div data-motion-target>${loading('Preparing your next line')}</div>`;
    case 'fade-up-entrances': return `<div data-motion-target class="receipt">${avatar()}<div><h3>The next part is ready.</h3><p>Only this plane appears; no list of independently sliding cards.</p></div></div>`;
    case 'archive-card-interaction': return `<div data-motion-target>${archiveCard()}</div>`;
    case 'silhouette-bars': return `<div data-motion-target class="stack">${silhouette()}<p>All nine strokes are present immediately. Hover adds no hidden content or movement.</p></div>`;
    case 'contributor-hover': case 'author-attribution-reveal': return `<div data-motion-target class="stack">${authorGroup()}${authorDetails()}<p class="small muted">Open authors deliberately. Names remain until you close the disclosure.</p></div>`;
    case 'waiting-presence-pulse': return `<div data-motion-target><h3>Waiting together.</h3>${chorus(false,true)}<p class="muted">No pulse, strike-through or quickest-writer order.</p></div>`;
    case 'round-clock-drain': return `<div data-motion-target class="stack"><div class="clock">${icon('clock')}Still time to write. There is no deadline.</div>${button('Keep writing','navigate','data-view="room-writing"')}<p class="muted">The soft window is not a gate or a judgment.</p></div>`;
    case 'word-slot-feedback': return componentBody('word-slots');
    case 'ready-seal-loop': return `<div data-motion-target class="stack"><div class="word-status" data-valid="true">${wordFeedback('follows our umbrellas',3)}</div>${button('Send line','demo-commit')}<p class="muted">Ready stays ready. No repeating ring.</p></div>`;
    case 'submission-confirmation': return `<div class="motion-demo"><div data-motion-target>${avatar()}</div><div class="receipt"><div><h3>Line accepted.</h3><p>through the sleeping station</p></div>${icon('check')}</div><p class="small muted">Local acceptance sketch, not server persistence evidence.</p></div>`;
    case 'help-open-close': return `<div data-motion-target class="stack">${helpContent()}${button('Open real rules dialog','help')}</div>`;
    case 'chrome-popover-feedback': return `<div data-motion-target class="actions">${button('Open appearance','appearance','','secondary')}${button('Open companion drawer','avatar','','secondary')}${button('Open room tools','room-tools','','secondary')}</div>`;
    case 'reading-target-focus': return `<div data-motion-target>${poemSheet()}</div>`;
    case 'favorite-crown-ceremony': return `<div data-motion-target class="motion-demo">${heart()}<h3>A favorite is yours, not a winner.</h3><p class="muted">No crown, leader change, burst, confetti or scoring cue.</p></div>`;
    case 'ceremony-effects-hook': return `<div class="stack"><div data-motion-target class="receipt">${avatar()}<div><h3>Line accepted.</h3><p>One optional cue after an explicit local action.</p></div></div>${soundControls()}</div>`;
    case 'profile-image-hover': return `<div data-motion-target class="sample-row">${avatar('arch','glasses')}<div><h3>Ari</h3><p>No hover filter. The same identity, always.</p></div></div>`;
    case 'unmounted-motion-definitions': return `<div data-motion-target class="stack"><h3>Unused effects retired</h3><p>No breathing, typewriter or final-line wipe. Complete readable content replaces all three.</p>${poemSheet()}</div>`;
    default: return '';
  }
}
function swatches() {
  return `<div class="swatches">${[['Lavender','#EEE8FF'],['White','#FFFFFF'],['Plum','#39234E'],['Action','#672CB5'],['Mint','#B6F1D0'],['Peach','#FFB887']].map(([name,color])=>`<div class="swatch"><div style="background:${color}"></div><p><strong>${name}</strong><br>${color}</p></div>`).join('')}</div>`;
}
function sensoryBody(id) {
  switch (id) {
    case 'brand-identity': return `<div class="stack">${heroArt()}${swatches()}<p class="muted">One original cast around one plain plane. The identity stays recognizable without color.</p></div>`;
    case 'wordmark-and-logo': return `<div class="stack"><div class="wordmark" style="font-size:clamp(2.7rem,8vw,5rem)">${mark()}<span>linejam</span></div><div class="sample-row">${mark('brand-symbol')}${mark('brand-symbol')}<p class="muted">Joined silhouettes form the mark; brows are optional detail, not its only recognition cue.</p></div></div>`;
    case 'device-brand-assets': return `<div class="sample-row" style="align-items:end">${[16,32,64,128].map(size=>`<figure style="text-align:center"><div class="device-tile" style="width:${Math.max(size + 16,44)}px;height:${Math.max(size + 16,44)}px;padding:8px">${mark('device-mark')}</div><figcaption class="small muted">${size}px specimen</figcaption></figure>`).join('')}</div>`;
    case 'paper-grain-and-depth': return `<div class="stack"><div class="paper" style="background:var(--soft);padding:28px"><h2 style="font-size:2rem">A quiet shared plane.</h2><p style="margin-top:15px">No grain, blur or texture behind words. A shallow shadow grounds the surface.</p></div><div class="field"><label for="material-field">Plain text input, never a blob</label><input id="material-field" value="The words are the important part."></div></div>`;
    case 'typographic-voice': return `<div class="type-sample"><div><p class="small muted">DynaPuff · arrival and mark</p><p class="display">Better together.</p></div><div><p class="small muted">Nunito Sans · every practical decision</p><h3>Write exactly four words.</h3><p>Only the previous line is visible. Your draft stays with you until it is accepted.</p></div><div><p class="small muted">Nunito Sans · complete poem</p>${poemLines()}<p style="overflow-wrap:anywhere;margin-top:20px">Averylongpennamewithoutconvenientbreaks is still a person's name.</p></div></div>`;
    case 'player-identity': return `<div class="stack">${avatarChoices()}${button('Choose brows and accessory','avatar','','secondary')}<p class="muted">Arch, double and square silhouettes are non-gendered. A pen name alone always works.</p></div>`;
    case 'word-pattern-shape': return `<div class="sample-row" style="align-items:start">${silhouette()}<div class="stack-tight"><h3>1, 2, 3, 4, 5, 4, 3, 2, 1</h3>${poemLines()}${go('room-writing','Try the exact word counter','quiet')}</div></div>`;
    case 'icon-vocabulary': return `<div class="sample-row">${[['help','How to play','help'],['palette','Appearance','appearance'],['heart','Favorite','favorite'],['copy','Copy demo code','copy-code'],['download','Download sample','download'],['mute','Enable sound','sound'],['print','Print','print'],['share','Share sketch text','native-share']].map(([name,label,action])=>button(`${icon(name)} ${label}`,action,'','secondary')).join('')}</div>`;
    case 'ceremony-audio': return `<div class="stack"><div class="receipt">${avatar()}<div><h3>A soft acknowledgement.</h3><p>Short, original and explicitly activated. Silence is the default identity too.</p></div></div><p class="muted">A sine fundamental and short inharmonic partial suggest a soft marimba strike. No borrowed sample, random squeak, applause or music.</p></div>`;
    case 'ceremony-haptics': return `<div class="stack">${alertBox('No vibration','Jelly Chorus deliberately retires vibration. Clear accepted text and optional sound do the work.')}<div class="receipt">${icon('check')}<div><h3>Line accepted.</h3><p>Identical information without a device buzz.</p></div></div></div>`;
    case 'share-artifacts': return `<div class="stack"><h3>Authorized teaser</h3>${socialCard('poem')}<h3>Private fallback: no poem content</h3>${socialCard('poem',true)}<h3>Private complete-image layout</h3>${poemSheet()}${button('Download the full synthetic image','download','','secondary')}</div>`;
    case 'native-platform-surfaces': return `<div class="stack"><p>The browser owns its share, print and file UI. These buttons invoke the actual platform when supported; no fake OS sheet is drawn here.</p><div class="actions">${button('Share generic sketch text','native-share','','secondary')}${button('Download synthetic SVG','download','','secondary')}${button('Open browser print','print','','secondary')}</div><p class="small muted">Native share uses only a generic sketch description, never the local poem or a public poem URL. Cancellation stays neutral.</p></div>`;
    case 'public-auth-showcase': return `<div class="stack"><h3>A synthetic public example, not a private poem.</h3>${poemSheet()}${go('sign-in','See optional account entry','secondary')}</div>`;
    default: return '';
  }
}
function showcase(kind,id) {
  const item = CATALOG[kind].find(entry=>entry.id === id);
  const body = kind === 'component' ? componentBody(id) : kind === 'motion' ? motionBody(id) : sensoryBody(id);
  return `<section class="showcase"><div class="showcase-head"><h1>${esc(item.label)}</h1><p>${esc(item.description)}</p></div><div class="showcase-work">${body}</div>${kind === 'motion' ? `<div class="stack-tight" style="margin-top:25px"><div class="actions">${button('Replay motion','replay',`data-motion="${id}"`)}<span class="small muted">${query.reduced || systemMotion.matches ? 'Reduced motion: final positions only.' : 'One deliberate replay. No idle loops.'}</span></div><p class="small muted">${esc(item.timing)}</p><p class="small muted">${esc(item.reducedMotion)}</p><div id="motion-status" role="status" class="small"></div></div>` : kind === 'sensory' ? `<div class="paper stack" style="margin-top:25px">${soundControls()}<div class="actions">${button('Avatar options','avatar','','secondary')}${button('Appearance and reduced motion','appearance','','quiet')}</div><p class="small muted">Risk: ${esc(item.risk)}</p></div>` : ''}<p class="showcase-note">Inventory-specific local design sketch. No live gameplay, account or production rendering evidence.</p></section>`;
}

function rssText() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Linejam updates (synthetic sketch)</title>
    <link>https://example.invalid/releases</link>
    <description>Design-sketch feed. Not a live product endpoint.</description>
    <item>
      <title>A quieter place for the next line</title>
      <pubDate>Sat, 06 Sep 2026 12:00:00 GMT</pubDate>
      <description>Synthetic product note for the Jelly Chorus exploration. No live release is claimed.</description>
      <guid>urn:linejam:jelly-chorus:quiet-line</guid>
    </item>
  </channel>
</rss>`;
}
const PLAY = new Set(['host-entry','join-entry','room-lobby','lobby-presentation','room-writing','room-waiting','late-join-spectator','reveal-circle','poem-reading','reveal-presentation','session-recap','room-unavailable','room-recovery','connection-notice']);
const STATE_MAP = {
  'view:app-shell': ['default','account'],
  'view:home': ['default'],
  'view:host-entry': ['default','loading','empty','error','pending','recovery','long-text'],
  'view:join-entry': ['default','loading','empty','error','pending','recovery','invite','long-text'],
  'view:room-lobby': ['default','loading','empty','error','full','participant','away','long-text'],
  'view:lobby-presentation': ['default','full','away','long-text'],
  'view:room-writing': ['default','loading','empty','error','pending','recovery','first','last','exact','overflow','long-text','offline','restored','accepted'],
  'view:room-waiting': ['default','loading','accepted','ready','error'],
  'view:late-join-spectator': ['default','loading','spectator'],
  'view:reveal-circle': ['default','loading','empty','error','pending','spectator','fallback','reread'],
  'view:poem-reading': ['default','loading','error','pending'],
  'view:reveal-presentation': ['default','loading','empty','error','pending'],
  'view:session-recap': ['default','loading','empty','error'],
  'view:room-unavailable': ['default'],
  'view:room-recovery': ['default','loading','error','recovery'],
  'view:guest-session-recovery': ['default','loading','error','recovery'],
  'view:connection-notice': ['default','offline','pending','restored','recovery'],
  'view:deployment-update': ['default','empty','loading'],
  'view:archive': ['default','loading','empty','error','account'],
  'view:poem-detail': ['default','loading','error','pending'],
  'view:public-poem': ['default','loading','pending','private','revoked','empty','error'],
  'view:poem-sharing': ['default','pending','error','canceled','recovery'],
  'view:recap-sharing': ['default','pending','error','canceled','recovery'],
  'view:poem-image-export': ['default','pending','private','empty','error'],
  'view:poem-print': ['default'],
  'view:public-recap': ['default','loading','private','revoked','empty','error'],
  'view:sign-in': ['default','local','empty','error','pending','verification','recovery'],
  'view:sign-up': ['default','local','empty','error','pending','verification'],
  'view:auth-callback': ['default','loading','error','local','empty'],
  'view:profile': ['default','account','long-text'],
  'view:account-controls': ['default','account'],
  'view:help': ['default'],
  'view:appearance': ['default'],
  'view:releases': ['default','empty'],
  'view:releases-feed': ['default','empty'],
  'view:not-found': ['default'],
  'view:route-error': ['default'],
  'view:global-error': ['default'],
  'view:site-social-preview': ['default'],
  'view:poem-social-preview': ['default','private','revoked','pending','empty','error'],
  'view:recap-social-preview': ['default','private','revoked','pending','empty','error'],
  'component:empty-archive': ['default','filtered'],
  'component:technical-details': ['default','open'],
  'component:round-clock': ['default','overtime'],
  'component:button': ['default','disabled','pending'],
  'component:input': ['default','empty','disabled','error','long-text'],
  'component:word-slots': ['default','empty','overflow'],
  'component:heart-button': ['default','pending','error'],
  'component:connection-status': ['default','empty','pending','recovery'],
  'component:deployment-skew-observer': ['default','empty','loading'],
  'component:auth-showcase': ['default','empty'],
  'component:poem-preview-card': ['default','private','pending','error'],
  'component:recap-social-card': ['default','private','pending','error'],
  'component:stamp-animation': ['default']
};
function statesFor(kind, id) {
  if (kind === 'motion' || kind === 'sensory') return ['default'];
  return STATE_MAP[`${kind}:${id}`] || ['default','loading','empty','error','recovery','pending','disabled','long-text'];
}
if (!CATALOG[query.surface]) query.surface = 'view';
if (!CATALOG[query.surface].some(entry => entry.id === query.id)) {
  query.id = query.surface === 'view' ? 'home' : CATALOG[query.surface][0].id;
}
if (!statesFor(query.surface, query.id).includes(query.state)) query.state = 'default';

function appliedMode() {
  if (local.modePreference === 'system') return systemDark.matches ? 'dark' : 'light';
  return query.mode === 'dark' || local.modePreference === 'dark' ? 'dark' : 'light';
}
function motionReduced() {
  return query.reduced || systemMotion.matches;
}
function announce(message) {
  const live = document.querySelector('#announcer');
  if (!live) return;
  live.textContent = '';
  live.textContent = message;
}
function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  announce(message);
}
function syncURL() {
  const next = new URLSearchParams();
  next.set('surface', query.surface);
  next.set('id', query.id);
  if (query.state && query.state !== 'default') next.set('state', query.state);
  next.set('mode', query.mode);
  if (query.reduced) next.set('reduced', '1');
  if (query.embed) next.set('embed', '1');
  history.replaceState(null, '', `${location.pathname}?${next}`);
}
function applyDocument() {
  const mode = appliedMode();
  query.mode = mode;
  document.documentElement.dataset.mode = mode;
  document.documentElement.dataset.reduced = motionReduced() ? 'true' : 'false';
  document.body.dataset.direction = 'jelly-chorus';
  document.body.dataset.surfaceId = query.id;
  document.body.dataset.embed = query.embed ? '1' : '0';
  document.body.dataset.kind = query.surface;
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', mode === 'dark' ? '#23172F' : '#EEE8FF');
  const controls = document.querySelector('#exploration-controls');
  if (controls) controls.hidden = query.embed;
}
function fillExploration() {
  const kind = document.querySelector('#surface-kind');
  const choice = document.querySelector('#surface-choice');
  const state = document.querySelector('#state-choice');
  const mode = document.querySelector('#mode-choice');
  const reduced = document.querySelector('#reduced-choice');
  if (!kind || !choice || !state || !mode || !reduced) return;
  kind.value = query.surface;
  const items = CATALOG[query.surface];
  choice.innerHTML = items.map(entry => `<option value="${entry.id}">${esc(entry.label)}</option>`).join('');
  choice.value = query.id;
  const states = statesFor(query.surface, query.id);
  state.innerHTML = states.map(name => `<option value="${name}">${esc(name)}</option>`).join('');
  state.value = states.includes(query.state) ? query.state : 'default';
  mode.value = query.mode;
  reduced.checked = motionReduced();
  reduced.disabled = systemMotion.matches;
}
function wrapView(id, inner) {
  if (id === 'global-error') {
    return `<main id="surface" tabindex="-1" data-direction="jelly-chorus" data-surface-id="${id}">${inner}</main>`;
  }
  const focused = PLAY.has(id);
  return `<div class="app-shell"><main id="surface" tabindex="-1" data-direction="jelly-chorus" data-surface-id="${id}">${header(focused)}${inner}${focused ? '' : footer()}</main></div>`;
}
function restoreFocus(target) {
  if (!target) return;
  const scope = dialog.open ? dialog : document;
  const replacement = target.isConnected ? target : target.id ? document.getElementById(target.id) : Array.from(scope.querySelectorAll('[data-action]')).find(node =>
    node.dataset.action === target.dataset.action && node.dataset.view === target.dataset.view && node.dataset.set === target.dataset.set && node.getBoundingClientRect().width > 0
  );
  (replacement || document.querySelector('#surface'))?.focus({ preventScroll: true });
}
function render() {
  const focused = document.activeElement;
  const authors = document.querySelector('.poem-authors');
  if (authors instanceof HTMLDetailsElement) local.authorOpen = authors.open;
  applyDocument();
  fillExploration();
  const kind = query.surface;
  const id = query.id;
  let inner;
  if (kind === 'view') inner = wrapView(id, renderView(id));
  else inner = wrapView(id, showcase(kind, id));
  app.innerHTML = inner;
  const drawerSound = dialog.querySelector('.sound-controls');
  if (drawerSound) drawerSound.outerHTML = soundControls();
  if (!focused.isConnected) restoreFocus(focused);
  if (kind === 'view' && id === 'join-entry' && is('invite') && !dialog.open) document.querySelector('#pen-name')?.focus();
  if (kind === 'motion' && !motionReduced()) {
    const target = document.querySelector('[data-motion-target]');
    const cls = MOTION_STYLE[id];
    if (target && cls) target.classList.add(cls);
  }
  const heading = document.querySelector('#surface h1, #surface h2, #drawer-title');
  if (heading) document.title = `${heading.textContent.replace(/\s+/g, ' ').trim()} · Jelly Chorus`;
  else document.title = 'Jelly Chorus · Linejam design sketch';
}

function navigate(id, state = 'default') {
  query.surface = 'view';
  query.id = id;
  query.state = state;
  syncURL();
  render();
  const surface = document.querySelector('#surface');
  if (id !== 'join-entry' || state !== 'invite') {
    surface?.focus({ preventScroll: true });
    surface?.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' });
  }
  const title = document.querySelector('#surface h1');
  announce(title ? title.textContent.replace(/\s+/g, ' ').trim() : 'Updated sketch');
}
function closeDrawer() {
  if (dialog.open) dialog.close();
}
function openDrawer(title, body) {
  if (!dialog.open) returnFocus = document.activeElement;
  dialog.innerHTML = `<form class="drawer-content" method="dialog"><div class="drawer-heading"><h2 id="drawer-title">${title}</h2><button class="icon-button" value="close" aria-label="Close">${icon('close')}</button></div>${body}</form>`;
  dialog.showModal();
  dialog.querySelector('button, input, [href], [tabindex]')?.focus();
}
function avatarDrawer() {
  openDrawer('Choose a companion', `<p>Optional. Your pen name is enough, and you can change this later.</p>${avatarChoices()}<fieldset style="margin:0;padding:0;border:0"><legend class="field-label" style="margin-bottom:10px">Accessory</legend><div class="sample-row">${[['none','None'],['glasses','Glasses'],['cap','Cap']].map(([value,label]) => `<label class="check-control"><input type="radio" name="accessory" value="${value}" ${local.accessory === value ? 'checked' : ''}>${label}</label>`).join('')}</div></fieldset><p class="small muted">These original silhouettes are not gendered and are not a score.</p><div class="actions"><button class="button" value="close">Keep pen name and continue</button></div>`);
}
function helpDrawer() {
  openDrawer('How to play', `${helpContent()}<button class="button" value="close">Got it</button>`);
}
function appearanceDrawer() {
  openDrawer('Appearance and comfort', `${appearanceContent()}<button class="button" value="close">Done</button>`);
}
function menuDrawer() {
  openDrawer('More options', `<nav class="stack-tight" aria-label="Account and poems"><p class="muted">${esc(local.name)} · local sketch guest</p>${go('archive','Your poems','')}${go('profile','Identity','secondary')}${go('sign-in','Optional account entry','quiet')}<button class="button quiet" value="close" data-action="help">How to play</button></nav>`);
}
function toolsDrawer() {
  openDrawer('Room tools', `<p>Demo destination only. No live QR code is generated.</p><div class="stack-tight"><p><strong>DEMO</strong> · not a real room code</p><div class="actions">${button('Copy demo code','copy-code','','secondary')}${go('lobby-presentation','Present room')}${go('join-entry', 'Open demo invitation', 'quiet', 'invite')}</div></div><button class="button quiet" value="close">Close</button>`);
}
function publishDrawer(set) {
  openDrawer(set ? 'Share this whole set?' : 'Share this poem?', `<p>${set ? 'A public link would include every poem in this set and all author names.' : 'A public link would include this poem and all author names.'} This sketch does not create a real URL.</p><p>Saving a private copy is a different action and does not publish.</p><div class="actions"><button class="button" data-action="confirm-publish" data-set="${set}" type="button">Make public in this sketch</button><button class="button secondary" value="close">Keep private</button></div>`);
}
function replayMotion(id) {
  const target = document.querySelector('[data-motion-target]');
  const status = document.querySelector('#motion-status');
  const cls = MOTION_STYLE[id] || 'squash';
  if (motionReduced()) {
    if (status) status.textContent = 'Reduced motion: the final state is already visible.';
    announce('Reduced motion. The outcome is visible without movement.');
    return;
  }
  if (!target || !MOTION_STYLE[id]) {
    if (status) status.textContent = 'This treatment is intentionally still. Replay confirms there is no extra choreography.';
    announce('No extra motion. The information is already on screen.');
    return;
  }
  target.classList.remove(cls);
  void target.offsetWidth;
  target.classList.add(cls);
  if (status) status.textContent = 'Playing one acknowledgement.';
  announce('Playing one acknowledgement.');
}
function enableSound(on) {
  local.sound = on;
  if (!on) {
    toast('Sound is off.');
    render();
    return;
  }
  try {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    playCue(true);
    toast('Sound is on. A short cue will play after accepted actions.');
  } catch (error) {
    local.sound = false;
    toast('This browser could not start sound.');
  }
  render();
}
function playCue(force = false) {
  if (!local.sound) {
    toast('Sound is off. Enable it to hear the cue.');
    return;
  }
  const now = performance.now();
  if (!force && now - lastCue < 420) return;
  lastCue = now;
  try {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const ctx = audioContext;
    const t = ctx.currentTime;
    const peak = Math.min(0.045, Math.max(0, local.volume * 0.12));
    if (peak === 0) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    gain.connect(ctx.destination);
    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(392, t);
    fundamental.frequency.exponentialRampToValueAtTime(370, t + 0.22);
    const partial = ctx.createOscillator();
    partial.type = 'triangle';
    partial.frequency.setValueAtTime(784, t);
    const partialGain = ctx.createGain();
    partialGain.gain.value = 0.16;
    fundamental.connect(gain);
    partial.connect(partialGain).connect(gain);
    fundamental.start(t);
    partial.start(t);
    fundamental.stop(t + 0.28);
    partial.stop(t + 0.16);
  } catch (error) {
    toast('This browser could not play the cue.');
  }
}
function downloadFile(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Download started. Your browser controls whether the file is saved.');
}
function poemArtwork() {
  const lines = local.active && local.lines.length === 9 ? local.lines : SAMPLE;
  const by = local.active && local.lines.length === 9
    ? `${local.name} wrote every line in this local single-writer sketch`
    : 'Ari, Jo and Nima · synthetic attribution';
  const height = 220 + lines.length * 54;
  const text = lines.map((line, index) => `<text x="72" y="${168 + index * 54}" font-size="28" fill="#39234E">${esc(line)}</text>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-label="Complete synthetic poem artwork">
  <rect width="1200" height="${height}" fill="#EEE8FF"/>
  <rect x="48" y="48" width="1104" height="${height - 96}" rx="28" fill="#FFFFFF"/>
  <text x="72" y="100" font-family="Nunito Sans, Segoe UI, sans-serif" font-size="18" fill="#665074">linejam · private synthetic artwork</text>
  <g font-family="Nunito Sans, Segoe UI, sans-serif">${text}</g>
  <text x="72" y="${height - 70}" font-family="Nunito Sans, Segoe UI, sans-serif" font-size="16" fill="#665074">${esc(by)}</text>
  <text x="72" y="${height - 46}" font-family="Nunito Sans, Segoe UI, sans-serif" font-size="14" fill="#665074">Not live gameplay evidence. Saving privately does not publish.</text>
</svg>`;
}
function updateWordUI(field, feedback, buttonEl, target) {
  if (!field || !feedback) return;
  const value = field.value.replace(/\s+/gu, ' ');
  if (value !== field.value && field.selectionStart === field.value.length) field.value = value;
  const count = words(field.value).length;
  const exact = count === target;
  feedback.innerHTML = wordFeedback(field.value, target, buttonEl?.dataset.blocked === 'true' ? 'Ready when connected' : 'Ready to send');
  feedback.dataset.valid = String(exact);
  feedback.dataset.over = String(count > target);
  if (buttonEl) buttonEl.disabled = !exact || buttonEl.dataset.blocked === 'true';
  clearTimeout(countTimer);
  countTimer = setTimeout(() => {
    const extra = target - count;
    announce(extra === 0 ? `Ready to send ${target} ${target === 1 ? 'word' : 'words'}.` : extra > 0 ? `Add ${extra} ${extra === 1 ? 'word' : 'words'}.` : `Remove ${-extra} ${-extra === 1 ? 'word' : 'words'}.`);
  }, 500);
}
function beginSketch(name) {
  local.name = name;
  local.reader = name;
  local.active = true;
  local.round = 0;
  local.lines = [];
  local.draft = '';
  local.accepted = false;
  local.sending = false;
  local.favorite = false;
  local.public = false;
  local.setPublic = false;
  query.state = 'default';
  navigate('room-lobby');
  toast('Local sketch lobby. People besides you are illustrative fixtures.');
}
function acceptCurrentLine(raw) {
  const value = normalized(raw);
  const target = SHAPE[local.round];
  if (words(value).length !== target) return false;
  local.draft = value;
  local.lines[local.round] = value;
  local.accepted = true;
  local.sending = false;
  query.surface = 'view';
  query.id = 'room-waiting';
  query.state = 'accepted';
  syncURL();
  render();
  if (local.sound) playCue();
  announce(local.round === 8 ? 'Final line accepted. The complete poem is ready.' : 'Line accepted. Waiting together.');
  return true;
}

function onAction(action, node, event) {
  if (action === 'navigate') {
    event.preventDefault();
    returnFocus = null;
    closeDrawer();
    navigate(node.dataset.view || 'home', node.dataset.state || 'default');
    return;
  }
  if (action === 'help') { event.preventDefault(); helpDrawer(); return; }
  if (action === 'appearance') { event.preventDefault(); appearanceDrawer(); return; }
  if (action === 'menu') { event.preventDefault(); menuDrawer(); return; }
  if (action === 'avatar') { event.preventDefault(); avatarDrawer(); return; }
  if (action === 'room-tools') { event.preventDefault(); toolsDrawer(); return; }
  if (action === 'choose-avatar') {
    local.avatar = node.dataset.avatar;
    render();
    if (dialog.open) avatarDrawer();
    dialog.querySelector(`[data-avatar="${local.avatar}"]`)?.focus();
    announce(`${AVATAR_NAMES[local.avatar]} selected. Your pen name is unchanged.`);
    return;
  }
  if (action === 'copy-code') {
    event.preventDefault();
    const value = 'DEMO';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => toast('Copied DEMO. It is not a live room code.')).catch(() => toast('Copy DEMO from the page. It is not a live room code.'));
    } else toast('Copy DEMO from the page. It is not a live room code.');
    return;
  }
  if (action === 'start') {
    event.preventDefault();
    local.active = true;
    local.round = 0;
    local.lines = [];
    local.draft = '';
    local.accepted = false;
    local.reader = local.name;
    local.favorite = false;
    local.public = false;
    local.setPublic = false;
    local.authorOpen = false;
    navigate('room-writing', 'first');
    announce('Round 1 of 9. Write exactly 1 word.');
    return;
  }
  if (action === 'next-round') {
    event.preventDefault();
    if (!local.active) {
      navigate(query.id === 'late-join-spectator' ? 'reveal-circle' : 'poem-reading');
      return;
    }
    if (local.round >= 8 && local.lines.length === 9) {
      navigate('poem-reading');
      announce('The whole poem is visible.');
      return;
    }
    local.round = Math.min(8, local.round + 1);
    local.draft = '';
    local.accepted = false;
    navigate('room-writing', local.round === 0 ? 'first' : local.round === 8 ? 'last' : 'default');
    announce(`Round ${local.round + 1} of 9. Write exactly ${SHAPE[local.round]} ${SHAPE[local.round] === 1 ? 'word' : 'words'}.`);
    return;
  }
  if (action === 'close-room' || action === 'end-game') {
    event.preventDefault();
    local.active = false;
    local.lines = [];
    local.draft = '';
    navigate(action === 'end-game' ? 'room-lobby' : 'home');
    toast(action === 'end-game' ? 'Sketch returned to the lobby. Unfinished poems stay hidden.' : 'Left the local sketch.');
    return;
  }
  if (action === 'cancel-end') { event.preventDefault(); toast('Continuing this sketch.'); return; }
  if (action === 'recover') {
    event.preventDefault();
    const draft = document.querySelector('#line-draft, #connection-draft, #boundary-draft');
    if (draft) local.draft = draft.value;
    const owner = OWNER_VIEW[query.id] || query.id;
    if (owner === 'room-recovery') navigate('room-writing', 'recovery');
    else if (owner === 'guest-session-recovery') navigate('join-entry', 'recovery');
    else if (owner === 'route-error' || owner === 'global-error') navigate('home');
    else if (owner === 'auth-callback') navigate('sign-in');
    else {
      query.state = owner === 'deployment-update' || owner === 'deployment-skew-observer' ? 'empty' : 'recovery';
      syncURL();
      render();
    }
    toast('Recovered sketch state. No live backend was contacted.');
    return;
  }
  if (action === 'favorite') {
    event.preventDefault();
    if (is('error')) { query.state = 'default'; syncURL(); }
    local.favorite = !local.favorite;
    render();
    announce(local.favorite ? 'Saved as a personal favorite. Not a room ranking.' : 'Removed from favorites.');
    return;
  }
  if (action === 'pass-reader') {
    event.preventDefault();
    const names = [local.name, 'Jo', 'Nima'];
    const index = names.indexOf(local.reader);
    local.reader = names[(index + 1) % names.length];
    render();
    announce(`${local.reader} is reading. The whole poem stays visible.`);
    return;
  }
  if (action === 'publish') { event.preventDefault(); publishDrawer(node.dataset.set === 'true'); return; }
  if (action === 'confirm-publish') {
    event.preventDefault();
    if (node.dataset.set === 'true') local.setPublic = true;
    else local.public = true;
    closeDrawer();
    render();
    toast('Marked public in this local consent sketch. No real link was created.');
    return;
  }
  if (action === 'revoke') {
    event.preventDefault();
    if (node.dataset.set === 'true') local.setPublic = false;
    else local.public = false;
    render();
    toast('Private again in this sketch.');
    return;
  }
  if (action === 'download') {
    event.preventDefault();
    downloadFile('linejam-jelly-chorus-poem.svg', 'image/svg+xml', poemArtwork());
    return;
  }
  if (action === 'download-rss') {
    event.preventDefault();
    downloadFile('linejam-jelly-chorus-updates.xml', 'application/rss+xml', rssText());
    return;
  }
  if (action === 'print') { event.preventDefault(); window.print(); return; }
  if (action === 'native-share') {
    event.preventDefault();
    const payload = { title: 'Linejam design sketch', text: 'A local Linejam design sketch. Not a live poem, room, or public link.' };
    if (navigator.share) {
      navigator.share(payload).then(() => toast('Native share closed. No poem URL was created.')).catch(() => toast('Sharing canceled. Nothing was published.'));
    } else toast('Native sharing is unavailable here. Nothing was published.');
    return;
  }
  if (action === 'sound') { event.preventDefault(); enableSound(!local.sound); return; }
  if (action === 'cue') { event.preventDefault(); playCue(true); return; }
  if (action === 'replay') { event.preventDefault(); replayMotion(node.dataset.motion || query.id); return; }
  if (action === 'toggle-mode') {
    event.preventDefault();
    local.modePreference = query.mode === 'dark' ? 'light' : 'dark';
    query.mode = local.modePreference;
    syncURL();
    render();
    announce(`${query.mode} palette. Artwork is not inverted.`);
    return;
  }
  if (action === 'focus-demo') {
    event.preventDefault();
    document.querySelector('#focus-demo, #line-draft')?.focus();
    document.querySelector('#focus-demo, #line-draft')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    return;
  }
  if (action === 'demo-commit') {
    event.preventDefault();
    const feedback = document.querySelector('#component-feedback');
    if (feedback) feedback.textContent = 'Pressed. In writing, acknowledgement waits for accepted text.';
    if (local.sound) playCue();
    return;
  }
  if (action === 'account-next') {
    event.preventDefault();
    query.state = query.state === 'verification' ? 'error' : 'verification';
    syncURL();
    render();
    toast('Still a visual fixture. No account request was sent.');
    return;
  }
  if (action === 'guest-mode') { event.preventDefault(); query.state = 'default'; syncURL(); render(); return; }
  if (action === 'provider-info') { event.preventDefault(); toast('Provider account management is external. This sketch does not open it.'); return; }
}

document.addEventListener('click', event => {
  const node = event.target.closest('[data-action]');
  if (!node) {
    if (event.target === dialog) dialog.close();
    return;
  }
  onAction(node.dataset.action, node, event);
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.method === 'dialog' || form.closest('dialog')) return;
  event.preventDefault();
  if (form.id === 'entry-form') {
    const nameField = form.querySelector('#pen-name');
    const codeField = form.querySelector('#room-code');
    const error = form.querySelector('#entry-error');
    const name = nameField ? nameField.value.trim() : '';
    if (!name) {
      if (nameField) nameField.setAttribute('aria-invalid', 'true');
      if (error) error.textContent = 'Enter a pen name with at least one non-space character.';
      nameField?.focus();
      return;
    }
    if (codeField && codeField.value.trim().toUpperCase() !== 'DEMO') {
      codeField.setAttribute('aria-invalid', 'true');
      if (error) error.textContent = 'Use DEMO in this local sketch. No live room is connected.';
      codeField.focus();
      return;
    }
    beginSketch(name);
    return;
  }
  if (form.id === 'writing-form') {
    if (form.querySelector('#send-line')?.dataset.blocked === 'true') return;
    const field = form.querySelector('#line-draft');
    const error = form.querySelector('#writing-error');
    if (!local.active) {
      local.round = effectiveRound();
      local.active = true;
      local.lines = SAMPLE.slice(0, local.round);
    }
    const ok = acceptCurrentLine(field ? field.value : local.draft);
    if (!ok && error) error.textContent = `Write exactly ${SHAPE[local.round]} ${SHAPE[local.round] === 1 ? 'word' : 'words'}. Your draft is still here.`;
    return;
  }
  if (form.id === 'account-fixture') {
    query.state = 'verification';
    syncURL();
    render();
    toast('Still a visual fixture. No account request was sent.');
  }
});
document.addEventListener('input', event => {
  const field = event.target;
  if (field.id === 'connection-draft' || field.id === 'boundary-draft') local.draft = field.value;
  if (field.id === 'line-draft') {
    local.draft = field.value;
    updateWordUI(field, document.querySelector('#word-feedback'), document.querySelector('#send-line'), SHAPE[effectiveRound()]);
  }
  if (field.id === 'slot-demo') {
    updateWordUI(field, document.querySelector('#slot-feedback'), null, 3);
  }
  if (field.id === 'pen-name') local.name = field.value;
});
document.addEventListener('change', event => {
  const field = event.target;
  if (field.id === 'surface-kind') {
    query.surface = field.value;
    query.id = query.surface === 'view' ? 'home' : CATALOG[query.surface][0].id;
    query.state = 'default';
    syncURL();
    render();
    return;
  }
  if (field.id === 'surface-choice') {
    query.id = field.value;
    query.state = 'default';
    syncURL();
    render();
    return;
  }
  if (field.id === 'state-choice') {
    query.state = field.value;
    syncURL();
    render();
    return;
  }
  if (field.id === 'mode-choice') {
    query.mode = field.value;
    local.modePreference = field.value;
    syncURL();
    render();
    return;
  }
  if (field.id === 'reduced-choice') {
    query.reduced = field.checked;
    syncURL();
    render();
    return;
  }
  if (field.name === 'appearance-mode') {
    local.modePreference = field.value;
    query.mode = field.value === 'system' ? (systemDark.matches ? 'dark' : 'light') : field.value;
    syncURL();
    render();
    return;
  }
  if (field.name === 'accessory') {
    local.accessory = field.value;
    render();
    if (dialog.open) avatarDrawer();
    return;
  }
  if (field.dataset.setting === 'reduced') {
    query.reduced = field.checked;
    syncURL();
    render();
    return;
  }
  if (field.dataset.setting === 'volume' || field.id === 'cue-volume') {
    local.volume = Number(field.value);
  }
});
dialog.addEventListener('close', () => {
  restoreFocus(returnFocus);
  returnFocus = null;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && dialog.open) {
    const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(node => node.getBoundingClientRect().width > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === 'Enter' && event.target.id === 'room-code') {
    event.preventDefault();
    document.querySelector('#pen-name')?.focus();
  }
  if (event.key === 'Escape' && dialog.open) dialog.close();
});
systemMotion.addEventListener('change', () => { render(); });
systemDark.addEventListener('change', () => { if (local.modePreference === 'system') render(); });
syncURL();
render();
