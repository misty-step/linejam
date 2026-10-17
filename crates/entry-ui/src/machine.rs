#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Modal,
    Embedded,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Detached,
    Open(Mode),
    Closing(Mode),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Event {
    Mounted(Mode),
    Close,
    Tab {
        shift: bool,
        at_first: bool,
        at_last: bool,
    },
    Unmounted,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Effect {
    LockScrollAndFocus,
    RestoreScrollAndFocus,
    NotifyClosed,
    FocusFirst,
    FocusLast,
}

pub fn step(state: State, event: Event) -> (State, Vec<Effect>) {
    use Effect::*;
    use Event::*;
    use State::*;
    match (state, event) {
        (Detached, Mounted(mode)) => (
            Open(mode),
            if mode == Mode::Modal {
                vec![LockScrollAndFocus]
            } else {
                vec![]
            },
        ),
        (Open(mode), Close) => (Closing(mode), vec![NotifyClosed]),
        (Open(Mode::Modal) | Closing(Mode::Modal), Unmounted) => {
            (Detached, vec![RestoreScrollAndFocus])
        }
        (Open(Mode::Embedded) | Closing(Mode::Embedded), Unmounted) => (Detached, vec![]),
        (
            Open(Mode::Modal),
            Tab {
                shift: true,
                at_first: true,
                ..
            },
        ) => (state, vec![FocusLast]),
        (
            Open(Mode::Modal),
            Tab {
                shift: false,
                at_last: true,
                ..
            },
        ) => (state, vec![FocusFirst]),
        _ => (state, vec![]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn transition_table() {
        use Effect::*;
        use State::*;
        for (before, event, after, effects) in [
            (
                Detached,
                Event::Mounted(Mode::Modal),
                Open(Mode::Modal),
                vec![LockScrollAndFocus],
            ),
            (
                Detached,
                Event::Mounted(Mode::Embedded),
                Open(Mode::Embedded),
                vec![],
            ),
            (Detached, Event::Close, Detached, vec![]),
            (Detached, Event::Unmounted, Detached, vec![]),
            (
                Open(Mode::Modal),
                Event::Close,
                Closing(Mode::Modal),
                vec![NotifyClosed],
            ),
            (
                Open(Mode::Embedded),
                Event::Close,
                Closing(Mode::Embedded),
                vec![NotifyClosed],
            ),
            (
                Closing(Mode::Modal),
                Event::Close,
                Closing(Mode::Modal),
                vec![],
            ),
            (
                Open(Mode::Modal),
                Event::Unmounted,
                Detached,
                vec![RestoreScrollAndFocus],
            ),
            (
                Closing(Mode::Modal),
                Event::Unmounted,
                Detached,
                vec![RestoreScrollAndFocus],
            ),
            (Open(Mode::Embedded), Event::Unmounted, Detached, vec![]),
            (Closing(Mode::Embedded), Event::Unmounted, Detached, vec![]),
            (
                Open(Mode::Modal),
                Event::Mounted(Mode::Embedded),
                Open(Mode::Modal),
                vec![],
            ),
            (
                Open(Mode::Modal),
                Event::Tab {
                    shift: true,
                    at_first: true,
                    at_last: false,
                },
                Open(Mode::Modal),
                vec![FocusLast],
            ),
            (
                Open(Mode::Modal),
                Event::Tab {
                    shift: false,
                    at_first: false,
                    at_last: true,
                },
                Open(Mode::Modal),
                vec![FocusFirst],
            ),
            (
                Open(Mode::Modal),
                Event::Tab {
                    shift: false,
                    at_first: true,
                    at_last: false,
                },
                Open(Mode::Modal),
                vec![],
            ),
            (
                Open(Mode::Embedded),
                Event::Tab {
                    shift: true,
                    at_first: true,
                    at_last: true,
                },
                Open(Mode::Embedded),
                vec![],
            ),
        ] {
            assert_eq!(
                step(before, event),
                (after, effects),
                "{before:?} {event:?}"
            );
        }
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(512))]
        #[test]
        fn arbitrary_lifecycles_balance_scroll_and_notify_once(events in prop::collection::vec(0u8..8, 0..300)) {
            let mut state = State::Detached;
            let mut locked = false;
            let mut notified = false;
            for input in events.into_iter().chain([2]) {
                let event = match input {
                    0 => Event::Mounted(Mode::Modal),
                    1 => Event::Mounted(Mode::Embedded),
                    2 => Event::Unmounted,
                    3 => Event::Close,
                    value => Event::Tab { shift: value & 1 == 1, at_first: value & 2 != 0, at_last: value & 4 != 0 },
                };
                let (next, effects) = step(state, event);
                for effect in effects {
                    match effect {
                        Effect::LockScrollAndFocus => { prop_assert!(!locked); locked = true; }
                        Effect::RestoreScrollAndFocus => { prop_assert!(locked); locked = false; }
                        Effect::NotifyClosed => { prop_assert!(!notified); notified = true; }
                        Effect::FocusFirst | Effect::FocusLast => prop_assert_eq!(state, State::Open(Mode::Modal)),
                    }
                }
                if next == State::Detached { notified = false; }
                prop_assert_eq!(locked, matches!(next, State::Open(Mode::Modal) | State::Closing(Mode::Modal)));
                state = next;
            }
            prop_assert_eq!(state, State::Detached);
            prop_assert!(!locked);
        }
    }
}
