use super::machine::{Effect as HelpEffect, Event, Mode, State, step};
use gloo_events::{EventListener, EventListenerOptions};
use leptos::prelude::*;
use wasm_bindgen::prelude::*;

#[component]
fn Home() -> impl IntoView {
    view! {
        <section class="mx-auto w-full max-w-2xl px-6 py-8 sm:px-10 sm:py-14">
            <h1 class="max-w-[12ch] break-words text-[clamp(2.5rem,9vw,4rem)] font-display font-medium leading-[1.08] text-[var(--color-text-primary)]">
                "A little room for words."
            </h1>
            <p class="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
                "A poetry game for people who don’t have to be poets."
            </p>
            <p class="mt-3 text-base font-semibold text-[var(--color-text-primary)]">"Write a line. Pass it on."</p>
            <div class="mt-6 flex items-center gap-2" aria-hidden="true"
                inner_html=include_str!("../../../.ui-build/home-avatars.html")></div>
            <nav aria-label="Play Linejam" class="mt-7 flex max-w-md flex-col gap-3">
                <a href="/host" class="lj-button-primary inline-flex min-h-14 items-center justify-center rounded-[var(--radius-lg)] border px-6 py-3 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]">"Start a game"</a>
                <a href="/join" class="inline-flex min-h-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-lg font-bold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]">"Join a room"</a>
            </nav>
        </section>
    }
}

struct Boundary {
    opener: Option<web_sys::HtmlElement>,
    overflow: String,
    on_close: js_sys::Function,
    first: NodeRef<leptos::html::Button>,
    last: NodeRef<leptos::html::Button>,
    listener: Option<EventListener>,
}

fn send(
    state: RwSignal<State>,
    boundary: StoredValue<Boundary, LocalStorage>,
    event: Event,
) -> bool {
    let (next, effects) = step(state.get_untracked(), event);
    state.set(next);
    let handled = !effects.is_empty();
    for effect in effects {
        // DOM focus and closure can synchronously dispose this owner. Release
        // the stored-value borrow before invoking any browser effect.
        let (opener, overflow, on_close, first, last) = boundary.with_value(|edge| {
            (
                edge.opener.clone(),
                edge.overflow.clone(),
                edge.on_close.clone(),
                edge.first,
                edge.last,
            )
        });
        match effect {
            HelpEffect::LockScrollAndFocus => {
                let _ = document()
                    .body()
                    .unwrap()
                    .style()
                    .set_property("overflow", "hidden");
                if let Some(first) = first.get_untracked() {
                    let _ = first.focus();
                }
            }
            HelpEffect::RestoreScrollAndFocus => {
                let _ = document()
                    .body()
                    .unwrap()
                    .style()
                    .set_property("overflow", &overflow);
                if let Some(opener) = &opener
                    && opener.is_connected()
                {
                    let _ = opener.focus();
                }
            }
            HelpEffect::NotifyClosed => {
                let _ = on_close.call0(&JsValue::NULL);
            }
            HelpEffect::FocusFirst => {
                if let Some(first) = first.get_untracked() {
                    let _ = first.focus();
                }
            }
            HelpEffect::FocusLast => {
                if let Some(last) = last.get_untracked() {
                    let _ = last.focus();
                }
            }
        }
    }
    handled
}

#[component]
fn Help(mode: Mode, on_close: js_sys::Function) -> impl IntoView {
    let state = RwSignal::new(State::Detached);
    let first = NodeRef::<leptos::html::Button>::new();
    let last = NodeRef::<leptos::html::Button>::new();
    let boundary = StoredValue::new_local(Boundary {
        opener: document()
            .active_element()
            .and_then(|el| el.dyn_into().ok()),
        overflow: document()
            .body()
            .unwrap()
            .style()
            .get_property_value("overflow")
            .unwrap_or_default(),
        on_close,
        first,
        last,
        listener: None,
    });
    Effect::new(move |_| {
        send(state, boundary, Event::Mounted(mode));
        if mode == Mode::Modal {
            let listener = EventListener::new_with_options(
                &document(),
                "keydown",
                EventListenerOptions::enable_prevent_default(),
                move |event| {
                    let Some(key) = event.dyn_ref::<web_sys::KeyboardEvent>() else {
                        return;
                    };
                    let input = match key.key().as_str() {
                        "Escape" => Event::Close,
                        "Tab" => {
                            let focused = document().active_element();
                            Event::Tab {
                                shift: key.shift_key(),
                                at_first: first
                                    .get_untracked()
                                    .is_some_and(|el| focused.as_ref() == Some(el.as_ref())),
                                at_last: last
                                    .get_untracked()
                                    .is_some_and(|el| focused.as_ref() == Some(el.as_ref())),
                            }
                        }
                        _ => return,
                    };
                    if send(state, boundary, input) {
                        event.prevent_default();
                    }
                },
            );
            boundary.update_value(|edge| edge.listener = Some(listener));
        }
    });
    on_cleanup(move || {
        boundary.update_value(|edge| edge.listener = None);
        send(state, boundary, Event::Unmounted);
    });
    let close = move || {
        send(state, boundary, Event::Close);
    };
    let content = move || {
        view! {
            <div class="min-h-0 space-y-5 overflow-y-auto p-5">
                <ol class="space-y-4">
                    <li><h3 class="mb-1 font-sans text-base font-semibold">"Write a line"</h3><p class="text-sm text-text-secondary">"Use the word count for this round."</p></li>
                    <li><h3 class="mb-1 font-sans text-base font-semibold">"Pass it on"</h3><p class="text-sm text-text-secondary">"The next writer sees only your line."</p></li>
                    <li><h3 class="mb-1 font-sans text-base font-semibold">"Read together"</h3><p class="text-sm text-text-secondary">"After nine rounds, each player reads one complete poem aloud."</p></li>
                </ol>
                <p class="text-center text-sm font-semibold text-primary" aria-label="Words per round: 1, 2, 3, 4, 5, 4, 3, 2, 1">"1 · 2 · 3 · 4 · 5 · 4 · 3 · 2 · 1"</p>
                <button node_ref=last type="button" on:click=move |_| close() class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-transparent font-sans font-bold leading-snug transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lj-button-secondary px-5 py-2.5 text-base w-full">"Got it"</button>
            </div>
        }
    };
    if mode == Mode::Embedded {
        return content().into_any();
    }
    view! {
        <div class="lj-game-frame lj-viewport-offset fixed inset-x-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" on:click=move |_| close()>
            <div class="flex max-h-full w-full max-w-md min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
                role="dialog" aria-modal="true" aria-labelledby="help-title" on:click=|event| event.stop_propagation()>
                <div class="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
                    <h2 id="help-title" class="font-sans text-xl font-bold">"How to play"</h2>
                    <button node_ref=first type="button" on:click=move |_| close() class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" aria-label="Close help">
                        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                    </button>
                </div>
                {content()}
            </div>
        </div>
    }.into_any()
}

#[wasm_bindgen]
pub fn mount_entry(
    parent: web_sys::HtmlElement,
    kind: &str,
    on_close: js_sys::Function,
) -> js_sys::Function {
    let handle = match kind {
        "home" => leptos::mount::mount_to(parent, || view! { <Home/> }.into_any()),
        "help" | "help-content" => {
            let mode = if kind == "help" {
                Mode::Modal
            } else {
                Mode::Embedded
            };
            leptos::mount::mount_to(parent, move || view! { <Help mode on_close/> }.into_any())
        }
        _ => panic!("Unknown entry view"),
    };
    Closure::once_into_js(move || drop(handle)).unchecked_into()
}
