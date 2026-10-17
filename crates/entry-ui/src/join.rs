use super::admission::{Event, Form, Phase};
use super::picker::{AVATARS, Picker};
use gloo_events::EventListener;
use leptos::prelude::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{JsFuture, spawn_local};

#[component]
fn Join(parent: web_sys::HtmlElement, on_submit: js_sys::Function) -> impl IntoView {
    let initial_code = parent.get_attribute("code").unwrap_or_default();
    let invitation = !initial_code.is_empty();
    let form = RwSignal::new(Form::new(
        &initial_code,
        (js_sys::Math::random() * AVATARS.len() as f64).floor() as usize,
        parent.get_attribute("ready").as_deref() == Some("true"),
    ));
    let code = NodeRef::<leptos::html::Input>::new();
    let name = NodeRef::<leptos::html::Input>::new();
    let listener = EventListener::new(&parent.clone(), "entry-update", move |_| {
        form.update(|state| {
            state.send(Event::Session(
                parent.get_attribute("ready").as_deref() == Some("true"),
            ));
        });
    });
    let listener = StoredValue::new_local(Some(listener));
    on_cleanup(move || {
        listener.update_value(|listener| {
            listener.take();
        })
    });
    let previously_ready = StoredValue::new(false);
    Effect::new(move |_| {
        if let Some(input) = code.get() {
            let _ = input.set_attribute("autocorrect", "off");
        }
        let ready = form.with(|state| state.ready);
        let was_ready = previously_ready.get_value();
        previously_ready.set_value(ready);
        if ready
            && !was_ready
            && document()
                .active_element()
                .is_some_and(|active| active.tag_name() == "BODY")
            && let Some(input) = if invitation {
                name.get_untracked()
            } else {
                code.get_untracked()
            }
        {
            let _ = input.focus();
        }
    });
    let disabled = Signal::derive(move || form.with(|state| state.busy() || !state.ready));
    let on_submit = StoredValue::new_local(on_submit);
    view! {
        <h1 class="mb-4 text-3xl font-sans font-bold leading-tight text-[var(--color-text-primary)]">"Join room"</h1>
        <form aria-label="Join room" class="space-y-4" on:submit=move |event| {
            event.prevent_default();
            let mut request = None;
            form.update(|state| request = state.send(Event::Submit));
            let Some(request) = request else { return; };
            // Credentials never cross this UI boundary. The existing provider
            // and mutation client own admission and return only safe feedback.
            let result = on_submit.with_value(|submit| submit.call3(&JsValue::NULL,
                &JsValue::from_str(&request.code), &JsValue::from_str(&request.name), &JsValue::from_str(AVATARS[request.avatar].0)));
            spawn_local(async move {
                let result = match result {
                    Ok(value) => JsFuture::from(js_sys::Promise::resolve(&value)).await,
                    Err(error) => Err(error),
                };
                let feedback = result.ok().and_then(|value| value.as_string()).unwrap_or_else(||
                    "An unexpected error occurred. Please try again. If the problem persists, try refreshing the page.".into());
                // A detached view cannot be revived by a late response.
                form.try_update(|state| state.send(Event::Settled(request.id, feedback)));
            });
        }>
            <div class="space-y-1.5">
                <label for="code" class="block text-sm font-semibold text-[var(--color-text-primary)]">"Room code"</label>
                <input node_ref=code id="code" name="roomCode" data-testid="join-room-code-input" placeholder="ABCD"
                    prop:value=move || form.with(|state| state.code.clone()) on:input=move |event| {
                        let value = event_target_value(&event);
                        form.update(|state| { state.send(Event::Code(value)); });
                        // Even an input consisting only of separators must reset
                        // the DOM value when normalized state itself is unchanged.
                        event_target::<web_sys::HtmlInputElement>(&event).set_value(&form.with_untracked(|state| state.code.clone()));
                    }
                    maxlength="7" required inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="next"
                    disabled=move || disabled.get() on:keydown=move |event| {
                        if event.key() == "Enter" { event.prevent_default(); if let Some(name) = name.get_untracked() { let _ = name.focus(); } }
                    }
                    class="flex min-h-12 min-w-0 w-full max-w-full rounded-md border border-border bg-surface px-4 py-3 ring-offset-background placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 h-12 text-lg font-semibold uppercase tracking-[0.2em]"/>
            </div>
            <div class="space-y-1.5">
                <label for="name" class="block text-sm font-semibold text-[var(--color-text-primary)]">"Your pen name"</label>
                <div class="flex items-center gap-3">
                    <input node_ref=name id="name" name="displayName" data-testid="join-name-input" placeholder="e.g. Alex"
                        prop:value=move || form.with(|state| state.name.clone()) on:input=move |event| { form.update(|state| { state.send(Event::Name(event_target_value(&event))); }); }
                        required autocapitalize="words" autocomplete="nickname" enterkeyhint="go" disabled=move || disabled.get()
                        class="flex min-h-12 min-w-0 w-full max-w-full rounded-md border border-border bg-surface px-4 py-3 ring-offset-background placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 h-12 text-base"/>
                    <Picker value=Signal::derive(move || form.with(|state| state.avatar)) disabled
                        on_change=Callback::new(move |avatar| { form.update(|state| { state.send(Event::Avatar(avatar)); }); })/>
                </div>
            </div>
            <div class="space-y-4">
                {move || match form.with(|state| state.phase.clone()) {
                    Phase::Rejected(feedback) => Some(view! { <div role="alert" data-testid="join-error-alert" class="p-4 border text-sm rounded-sm border-error bg-error/5 text-error">{feedback}</div> }),
                    _ => None,
                }}
                <button type="submit" data-testid="join-room-button" data-sound="loading"
                    disabled=move || !form.with(Form::can_submit)
                    class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-transparent font-sans font-bold leading-snug transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lj-button-primary px-5 py-2.5 w-full text-base">
                    {move || if form.with(Form::busy) { "Joining room…" } else { "Join room" }}
                </button>
            </div>
        </form>
    }
}

#[wasm_bindgen]
pub fn mount_join(parent: web_sys::HtmlElement, on_submit: js_sys::Function) -> js_sys::Function {
    let host = parent.clone();
    let handle = leptos::mount::mount_to(parent, move || view! { <Join parent=host on_submit/> });
    Closure::once_into_js(move || drop(handle)).unchecked_into()
}
