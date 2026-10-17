use super::machine::{Effect as FocusEffect, Event, Mode, State, step};
use gloo_events::EventListener;
use leptos::prelude::*;
use wasm_bindgen::prelude::*;

// Generated from the one canonical cast and renderer, never editable artwork.
include!("../../../.ui-build/entry-avatars.rs");

pub fn avatar_index(value: &str) -> usize {
    AVATARS
        .iter()
        .position(|(id, _, _)| *id == value)
        .unwrap_or(0)
}

#[component]
pub fn Picker(
    value: Signal<usize>,
    disabled: Signal<bool>,
    on_change: Callback<usize>,
) -> impl IntoView {
    let dialog = NodeRef::<leptos::html::Dialog>::new();
    let trigger = NodeRef::<leptos::html::Button>::new();
    let first = NodeRef::<leptos::html::Button>::new();
    let choices: [NodeRef<leptos::html::Button>; AVATARS.len()] =
        std::array::from_fn(|_| NodeRef::new());
    let open = RwSignal::new(false);
    let overflow = StoredValue::new(String::new());
    let close = move || {
        if let Some(dialog) = dialog.get_untracked() {
            dialog.close();
        }
    };
    on_cleanup(move || {
        if open.get_untracked() {
            let _ = document()
                .body()
                .unwrap()
                .style()
                .set_property("overflow", &overflow.get_value());
            close();
        }
    });
    Effect::new(move |_| {
        // A session gate must not leave a top-layer dialog blocking recovery.
        if disabled.get() && open.get() {
            close();
        }
    });
    view! {
        <div class="shrink-0">
            <button node_ref=trigger type="button" disabled=move || disabled.get()
                aria-label=move || format!("Change avatar, {} selected", AVATARS[value.get()].1)
                aria-haspopup="dialog" aria-expanded=move || open.get().to_string()
                class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50"
                on:click=move |_| {
                    if disabled.get_untracked() { return; }
                    if let Some(dialog) = dialog.get_untracked() {
                        overflow.set_value(document().body().unwrap().style().get_property_value("overflow").unwrap_or_default());
                        if dialog.show_modal().is_ok() {
                            open.set(true);
                            let _ = document().body().unwrap().style().set_property("overflow", "hidden");
                            if let Some(selected) = choices[value.get_untracked()].get_untracked() {
                                let _ = selected.focus();
                            }
                        }
                    }
                }>
                <span aria-hidden="true" inner_html=move || AVATARS[value.get()].2></span>
                <span class="absolute -bottom-0.5 -right-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5" aria-hidden="true">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                </span>
            </button>
            // Native dialog owns inertness and Escape. Reuse help's endpoint
            // wrap: native Tab alone can move focus into browser chrome.
            <dialog node_ref=dialog aria-label="Choose your avatar"
                class="lj-game-frame lj-viewport-offset m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-[var(--color-text-primary)] backdrop:bg-black/25"
                on:keydown=move |event| {
                    if event.key() != "Tab" { return; }
                    let focused = document().active_element();
                    let last = if disabled.get_untracked() { first } else { choices[AVATARS.len() - 1] };
                    let (_, effects) = step(State::Open(Mode::Modal), Event::Tab {
                        shift: event.shift_key(),
                        at_first: first.get_untracked().is_some_and(|el| focused.as_ref() == Some(el.as_ref())),
                        at_last: last.get_untracked().is_some_and(|el| focused.as_ref() == Some(el.as_ref())),
                    });
                    let target = match effects.first() {
                        Some(FocusEffect::FocusFirst) => first.get_untracked(),
                        Some(FocusEffect::FocusLast) => last.get_untracked(),
                        _ => None,
                    };
                    if let Some(target) = target { event.prevent_default(); let _ = target.focus(); }
                }
                on:click=move |event| {
                    if event.target() == event.current_target() { close(); }
                }
                on:close=move |_| {
                    if open.try_update(|value| *value = false).is_some() {
                        let _ = document().body().unwrap().style().set_property("overflow", &overflow.get_value());
                        if let Some(trigger) = trigger.get_untracked() { let _ = trigger.focus(); }
                    }
                }>
                <div class="lj-safe-frame flex h-full items-end justify-center [--lj-safe-frame-space:0.75rem] sm:items-center" on:click=move |event| {
                    if event.target() == event.current_target() { close(); }
                }>
                    <div class="flex max-h-full w-full max-w-xs min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
                        <div class="flex shrink-0 items-center justify-between gap-2 pl-4 pr-2 pt-2">
                            <h2 class="text-base font-semibold">"Choose your avatar"</h2>
                            <button node_ref=first type="button" aria-label="Close avatar picker" on:click=move |_| close()
                                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
                                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div role="group" aria-label="Choose your avatar" class="grid min-h-0 grid-cols-[repeat(auto-fit,minmax(min(100%,3.5rem),1fr))] gap-2 overflow-y-auto overscroll-contain p-3">
                            {AVATARS.iter().enumerate().map(|(index, (_, name, art))| view! {
                                <button node_ref={choices[index]} type="button" disabled=move || disabled.get() aria-pressed=move || (value.get() == index).to_string()
                                    class=move || format!("flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 px-0.5 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 {}", if value.get() == index { "border-[var(--color-primary)] bg-[var(--color-muted)] text-[var(--color-text-primary)]" } else { "border-transparent" })
                                    on:click=move |_| { if !disabled.get_untracked() { on_change.run(index); close(); } }>
                                    <span aria-hidden="true" inner_html=*art></span>
                                    <span class="max-w-full break-words text-center text-xs font-semibold">{*name}</span>
                                </button>
                            }).collect_view()}
                        </div>
                    </div>
                </div>
            </dialog>
        </div>
    }
}

#[wasm_bindgen]
pub fn mount_avatar(parent: web_sys::HtmlElement, on_change: js_sys::Function) -> js_sys::Function {
    let host = parent.clone();
    let handle = leptos::mount::mount_to(parent, move || {
        let value = RwSignal::new(avatar_index(
            &host.get_attribute("value").unwrap_or_default(),
        ));
        let disabled = RwSignal::new(host.has_attribute("disabled"));
        let edge = host.clone();
        let listener = EventListener::new(&host, "entry-update", move |_| {
            value.set(avatar_index(
                &edge.get_attribute("value").unwrap_or_default(),
            ));
            disabled.set(edge.has_attribute("disabled"));
        });
        let listener = StoredValue::new_local(Some(listener));
        on_cleanup(move || {
            listener.update_value(|listener| {
                listener.take();
            })
        });
        view! { <Picker value=Signal::derive(move || value.get()) disabled=Signal::derive(move || disabled.get())
        on_change=Callback::new(move |index: usize| { let _ = on_change.call1(&JsValue::NULL, &JsValue::from_str(AVATARS[index].0)); })/> }
    });
    Closure::once_into_js(move || drop(handle)).unchecked_into()
}
