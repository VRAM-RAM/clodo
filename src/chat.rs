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

/// Longueur minimale du cache réutilisable : en deçà, refaire un préremplissage
/// complet (en un lot, efficace) est au moins aussi rapide.
const REUSE_MIN_PREFIX: usize = 32;

/// Reprise du cache uniquement si le préfixe déjà en cache est au moins
/// `REUSE_COST_RATIO` fois plus long que le suffixe à recalculer.
///
/// La reprise se fait **token par token** (seul mode correct pour la convolution
/// courte, voir plus bas). En WASM le coût est dominé par les matmul quantifiés :
/// un token seul coûte à peu près autant qu'un token traité dans un lot (~280 ms)
/// — et bien moins qu'un préremplissage complet du même prompt (mesuré : 6,4 s
/// en reprise contre 100 s en recalcul sur ~360 tokens, ×15). Reprendre est donc
/// quasi toujours gagnant ; ce seuil ne sert qu'à éviter le cas pathologique
/// d'un tout petit cache suivi d'un énorme suffixe.
const REUSE_COST_RATIO: usize = 2;

/// Plus long préfixe commun (en tokens) entre deux séquences.
fn common_prefix_len(a: &[u32], b: &[u32]) -> usize {
    a.iter().zip(b).take_while(|(x, y)| x == y).count()
}

/// Décide si le cache du modèle (dont `cached` est la copie) est réutilisable.
///
/// Renvoie la longueur du préfixe à reprendre (0 = préremplissage complet).
/// On exige que **tout** le cache soit un préfixe du nouveau prompt, et que la
/// reprise soit clairement rentable (`cached.len() >= REUSE_COST_RATIO * suffix`).
fn reuse_prefix_len(cached: &[u32], prompt: &[u32]) -> usize {
    let common = common_prefix_len(cached, prompt);
    let suffix = prompt.len().saturating_sub(common);
    if common == cached.len()
        && common >= REUSE_MIN_PREFIX
        && cached.len() >= REUSE_COST_RATIO * suffix
    {
        common
    } else {
        0
    }
}

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
    /// Longueur du préfixe du prompt déjà présent dans le cache au début du tour
    /// (0 = aucun cache réutilisé ⇒ préremplissage complet en un lot).
    reused: usize,
}

thread_local! {
    static ACTIVE: RefCell<Option<Active>> = const { RefCell::new(None) };
    /// Tapis de tokens réutilisé par `sample` (évite un `Vec::clone` par token).
    static HISTORY: RefCell<Vec<u32>> = const { RefCell::new(Vec::new()) };
    /// Copie ordonnée des tokens actuellement présents dans le cache du modèle
    /// (attention KV + convolution). C'est elle qui permet de ne recalculer que
    /// le suffixe nouveau à chaque tour. Toute reprise est refusée dès que le
    /// nouveau prompt ne prolonge plus exactement cette séquence.
    static CACHED: RefCell<Vec<u32>> = const { RefCell::new(Vec::new()) };
}

/// Invalide l'état de cache logique.
///
/// À appeler quand le cache du modèle est réinitialisé **hors** de
/// [`generate_next`] (ex. un préremplissage complet via
/// [`crate::model::generate_chat`]) : la copie [`CACHED`] ne décrit alors plus
/// ce que contient réellement le modèle.
pub(crate) fn reset_cache_state() {
    CACHED.with(|cached| cached.borrow_mut().clear());
    ACTIVE.with(|slot| *slot.borrow_mut() = None);
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

    // Reprend le cache du tour précédent si le nouveau prompt le prolonge.
    let reused = CACHED.with(|cached| reuse_prefix_len(&cached.borrow(), &prompt));
    let prompt_len = prompt.len();

    let mut tokens = Vec::new();
    if reused > 0 {
        tokens.extend_from_slice(&prompt[..reused]);
    }

    ACTIVE.with(|slot| {
        *slot.borrow_mut() = Some(Active {
            tokens,
            gen_ids: Vec::new(),
            pending: 0,
            generated: 0,
            max_tokens,
            text: String::new(),
            prompt,
            reused,
        });
    });

    let progress = if reused > 0 {
        reused as f64 / prompt_len as f64
    } else {
        0.0
    };
    step_json("", false, "prefill", progress)
}

/// Avance la génération d'un pas. **Sans persistance** (appelé depuis le Web
/// Worker).
///
/// Le premier passage préremplit le prompt (d'un seul lot, ou token par token
/// lorsqu'on reprend le cache d'un tour précédent), puis chaque appel produit un
/// token. Renvoie `{ "chunk", "done", "phase", "progress" }`. La phase vaut
/// `"prefill"` tant que le prompt n'est pas entièrement passé dans le cache,
/// puis `"generate"`, et enfin `"done"`.
pub fn generate_next() -> Result<String, ClodoError> {
    ACTIVE.with(|slot| {
        let mut active = match slot.borrow_mut().take() {
            Some(active) => active,
            None => return step_json("", true, "done", 1.0),
        };
        let params = generation_params(active.max_tokens);

        // 1. Préremplissage.
        if active.tokens.len() < active.prompt.len() {
            let logits;
            if active.reused > 0 {
                // Reprise du cache : **un token à la fois**. Le cache de la
                // convolution courte n'est correct qu'en pas-à-pas (candle
                // `ShortConvLayer` ignore le cache entrant quand `seq_len > 1`).
                let pos = active.tokens.len();
                let token = active.prompt[pos];
                logits =
                    crate::model::with_session_mut(|session| session.forward(&[token], pos))?;
                active.tokens.push(token);
                CACHED.with(|cached| cached.borrow_mut().push(token));

                if active.tokens.len() < active.prompt.len() {
                    let progress = active.tokens.len() as f64 / active.prompt.len() as f64;
                    *slot.borrow_mut() = Some(active);
                    return step_json("", false, "prefill", progress);
                }
            } else {
                // Préremplissage complet **en un seul lot** : `index_pos = 0`
                // réinitialise le cache. Découper en lots serait erroné pour la
                // convolution (cf. ci-dessus).
                logits =
                    crate::model::with_session_mut(|session| session.forward(&active.prompt, 0))?;
                active.tokens.clear();
                active.tokens.extend_from_slice(&active.prompt);
                CACHED.with(|cached| {
                    let mut cached = cached.borrow_mut();
                    cached.clear();
                    cached.extend_from_slice(&active.prompt);
                });
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
        let logits =
            crate::model::with_session_mut(|session| session.forward(&[active.pending], pos))?;
        let sampled = HISTORY.with(|history| {
            let mut history = history.borrow_mut();
            history.clear();
            history.extend_from_slice(&active.tokens);
            history.push(active.pending);
            crate::model::sample(&logits, &history, &params)
        });
        let (chunk, done) = crate::model::with_session_mut(|session| {
            let done = session.is_eos(sampled);
            let chunk = if done {
                String::new()
            } else {
                emit_delta(session, &mut active, sampled)
            };
            Ok((chunk, done))
        })?;

        CACHED.with(|cached| cached.borrow_mut().push(active.pending));
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

    #[test]
    fn common_prefix_len_works() {
        assert_eq!(common_prefix_len(&[], &[1, 2]), 0);
        assert_eq!(common_prefix_len(&[1, 2, 3], &[1, 2, 9]), 2);
        assert_eq!(common_prefix_len(&[1, 2], &[1, 2, 3]), 2);
        assert_eq!(common_prefix_len(&[7], &[7]), 1);
    }

    #[test]
    fn reuse_prefix_len_rules() {
        // Cache vide ou non préfixe ⇒ aucune reprise.
        assert_eq!(reuse_prefix_len(&[], &[1, 2, 3]), 0);
        assert_eq!(reuse_prefix_len(&[1, 9, 3], &[1, 2, 3]), 0);

        // Préfixe plus court que REUSE_MIN_PREFIX ⇒ préremplissage complet.
        let short: Vec<u32> = (0..16).collect();
        let extended = |n: u32| (0..n).collect::<Vec<u32>>();
        assert_eq!(reuse_prefix_len(&short, &extended(30)), 0);

        // Préfixe long et suffixe court ⇒ reprise de tout le cache.
        let long = extended(500);
        assert_eq!(reuse_prefix_len(&long, &extended(510)), 500);
        assert_eq!(reuse_prefix_len(&long, &long), 500);

        // Suffixe trop long (préfixe < REUSE_COST_RATIO × suffixe) ⇒ complet.
        assert_eq!(reuse_prefix_len(&long, &extended(900)), 0);
    }

    #[test]
    #[ignore = "nécessite le GGUF Luth-LFM2-350M (~229 Mo)"]
    fn reuse_matches_full_prefill() {
        let path = std::env::var("LUTH_GGUF").unwrap_or_else(|_| {
            "/var/folders/f8/pmys308n6qs2h1692q7b92s80000gr/T/opencode/luth/model-q4.gguf"
                .to_string()
        });
        let data = std::fs::read(&path).unwrap();
        crate::model::load(&data).unwrap();

        let tokens1 =
            crate::model::with_session_mut(|s| s.encode_chat(&[Message::user("Bonjour, qui es-tu ?")]))
                .unwrap();
        let tokens2 = crate::model::with_session_mut(|s| {
            s.encode_chat(&[
                Message::user("Bonjour, qui es-tu ?"),
                Message::assistant("Je suis Clodo, un assistant utile."),
                Message::user("Explique-moi la photosynthèse simplement."),
            ])
        })
        .unwrap();
        let prefix = common_prefix_len(&tokens1, &tokens2);
        assert_eq!(prefix, tokens1.len(), "tokens1 doit être un préfixe de tokens2");
        println!("prefix={prefix} total={}", tokens2.len());

        // Référence : préremplissage complet d'un seul lot.
        let reference = crate::model::with_session_mut(|s| s.forward(&tokens2, 0)).unwrap();

        // Reprise : préremplissage complet du préfixe, puis suffixe token à token.
        let _ = crate::model::with_session_mut(|s| s.forward(&tokens1, 0)).unwrap();
        let mut reused = Vec::new();
        for (i, &token) in tokens2[prefix..].iter().enumerate() {
            let pos = prefix + i;
            reused = crate::model::with_session_mut(|s| s.forward(&[token], pos)).unwrap();
        }

        // Baseline : le même prompt, mais **entièrement** en pas-à-pas (sans lot).
        let mut single_full = Vec::new();
        for (i, &token) in tokens2.iter().enumerate() {
            single_full = crate::model::with_session_mut(|s| s.forward(&[token], i)).unwrap();
        }

        let diff = |a: &[f32], b: &[f32]| {
            a.iter().zip(b).map(|(x, y)| (x - y).abs()).fold(0f32, f32::max)
        };
        let argmax = |v: &[f32]| {
            v.iter()
                .enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
                .map(|(i, _)| i)
                .unwrap()
        };
        println!(
            "max|Δ| lot-vs-pas-à-pas={:.5} | reprise-vs-lot={:.5} | argmax lot={} reprise={} pas-à-pas={}",
            diff(&reference, &single_full),
            diff(&reference, &reused),
            argmax(&reference),
            argmax(&reused),
            argmax(&single_full),
        );
        assert_eq!(argmax(&reference), argmax(&reused), "argmax divergent");
    }
}

/// Supprime une conversation.
pub fn delete(id: &str) -> Result<(), ClodoError> {
    remove_conversation(id)
}
