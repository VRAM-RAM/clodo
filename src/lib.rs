//! Clodo : frontend (HTML/CSS/JS) + cœur Rust (backend dans `chat`/`model`)
//! compilé en WebAssembly.
//!
//! Ce fichier est la **couche de bindings WASM** : chaque fonction `#[wasm_bindgen]`
//! ici est appelée par le frontend (`js/wasm.js`) et délègue à la logique backend
//! située dans les modules [`chat`] et [`model`]. C'est toi qui implémentes le
//! backend ; ici, tout est déjà câblé.
//!
//! # Conventions
//!
//! - Toutes les fonctions font surface `Result<T, JsValue>` ; l'erreur est
//!   convertie avec [`to_js`] (le message s'affiche dans l'UI).
//! - Le backend renvoie des chaînes JSON (voir le contrat dans `chat.rs` /
//!   `model.rs`).

pub mod chat;
pub mod errors;
pub mod model;

use wasm_bindgen::prelude::*;

/// Convertit une erreur backend (Implementing `Display`) en valeur JS à afficher.
fn to_js<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&format!("Clodo error: {err}"))
}

/// Liste triée des conversations — le backend renvoie un tableau JSON de
/// `[{ "id", "title", "updated" }]` (plus récent d'abord).
#[wasm_bindgen]
pub fn chat_list() -> Result<String, JsValue> {
    chat::list().map_err(to_js)
}

/// Crée une conversation vide et la persiste — backend renvoie le JSON de la
/// conversation `{ "id", "title", "messages": [], "updated" }`.
#[wasm_bindgen]
pub fn chat_new() -> Result<String, JsValue> {
    chat::create().map_err(to_js)
}

/// Renvoie le JSON complet d'une conversation.
#[wasm_bindgen]
pub fn chat_get(id: &str) -> Result<String, JsValue> {
    chat::get_json(id).map_err(to_js)
}

/// Ajoute un message (`"user"`/`"assistant"`) à une conversation et la
/// persiste (côté thread principal) ; renvoie la conversation mise à jour.
#[wasm_bindgen]
pub fn chat_append(id: &str, role: &str, content: &str) -> Result<String, JsValue> {
    chat::append_message(id, role, content).map_err(to_js)
}

/// Prépare une génération à partir d'une liste de messages JSON (appelé depuis
/// le Web Worker). `max_new_tokens` borne la réponse (borné côté Rust).
/// Renvoie `{ "chunk": "", "done": false, "phase": "prefill" }`.
#[wasm_bindgen]
pub fn generate_start(messages_json: &str, max_new_tokens: usize) -> Result<String, JsValue> {
    chat::generate_start(messages_json, max_new_tokens).map_err(to_js)
}

/// Avance la génération d'un pas (`{ "chunk", "done", "phase", "progress" }`).
#[wasm_bindgen]
pub fn generate_next() -> Result<String, JsValue> {
    chat::generate_next().map_err(to_js)
}

/// Renomme une conversation.
#[wasm_bindgen]
pub fn chat_rename(id: &str, title: &str) -> Result<(), JsValue> {
    chat::rename(id, title).map_err(to_js)
}

/// Supprime une conversation.
#[wasm_bindgen]
pub fn chat_delete(id: &str) -> Result<(), JsValue> {
    chat::delete(id).map_err(to_js)
}

/// Charge le modèle reçu depuis le navigateur (les octets d'un fichier GGUF
/// quantifié `Luth-LFM2-350M`). Délègue à [`model::load`].
#[wasm_bindgen]
pub fn model_load(data: &[u8]) -> Result<(), JsValue> {
    model::load(data).map_err(to_js)
}

/// Statut du modèle — backend renvoie un JSON `{ "loaded", "size", "tensors" }`.
#[wasm_bindgen]
pub fn model_status() -> Result<String, JsValue> {
    model::status().map_err(to_js)
}

/// Sonde de disponibilité affichée par l'UI pour confirmer que le WASM est chargé.
#[wasm_bindgen]
pub fn ping() -> String {
    "clodo wasm alive".to_string()
}