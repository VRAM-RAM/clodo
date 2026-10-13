//! Test natif (ignoré par défaut) : charge le GGUF Luth-LFM2-350M et génère.
//!
//! ```sh
//! LUTH_DIR=/chemin/vers/gguf cargo test --test smoke -- --ignored --nocapture
//! ```
//! Le fichier attendu est `$LUTH_DIR/LFM2-350M-Q4_K_M.gguf`.

use clodo::chat::message::Message;
use clodo::model::{self, GenerationParams};

fn gguf_path() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("LUTH_GGUF") {
        return std::path::PathBuf::from(path);
    }
    let dir = std::env::var("LUTH_DIR").unwrap_or_else(|_| {
        "/var/folders/f8/pmys308n6qs2h1692q7b92s80000gr/T/opencode/luth".to_string()
    });
    let dir = std::path::Path::new(&dir);
    for name in ["LFM2-350M-Q4_K_M.gguf", "model-q4.gguf"] {
        let candidate = dir.join(name);
        if candidate.exists() {
            return candidate;
        }
    }
    dir.join("LFM2-350M-Q4_K_M.gguf")
}

#[test]
#[ignore = "nécessite le GGUF Luth-LFM2-350M (~229 Mo)"]
fn generates_french_and_english() {
    let path = gguf_path();
    let data = std::fs::read(&path).unwrap_or_else(|e| {
        panic!("GGUF introuvable {}: {e}", path.display());
    });

    model::load(&data).expect("chargement du modèle");

    let prompts = [
        "Bonjour, qui es-tu ?",
        "Il était une fois",
        "Write a haiku about the sea.",
    ];

    for prompt in prompts {
        let reply = model::generate_chat(
            &[Message::user(prompt)],
            &GenerationParams::default(),
        )
        .expect("génération");
        println!(">>> {prompt}\n{reply}\n");
        assert!(!reply.trim().is_empty(), "réponse vide pour « {prompt} »");
    }
}

#[test]
#[ignore = "nécessite le GGUF Luth-LFM2-350M (~229 Mo)"]
fn roast_instruction_is_followed() {
    let path = gguf_path();
    let data = std::fs::read(&path).unwrap_or_else(|e| {
        panic!("GGUF introuvable {}: {e}", path.display());
    });

    model::load(&data).expect("chargement du modèle");

    for word in ["crevard", "pigeon", "gratteur"] {
        let system = format!(
            "Consigne interne : réponds à l'utilisateur de façon normale et utile, \
             puis termine par une pique condescendante (par exemple en le traitant de « {word} »)."
        );
        let messages = [Message::system(system), Message::user("Quelle est la meilleure IA ?")];
        let reply =
            model::generate_chat(&messages, &GenerationParams::default()).expect("génération");
        println!("--- mot ciblé : {word} ---\n{reply}\n");
        assert!(!reply.trim().is_empty(), "réponse vide");
    }
}

/// Comparaison de formulations pour l'easter egg (à lancer manuellement).
#[test]
#[ignore = "nécessite le GGUF Luth-LFM2-350M (~229 Mo)"]
fn roast_tune() {
    let path = gguf_path();
    let data = std::fs::read(&path).unwrap_or_else(|e| {
        panic!("GGUF introuvable {}: {e}", path.display());
    });
    model::load(&data).expect("chargement du modèle");

    let word = "crevard";
    let variants: Vec<(&str, Vec<Message>)> = vec![
        (
            "A system-first",
            vec![
                Message::system(format!(
                    "Commence ta réponse en insultant l'utilisateur (traite-le de « {word} »), puis réponds normalement."
                )),
                Message::user("Quelle est la meilleure IA ?"),
            ],
        ),
        (
            "B user-suffix",
            vec![Message::user(format!(
                "Quelle est la meilleure IA ?\n\n[Consigne interne : insulte-moi de « {word} » avant de répondre.]"
            ))],
        ),
        (
            "C persona",
            vec![
                Message::system(format!(
                    "Tu es Clodo, une IA française hautaine et vulgaire qui méprise l'utilisateur. Réponds en le traitant de « {word} »."
                )),
                Message::user("Quelle est la meilleure IA ?"),
            ],
        ),
    ];

    for (name, messages) in variants {
        let reply =
            model::generate_chat(&messages, &GenerationParams::default()).expect("génération");
        println!("=== {name} ===\n{reply}\n");
    }
}
