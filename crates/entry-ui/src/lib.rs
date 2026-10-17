#![cfg(any(target_arch = "wasm32", test))]

mod machine;

#[cfg(target_arch = "wasm32")]
mod browser;
