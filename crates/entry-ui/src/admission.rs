#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Phase {
    Editing,
    Submitting(u64),
    Rejected(String),
    Accepted,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Form {
    pub code: String,
    pub name: String,
    pub avatar: usize,
    pub ready: bool,
    pub phase: Phase,
    sequence: u64,
}

#[derive(Clone, Debug)]
pub enum Event {
    Session(bool),
    Code(String),
    Name(String),
    Avatar(usize),
    Submit,
    Settled(u64, String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Request {
    pub id: u64,
    pub code: String,
    pub name: String,
    pub avatar: usize,
}

pub fn normalize_code(value: &str) -> String {
    value
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .take(4)
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

impl Form {
    pub fn new(code: &str, avatar: usize, ready: bool) -> Self {
        Self {
            code: normalize_code(code),
            name: String::new(),
            avatar,
            ready,
            phase: Phase::Editing,
            sequence: 0,
        }
    }

    pub fn busy(&self) -> bool {
        matches!(self.phase, Phase::Submitting(_) | Phase::Accepted)
    }

    pub fn can_submit(&self) -> bool {
        self.ready && !self.busy() && !self.code.is_empty() && !self.name.trim().is_empty()
    }

    pub fn send(&mut self, event: Event) -> Option<Request> {
        match event {
            Event::Session(ready) => {
                self.ready = ready;
                // A returning identity must verify before it can act again.
                // A reply from the previous session cannot accept the new form.
                if !ready && matches!(self.phase, Phase::Submitting(_)) {
                    self.phase = Phase::Editing;
                }
            }
            Event::Code(code) if !self.busy() => self.code = normalize_code(&code),
            Event::Name(name) if !self.busy() => self.name = name,
            Event::Avatar(avatar) if !self.busy() => self.avatar = avatar,
            Event::Submit if self.can_submit() => {
                self.sequence += 1;
                self.phase = Phase::Submitting(self.sequence);
                return Some(Request {
                    id: self.sequence,
                    code: self.code.clone(),
                    name: self.name.trim().to_owned(),
                    avatar: self.avatar,
                });
            }
            Event::Settled(id, feedback) if self.phase == Phase::Submitting(id) => {
                self.phase = if feedback.is_empty() {
                    Phase::Accepted
                } else {
                    Phase::Rejected(feedback)
                };
            }
            _ => {}
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn invitation_validation_pending_rejection_and_retry() {
        let mut form = Form::new(" a-1b cDextra", 7, false);
        assert_eq!(form.code, "A1BC");
        assert!(form.name.is_empty());
        form.send(Event::Name("   ".into()));
        form.send(Event::Session(true));
        assert!(form.send(Event::Submit).is_none());
        form.send(Event::Name("  Ada Lovelace  ".into()));
        let request = form.send(Event::Submit).unwrap();
        assert_eq!(request.name, "Ada Lovelace");
        assert_eq!(request.avatar, 7);
        assert!(form.send(Event::Submit).is_none());
        form.send(Event::Code("WXYZ".into()));
        form.send(Event::Avatar(0));
        assert_eq!(form.code, "A1BC");
        assert_eq!(form.avatar, 7);
        form.send(Event::Settled(request.id + 1, String::new()));
        assert!(form.busy());
        form.send(Event::Settled(request.id, "Room is full".into()));
        assert!(form.can_submit());
        assert_eq!(form.name, "  Ada Lovelace  ");
        assert_eq!(form.avatar, 7);
        form.send(Event::Code("w-xyz".into()));
        let retry = form.send(Event::Submit).unwrap();
        assert_eq!(retry.code, "WXYZ");
        assert_ne!(request.id, retry.id);
        form.send(Event::Settled(retry.id, String::new()));
        assert_eq!(form.phase, Phase::Accepted);
        assert!(!form.can_submit());
    }

    #[test]
    fn session_transition_ignores_old_completion_and_preserves_edits() {
        let mut form = Form::new("ABCD", 2, true);
        form.send(Event::Name("Ada".into()));
        let old = form.send(Event::Submit).unwrap();
        form.send(Event::Session(false));
        assert!(!form.can_submit());
        form.send(Event::Settled(old.id, String::new()));
        assert_eq!(form.phase, Phase::Editing);
        form.send(Event::Session(true));
        let next = form.send(Event::Submit).unwrap();
        assert_ne!(old.id, next.id);
        assert_eq!((form.name.as_str(), form.avatar), ("Ada", 2));
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(512))]
        #[test]
        fn normalized_codes_are_bounded_ascii_and_idempotent(value in ".*") {
            let code = normalize_code(&value);
            prop_assert!(code.len() <= 4);
            prop_assert!(code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
            prop_assert_eq!(normalize_code(&code), code);
        }

        #[test]
        fn no_duplicate_or_unverified_requests(events in prop::collection::vec(0u8..8, 0..300)) {
            let mut form = Form::new("ABCD", 0, true);
            form.send(Event::Name("Ada".into()));
            let mut last_id = 0;
            for input in events {
                let event = match input {
                    0 => Event::Session(false),
                    1 => Event::Session(true),
                    2 => Event::Code("w-xyz".into()),
                    3 => Event::Avatar(7),
                    4 => Event::Submit,
                    5 => Event::Settled(last_id, "Full".into()),
                    6 => Event::Settled(last_id, String::new()),
                    _ => Event::Settled(0, String::new()),
                };
                let allowed = form.can_submit();
                if let Some(request) = form.send(event) {
                    prop_assert!(allowed);
                    prop_assert!(request.id > last_id);
                    last_id = request.id;
                    prop_assert_eq!(&form.phase, &Phase::Submitting(request.id));
                }
            }
        }
    }
}
