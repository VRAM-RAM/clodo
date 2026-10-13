//! Backend chat : logique des conversations (à implémenter).
//!
//! Chaque fonction **publique** de ce module est appelée depuis la couche de
//! bindings WASM (`crate::lib`) et renvoie des chaînes JSON.
//!
//! # Stockage
//!
//! Les conversations ne sont **pas** stockées dans un unique blob : chaque
//! conversation a sa propre clé `localStorage` (`clodo.chat.v1.<id>`), et un
//! index à part (`clodo.index.v1`) ne garde que les métadonnées
//! `{ id, title, updated }` (sans les messages).
//!
//! Ainsi, renommer une conversation ou lister la barre latérale ne lit jamais
//! les messages des autres conversations : seul le petit index (et, au besoin,
//! la conversation concernée) est touché. [`rebuild_index`] permet de
//! reconstruire l'index à partir des clés présentes s'il s'est désynchronisé.

use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use crate::chat::message::Message;
pub mod message;

use crate::errors::ClodoError;

/// Préfixe des clés `localStorage` d'une conversation.
pub const CONVERSATION_KEY_PREFIX: &str = "clodo.chat.v1.";

/// Clé `localStorage` de l'index des métadonnées.
pub const INDEX_KEY: &str = "clodo.index.v1";

/// Clé `localStorage` d'une conversation donnée.
fn conversation_key(id: &str) -> String {
    format!("{CONVERSATION_KEY_PREFIX}{id}")
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<Message>,
    #[serde(default)]
    pub updated: u64,
}

/// Métadonnées d'une conversation (sans les messages) — contenu de l'index et
/// payload renvoyé par [`list`].
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConvMeta {
    pub id: String,
    pub title: String,
    pub updated: u64,
}

impl Conversation {
    fn meta(&self) -> ConvMeta {
        ConvMeta {
            id: self.id.clone(),
            title: self.title.clone(),
            updated: self.updated,
        }
    }
}

/// Horodatage courant en millisecondes (`Date.now()`).
fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

/// Identifiant de conversation unique (temps + aléatoire, en hexadécimal).
fn new_id() -> String {
    let time = now_ms();
    let rand = (js_sys::Math::random() * 1_000_000_000.0) as u64;
    format!("{time:x}-{rand:x}")
}

/// Accès centralisé au `localStorage`.
fn storage() -> Result<web_sys::Storage, ClodoError> {
    web_sys::window()
        .ok_or(ClodoError::StorageError)?
        .local_storage()?
        .ok_or(ClodoError::StorageError)
}

/// Lit l'index des métadonnées (vide si la clé est absente).
pub fn load_index() -> Result<Vec<ConvMeta>, ClodoError> {
    match storage()?.get(INDEX_KEY)? {
        Some(string) => Ok(serde_json::from_str(&string)?),
        None => Ok(Vec::new()),
    }
}

/// Écrit l'index des métadonnées.
pub fn save_index(index: &[ConvMeta]) -> Result<(), ClodoError> {
    storage()?.set(INDEX_KEY, &serde_json::to_string(index)?)?;
    Ok(())
}

/// Lit une conversation (erreur si introuvable).
pub fn load_conversation(id: &str) -> Result<Conversation, ClodoError> {
    match storage()?.get(&conversation_key(id))? {
        Some(string) => Ok(serde_json::from_str(&string)?),
        None => Err(ClodoError::ConversationNotFound),
    }
}

/// Écrit une conversation et met à jour sa ligne dans l'index.
pub fn save_conversation(conversation: &Conversation) -> Result<(), ClodoError> {
    storage()?.set(
        &conversation_key(&conversation.id),
        &serde_json::to_string(conversation)?,
    )?;

    let meta = conversation.meta();
    let mut index = load_index()?;
    match index.iter_mut().find(|entry| entry.id == meta.id) {
        Some(entry) => *entry = meta,
        None => index.push(meta),
    }
    save_index(&index)
}

/// Supprime une conversation et sa ligne d'index.
pub fn remove_conversation(id: &str) -> Result<(), ClodoError> {
    storage()?.remove_item(&conversation_key(id))?;

    let mut index = load_index()?;
    index.retain(|entry| entry.id != id);
    save_index(&index)
}

/// Reconstruit l'index à partir des clés de conversations présentes.
pub fn rebuild_index() -> Result<Vec<ConvMeta>, ClodoError> {
    let storage = storage()?;
    let mut index = Vec::new();

    for position in 0..storage.length()? {
        if let Some(key) = storage.key(position)? {
            if key.starts_with(CONVERSATION_KEY_PREFIX) {
                if let Some(string) = storage.get(&key)? {
                    if let Ok(conversation) = serde_json::from_str::<Conversation>(&string) {
                        index.push(conversation.meta());
                    }
                }
            }
        }
    }

    save_index(&index)?;
    Ok(index)
}

/// Liste triée — renvoie un tableau JSON de `{ "id", "title", "updated" }`
/// (le plus récent d'abord). Ne lit **pas** les messages.
pub fn list() -> Result<String, ClodoError> {
    let mut index = load_index()?;
    index.sort_by_key(|entry| std::cmp::Reverse(entry.updated));
    Ok(serde_json::to_string(&index)?)
}

/// Crée une conversation vide et la persiste — renvoie son JSON
/// `{ "id", "title": "New chat", "messages": [], "updated" }`.
pub fn create() -> Result<String, ClodoError> {
    let conversation = Conversation {
        id: new_id(),
        title: "New chat".to_string(),
        messages: Vec::new(),
        updated: now_ms(),
    };

    save_conversation(&conversation)?;

    Ok(serde_json::to_string(&conversation)?)
}

/// Renvoie le JSON complet d'une conversation, erreur si introuvable.
pub fn get_json(id: &str) -> Result<String, ClodoError> {
    Ok(serde_json::to_string(&load_conversation(id)?)?)
}

/// Renvoie la conversation désérialisée, erreur si introuvable.
pub fn get(id: &str) -> Result<Conversation, ClodoError> {
    load_conversation(id)
}

/// Borne supérieure de la longueur de réponse réglable côté client.
const MAX_NEW_TOKENS_CAP: usize = 1024;

/// Ramène la longueur de réponse demandée par le client dans les bornes
/// acceptées (`1..=MAX_NEW_TOKENS_CAP`).
fn clamp_max_tokens(max_new_tokens: usize) -> usize {
    max_new_tokens.clamp(1, MAX_NEW_TOKENS_CAP)
}

/// Longueur de contexte maximale utilisée (borne le cache et la latence).
const MAX_CONTEXT: usize = 2048;

/// Nombre de tokens de prompt traités par appel pendant le préremplissage.
///
/// Le calcul du modèle est **synchrone** (WebAssembly) : on le découpe en petits
/// lots pour ne jamais monopoliser le thread appelant. Côté navigateur,
/// l'appelant est un Web Worker, donc l'interface n'est jamais bloquée.
const PREFILL_STEP: usize = 16;

/// Paramètres d'échantillonnage recommandés par la carte du modèle.
fn generation_params(max_new_tokens: usize) -> crate::model::GenerationParams {
    crate::model::GenerationParams {
        max_new_tokens,
        ..crate::model::GenerationParams::default()
    }
}

/// Génération en cours (une seule à la fois).
struct Active {
    /// Tokens déjà passés dans le cache (prompt prérempli, puis générés).
    tokens: Vec<u32>,
    /// Ids des tokens **générés** (hors prompt), pour un décodage sûr.
    gen_ids: Vec<u32>,
    /// Dernier token échantillonné, pas encore passé dans le modèle.
    pending: u32,
    /// Nombre de tokens générés pour ce tour.
    generated: usize,
    /// Longueur de réponse maximale pour ce tour (tokens).
    max_tokens: usize,
    /// Texte déjà émis (préfixe stable du flux généré décodé).
    text: String,
    /// Prompt complet à préremplir (ChatML tokenisé).
    prompt: Vec<u32>,
    /// Nombre de tokens du prompt déjà préremplis.
    prefill_pos: usize,
}

/// Ajoute `sampled` au flux généré et renvoie le texte à émettre.
///
/// Le tokenizer étant *byte-level*, un caractère multi-octets peut être réparti
/// sur plusieurs tokens : on décode donc **toute** la séquence générée et on
/// n'émet que le suffixe stable (le caractère incomplet éventuel en fin de flux
/// est retenu jusqu'au token suivant).
fn emit_delta(session: &crate::model::Session, active: &mut Active, sampled: u32) -> String {
    active.gen_ids.push(sampled);
    let full = session.decode_ids(&active.gen_ids);
    let stable = full.trim_end_matches('\u{FFFD}');
    let chunk = stable
        .strip_prefix(active.text.as_str())
        .unwrap_or("")
        .to_string();
    active.text = stable.to_string();
    chunk
}

thread_local! {
    static ACTIVE: RefCell<Option<Active>> = const { RefCell::new(None) };
}

/// Réponse JSON d'un pas :
/// `{ "chunk": "...", "done": bool, "phase": "prefill|generate|done", "progress": f64 }`.
fn step_json(chunk: &str, done: bool, phase: &str, progress: f64) -> Result<String, ClodoError> {
    Ok(serde_json::to_string(&serde_json::json!({
        "chunk": chunk,
        "done": done,
        "phase": phase,
        "progress": progress,
    }))?)
}

/// Ajoute un message (`"user"`/`"assistant"`) à une conversation et la persiste.
///
/// Le titre est dérivé du premier message utilisateur. Une réponse assistant
/// vide est remplacée par un texte de repli. Renvoie le JSON de la conversation.
pub fn append_message(id: &str, role: &str, content: &str) -> Result<String, ClodoError> {
    let mut conversation = load_conversation(id)?;
    match role {
        "assistant" => {
            let text = if content.trim().is_empty() {
                "(le modèle n'a rien généré)".to_string()
            } else {
                content.to_string()
            };
            conversation.messages.push(Message::assistant(text));
        }
        _ => {
            if conversation.title == "New chat" {
                conversation.title = content.chars().take(40).collect();
            }
            conversation.messages.push(Message::user(content));
        }
    }
    conversation.updated = now_ms();
    save_conversation(&conversation)?;
    Ok(serde_json::to_string(&conversation)?)
}

/// Prépare une génération à partir d'une liste de messages (JSON ChatML).
///
/// **Sans persistance** (appelé depuis le Web Worker) : ne fait que tokeniser
/// le prompt et mémoriser l'état. Renvoie immédiatement
/// `{ "chunk": "", "done": false, "phase": "prefill" }` ; l'appelant enchaîne
/// [`generate_next`] jusqu'à `done`.
pub fn generate_start(messages_json: &str, max_new_tokens: usize) -> Result<String, ClodoError> {
    let messages: Vec<Message> = serde_json::from_str(messages_json)?;
    let max_tokens = clamp_max_tokens(max_new_tokens);

    let prompt = crate::model::with_session_mut(|session| {
        let tokens = session.encode_chat(&messages)?;
        if tokens.is_empty() {
            return Err(ClodoError::EmptyPrompt);
        }
        Ok(tokens)
    })?;

    // Borne le contexte (garde les tokens les plus récents).
    let prompt = if prompt.len() > MAX_CONTEXT {
        prompt[prompt.len() - MAX_CONTEXT..].to_vec()
    } else {
        prompt
    };

    ACTIVE.with(|slot| {
        *slot.borrow_mut() = Some(Active {
            tokens: Vec::new(),
            gen_ids: Vec::new(),
            pending: 0,
            generated: 0,
            max_tokens,
            text: String::new(),
            prompt,
            prefill_pos: 0,
        });
    });

    step_json("", false, "prefill", 0.0)
}

/// Avance la génération d'un pas : un petit lot de préremplissage, puis un
/// token à la fois. **Sans persistance** (appelé depuis le Web Worker).
///
/// Renvoie `{ "chunk", "done", "phase", "progress" }`. La phase vaut
/// `"prefill"` tant que le prompt n'est pas entièrement passé dans le cache,
/// puis `"generate"`, et enfin `"done"`.
pub fn generate_next() -> Result<String, ClodoError> {
    ACTIVE.with(|slot| {
        let mut active = match slot.borrow_mut().take() {
            Some(active) => active,
            None => return step_json("", true, "done", 1.0),
        };
        let params = generation_params(active.max_tokens);

        // 1. Préremplissage du prompt, par lots (gardé court et réactif).
        if active.prefill_pos < active.prompt.len() {
            let end = (active.prefill_pos + PREFILL_STEP).min(active.prompt.len());
            let logits = crate::model::with_session_mut(|session| {
                session.forward(&active.prompt[active.prefill_pos..end], active.prefill_pos)
            })?;
            active
                .tokens
                .extend_from_slice(&active.prompt[active.prefill_pos..end]);
            active.prefill_pos = end;

            if active.prefill_pos < active.prompt.len() {
                let progress = active.prefill_pos as f64 / active.prompt.len() as f64;
                *slot.borrow_mut() = Some(active);
                return step_json("", false, "prefill", progress);
            }

            // Prompt entièrement en cache : échantillonne le premier token.
            let sampled = crate::model::sample(&logits, &active.tokens, &params);
            let (chunk, done) = crate::model::with_session_mut(|session| {
                let done = session.is_eos(sampled);
                let chunk = if done {
                    String::new()
                } else {
                    emit_delta(session, &mut active, sampled)
                };
                Ok((chunk, done))
            })?;
            active.pending = sampled;
            active.generated = 1;

            if done {
                return step_json(&chunk, true, "done", 1.0);
            }
            *slot.borrow_mut() = Some(active);
            return step_json(&chunk, false, "generate", 0.0);
        }

        // 2. Génération : un token par appel.
        if active.generated >= active.max_tokens || active.tokens.len() + 1 >= MAX_CONTEXT {
            return step_json("", true, "done", 1.0);
        }

        let pos = active.tokens.len();
        let mut history = active.tokens.clone();
        history.push(active.pending);
        let logits =
            crate::model::with_session_mut(|session| session.forward(&[active.pending], pos))?;
        let sampled = crate::model::sample(&logits, &history, &params);
        let (chunk, done) = crate::model::with_session_mut(|session| {
            let done = session.is_eos(sampled);
            let chunk = if done {
                String::new()
            } else {
                emit_delta(session, &mut active, sampled)
            };
            Ok((chunk, done))
        })?;

        active.tokens.push(active.pending);
        active.pending = sampled;
        active.generated += 1;

        if done || active.generated >= active.max_tokens {
            step_json(&chunk, true, "done", 1.0)
        } else {
            *slot.borrow_mut() = Some(active);
            step_json(&chunk, false, "generate", 0.0)
        }
    })
}

/// Renomme une conversation — ne touche que celle-ci et sa ligne d'index.
/// Renomme une conversation — ne touche que celle-ci et sa ligne d'index.
pub fn rename(id: &str, title: &str) -> Result<(), ClodoError> {
    let mut conversation = load_conversation(id)?;
    conversation.title = title.to_string();
    save_conversation(&conversation)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn max_tokens_is_clamped() {
        assert_eq!(clamp_max_tokens(0), 1);
        assert_eq!(clamp_max_tokens(1), 1);
        assert_eq!(clamp_max_tokens(256), 256);
        assert_eq!(clamp_max_tokens(1024), 1024);
        assert_eq!(clamp_max_tokens(100_000), MAX_NEW_TOKENS_CAP);
    }
}

/// Supprime une conversation.
pub fn delete(id: &str) -> Result<(), ClodoError> {
    remove_conversation(id)
}
