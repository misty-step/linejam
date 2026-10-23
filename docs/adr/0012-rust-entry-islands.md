# ADR 0012: Replace entry views with Rust CSR islands

Status: home/help live; join/picker candidate

The accepted Durable Object backend and its data remain unchanged. Following
ADR 0011, the first Rust UI slice replaces home rendering and the shared help
view inside the existing Next/OpenNext shell. Host, room, identity,
analytics, sound, color mode and account boundaries stay on their current paths
until their own replacement slices are proven.

The second slice replaces the join form and the shared avatar picker. One pure
Rust admission reducer owns editing, pending, rejection, acceptance and session
readiness. It refuses duplicate submission and stale completions while keeping
entered details and the once-per-mount random avatar through retry. The existing
UserProvider, mutation client, friendly errors, sound, analytics and navigation
remain at a narrow adapter; credentials never enter DOM attributes or WASM.
The same Rust picker serves join and host. Native HTML dialog owns modal
inertness and Escape. It reuses help's pure Tab-endpoint transitions because
native dialog alone can move keyboard focus into browser chrome at either end.
The canonical TypeScript cast/renderer generates its compile-time data and SVG;
there is no second artwork source. Real browser checks replace the deleted
React-form/picker fixture tests, alongside pure reducer and boundary tests.

Copy Overmind's `crates/home-ui` pattern: Leptos 0.8.19 CSR, wasm-bindgen
0.2.129, a locked Cargo workspace, stripped UI profile, and a thin React
mount/dispose adapter. Use Leptos's native `mount_to`/`UnmountHandle`; no new
server, RPC protocol, router or UI platform. CSP permits WebAssembly compilation
without enabling JavaScript eval in production. Tailwind scans the Rust views.

Home is a static view with ordinary links, not a new navigation state machine.
Its avatar strip is generated at build time by the existing Avatar renderer,
so it preserves the canonical cast, optical size and theme-aware inline SVG
without another editable artwork source. No user input enters this markup.

Help has explicit State and Event enums and one pure step function returning
effect data. The browser edge owns focus, scroll, DOM listeners and the existing
close callback. Disposal restores the opener and scroll even if the React shell
unmounts without a close action. The embedded room help uses the same Rust
content without taking over its containing dialog's focus/scroll lifecycle.
Direct transition cases and randomized event sequences check lifecycle invariants;
real browser checks, not a mocked WASM module, own rendering/accessibility proof.
There is no history-derived state or new event log in these read-only views.

The adapter exposes a visible retry if the WASM module cannot load, cancels stale
mounts, and disposes exactly once. Existing sound delegation and analytics remain
at the shell boundary. Product copy, CSS tokens, routes and account behavior do
not change. Replaced React rendering and help lifecycle code are deleted in the
same candidate; its obsolete happy-dom help tests move to real browser checks.

Native verification still builds an isolated local-mode Worker. It is not a
production deployment artifact. The native train must separately verify and
promote a production-configured artifact without repeating the data cutover;
until that exists, do not retire the current release safety checks or promote
an isolated local-mode build.

References:

- Overmind rewrite `t_c4ff31b2`, `crates/home-ui` and native mount/dispose host.
- https://docs.rs/leptos/0.8.19/leptos/mount/fn.mount_to.html
- https://book.leptos.dev/getting_started/index.html
