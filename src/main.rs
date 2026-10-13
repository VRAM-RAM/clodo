//! Native shell so `cargo run` stays useful while you develop the backend.
//! The real target is WASM (see lib.rs); this just compiles and prints.

pub mod errors;
pub mod chat;
pub mod model;

fn main() {
    println!("Clodo — native shell. Build the WASM target with:");
    println!("    wasm-pack build --target web --out-dir pkg");
}