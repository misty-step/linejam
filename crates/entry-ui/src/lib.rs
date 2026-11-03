#![cfg(any(target_arch = "wasm32", test))]

mod admission;
mod machine;

#[cfg(target_arch = "wasm32")]
mod browser;
#[cfg(target_arch = "wasm32")]
mod join;
#[cfg(target_arch = "wasm32")]
mod picker;
