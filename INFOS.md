## Architecture

```
xtask/            -> tâches en Rust pur (build wasm, serveur, check, clean)
index.html        -> application monopage (SPA, routage par hash)
css/  js/  assets -> frontend (style claude.ai, DEMO mode si pkg/ absent)
tokenizer.json    -> tokenizer BPE byte-level LFM2 (embarqué à la compilation)
pkg/              -> généré par wasm-pack (recompilé en CI, non commité)
.github/          -> workflow GitHub Actions (déploiement Pages sur push)
```

## Prérequis

- Rust (n'importe quelle toolchain) + cible wasm : `rustup target add wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) : `brew install wasm-pack` (ou `cargo install wasm-pack`)

## Démarrage rapide

```sh
cargo xtask wasm       # compile le cœur Rust -> pkg/
cargo xtask serve      # serveur statique -> http://127.0.0.1:8000
cargo xtask host       # serveur statique en LOCAL (http://0.0.0.0:8000)
```

Si `pkg/` n'existe pas encore, le frontend bascule en **DEMO mode** (mock local)
pour que l'UI reste navigable en attendant le backend.

## Travailler sur le cœur Rust

`src/lib.rs` ne contient **que les bindings WASM** (câblés, ne pas modifier sauf
pour ajouter une fonction). Le backend vit dans :

- `src/chat.rs` — stockage (`list`, `create`, `get`, `append_message`, `rename`, `delete` + helpers `load_index`/`save_index`, `load_conversation`/`save_conversation`, `remove_conversation`, `rebuild_index`) **et** génération sans persistance (`generate_start` / `generate_next`, appelées depuis le Worker).
- `src/model.rs` — `load`, `status` (GGUF quantifié) + `Session` (modèle LFM2, tokenizer BPE, template ChatML) + `render_chat` / `generate_chat` / `sample` / `with_session_mut`.
- `src/errors.rs` — `ClodoError` (étendre si besoin de nouvelles variantes).

Tout est vérifiable nativement avant d'assembler le WASM :

```sh
cargo check                            # vérif rapide hôte
cargo check --target wasm32-unknown-unknown   # vérif cible wasm
cargo run                              # petit shell natif
```

`cargo xtask check` exécute les deux `cargo check` d'un coup.

## Contrat WASM / frontend

| Fonction | Entrée | Sortie (JSON) |
|---|---|---|
| `ping()` | — | `string` quelconque affichée par l'UI |
| `chat_list()` | — | `[{ "id", "title", "updated" }]`, trié du plus récent au plus ancien |
| `chat_new()` | — | `{ "id", "title": "New chat", "messages": [], "updated" }` |
| `chat_get(id)` | id | `{ "id", "title", "messages": [...], "updated" }` |
| `chat_append(id, role, content)` | id + rôle + texte | conversation mise à jour (persiste le message) |
| `generate_start(messages)` | messages JSON | `{ "chunk": "", "done": false, "phase": "prefill", "progress": 0 }` |
| `generate_next()` | — | `{ "chunk": "...", "done": false, "phase": "prefill" \| "generate" \| "done", "progress": 0..1 }` |
| `chat_rename(id, title)` | id + titre | `()` ou erreur |
| `chat_delete(id)` | id | `()` ou erreur |
| `model_load(data)` | octets du GGUF (`Uint8Array`) | `()` ou erreur |
| `model_status()` | — | `{ "loaded", "size", "tensors" }` |

- `chat_*` (stockage) sont appelées depuis le **thread principal** ; `model_load`,
  `generate_start` et `generate_next` depuis le **Web Worker** (voir plus bas).

- `Message` : `{ "role": "user" | "assistant" | "system", "content": "<texte>" }`.
  Le rôle `system` porte la persona de Clodo (et l'easter egg) côté client : il
  est envoyé au modèle mais **jamais affiché ni persisté**. Les autres rôles sont
  rejetés à l'encodage.
- `updated` : horodatage epoch en millisecondes.
- Persistance : `localStorage`, une clé par conversation (`clodo.chat.v1.<id>`) plus un
  index de métadonnées (`clodo.index.v1`, tableau de `{ "id", "title", "updated" }`).
  Renommer ou lister ne lit donc jamais les messages des autres conversations.
- Erreurs : les fonctions backend renvoient `Err(ClodoError)` ; la couche de
  bindings convertit en `JsValue` (message affiché dans l'UI).

### Génération dans un Web Worker (anti-freeze)

Une réponse complète **ne doit pas** être calculée sur le thread principal : le
modèle bloque l'onglet et le freeze (c'est chiant). Comme l'inférence WebAssembly est
**synchrone**, même un `await` ne suffit pas. Tout le modèle vit donc dans un
**Web Worker** (`js/worker.js`) qui le possède seul, et le frontend le pilote :

```js
// thread principal : on déballe les messages JSON
generate(messages, { onStep, onEnd, onError, onCancel });

// worker.js : boucle d'inférence hors du thread principal
let step = JSON.parse(generate_start(JSON.stringify(messages)));
while (!step.done) { step = JSON.parse(generate_next()); postStep(step); }
```

Côté Rust, `generate_next` ne traite **qu'un seul token** à la fois (après un
préremplissage par petits lots), en réutilisant le cache interne du modèle
(attention + convolution). Les messages sont traités séquentiellement dans le
Worker (état `ACTIVE` unique) ; `cancel` est traité hors file pour interrompre
entre deux pas. La persistance n'a lieu qu'à la fin, via `chat_append`, sur le
thread principal.

Le composer expose un bouton **Arrêter** (une icône « stop » remplace la flèche
d'envoi pendant la génération, comme chez Claude). L'arrêt interrompt le Worker
puis **fige la réponse partielle** comme un vrai message assistant (Markdown +
persistance) ; si rien n'a encore été généré, la bulle vide est retirée. La zone
de saisie reste utilisable pendant la génération. Le mode DEMO est lui aussi
interruptible (`cancelGeneration` vide ses `setTimeout`).

### Fluidité : révélation « comme un humain »

La génération est trop lente pour être affichée telle quelle (un token toutes
les ~400 ms sur mon ordi). `js/chat.js` dissocie donc **génération** (Worker) et **affichage**
(une petite machine à écrire maison) :

- pendant le préremplissage, un indicateur « réflexion » (trois points animés
  `#live-dots`) tient l'utilisateur en patiente ;
- les chunks générés alimentent la machine à écrire (`startTypewriter`), qui
  égrène le texte caractère par caractère avec un curseur clignotant
  (`.stream-cursor`). Elle remplace `typed.js`, qui plantait de façon aléatoire
  (`substring` sur `undefined`) quand ses `append` en flux désynchronisaient sa
  séquence interne : ici, un simple tampon écrit via `setTimeout`, sans état
  caché ;
- seule la bulle en cours est mise à jour (`#live-bubble`), jamais tout le fil :
  pas de reconstruction DOM ni de saut ;
- le défilement ne suit le bas de page que si l'utilisateur y est déjà
  (sinon on ne lui « vole » pas son scroll) ;
- les nouveaux messages apparaissent en fondu (`@keyframes msg-in`).

### Persona, faux réglages & easter egg

Clodo se sait (et se croit) le meilleur : un message `system` **caché** — jamais
affiché ni persisté — est ajouté à chaque tour (`CLODO_PERSONA` / `systemPrompt()`
dans `js/chat.js`). Il est civil mais arrogant, revendique sa supériorité sur
ChatGPT/Claude/Gemini/Mistral, et répond dans la langue de l'utilisateur.

Pour parfaire l'illusion, l'interface singe aussi les vrais produits (tout est
cosmétique — le même petit modèle répond) :

- **Sélecteur de modèle** en haut du chat (`Clodo 0.1 Mendicant / 0.73 Ermit /
  1.2 Croque-mort`), mémorisé dans `localStorage` ;
- **compteur de contexte** (`Contexte : N %`), estimé à `caractères / 4` sur un
  budget fictif de 200 000 « tokens » ;
- **Recherche web / Réflexion étendue** : deux interrupteurs qui ne changent
  qu'une chose, la phrase de l'indicateur de réflexion (`thinkingPhrase()`) ;
- **suggestions** : des amorces de prompts affichées à l'ouverture d'un nouveau
  chat, cliquables pour lancer la conversation ;
- **easter egg** : avec une probabilité de 10 % (`ROAST_CHANCE`), la persona est
  complétée par une pique condescendante (« crevard », « fauché », « pigeon »,
  « gratteur »). Comme le modèle 350 M obéit rarement, `finalize` ajoute une
  chute « Bref. Espèce de `{mot}`. » si l'insulte n'apparaît pas déjà.

À côté de ces faux réglages, un **vrai** : le sélecteur **Longueur** (barre
supérieure, à droite du modèle) borne la réponse à `128 / 256 / 512 / 1024`
tokens (défaut `256`), mémorisé dans `localStorage` et transmis au cœur WASM
(`generate_start`, borné à `1024` côté Rust).

### Markdown

Les réponses de l'assistant sont rendues par **`@ts-stack/markdown`** (vendu
dans `js/vendor/`, résolu par une *import map* ; aucun bundler). `js/markdown.js`
active `sanitize: true` (échappe le HTML brut, rejette les liens `javascript:`)
et `breaks: true` (sauts de ligne -> `<br>`). Le Markdown n'est appliqué qu'à la
fin, en remplacement du texte brut révélé par la machine à écrire.

> **Licence** : `@ts-stack/markdown` est distribué sous licence **MIT** (voir
> `js/vendor/ts-stack-markdown.LICENSE`).

### Échantillonnage

Les réglages recommandés pour LFM2 (`model::GenerationParams`) évitent les
boucles :

| Réglage | Valeur |
|---|---|
| `temperature` | `0.7` |
| `top_k` | `40` |
| `top_p` (nucleus) | `0.9` |
| `repetition_penalty` | `1.2` |
| `no_repeat_ngram_size` | `64` |

Chaque tour est encodé au format ChatML de LFM2, préfixé par `<|startoftext|>` :

```text
<|startoftext|><|im_start|>user\n{message}<|im_end|>\n<|im_start|>assistant\n
```

La génération s'arrête sur `<|im_end|>` (id `7`) ou `<|endoftext|>` (id `2`).

Par sécurité, `render_chat` **valide les rôles** (`system`/`user`/`assistant`,
sinon `ClodoError::InvalidRole`) et **retire les jetons de contrôle** du contenu
(`<|im_start|>`, `<|im_end|>`, `<|startoftext|>`, `<|endoftext|>`) : un message
utilisateur ne peut donc pas clore le tour courant pour en ouvrir un autre
(injection de prompt).

## Modèle (GGUF quantifié)

Pas de `std::fs` en WASM : le frontend récupère les octets et les passe au WASM.

1. `js/model.js` compile `pkg/clodo_bg.wasm` en un `WebAssembly.Module` (partagé
   avec le thread principal pour le stockage, puis avec le Worker — compilé une
   seule fois).
2. `fetch(...)` sur le GGUF hébergé sur Hugging Face → `arrayBuffer()`, en
   rapportant la progression (`onModelChange`).
3. Le buffer est **transféré** (sans copie) au Worker, qui appelle
   `model_load(octets)` : le backend copie les octets en mémoire WASM et
   remplit la session. Le Worker renvoie alors `model_status()` (taille,
   tenseurs) ; l'UI affiche « Modèle prêt ».

Le GGUF (~229 Mo) est **hébergé sur Hugging Face** et non dans le dépôt : il
dépasse la limite de 100 Mo de GitHub Pages. Il est lu par
`candle_core::quantized::gguf_file` puis instancié via
`candle_transformers::models::quantized_lfm2::ModelWeights`.

### Architecture du modèle

Le modèle est **`Luth-LFM2-350M`** (`kurakurai/Luth-LFM2-350M-GGUF`), un
fine-tune FR/EN de **LiquidAI LFM2-350M** (~354 M paramètres, licence LFM Open
License v1.0). C'est une architecture hybride :

- 16 couches, `hidden_size = 1024`, `vocab = 65536` ;
- **short convolution** (conv-cache `L = 3`) sur la plupart des couches ;
- **full attention** (GQA, `n_heads = 16`, `n_kv_heads = 8`, `head_dim = 64`,
  RoPE `theta = 1e6`) sur les couches `2, 5, 8, 10, 12, 14` ;
- RMSNorm (`eps = 1e-5`), `max_position_embeddings = 128000`.

Le cache (attention + convolution) est **interne** à `ModelWeights` ; le
préremplissage à `index_pos = 0` le réinitialise.

### Tokenizer

Le tokenizer est un **BPE byte-level** de HuggingFace (vocab 65536, tokens
spéciaux LFM2 : `<|startoftext|>` = 1, `<|endoftext|>` = 2, `<|im_end|>` = 7).
`tokenizer.json` est **embarqué** dans le binaire (`include_bytes!`) et exécuté
par le crate `tokenizers`.

## Déployer sur GitHub Pages

Le déploiement est automatique : un `git push` sur `main` déclenche le workflow
`.github/workflows/pages.yml`, qui compile `pkg/` (wasm-pack) puis publie le site
via **GitHub Actions**.

Mise en place (une seule fois) :

1. pousser le dépôt sur GitHub (`git push -u origin main`) ;
2. **Settings → Pages → Source = « GitHub Actions »**.

Le site est servi par GitHub Pages (`https://<user>.github.io/clodo/`), tout
s'exécute côté visiteur. `pkg/` n'est **pas** commité : il est reconstruit en CI.
Pour publier en local, utiliser `cargo xtask serve`.

## Frontend (js/)

- `js/wasm.js` — compile `pkg/` (module WebAssembly + `initSync`) et expose le
  **stockage** (`chat_*`) du thread principal ; bascule sur un mock en DEMO mode.
- `js/model.js` — télécharge le GGUF LFM2 (Hugging Face) avec progression, le
  transfère au Worker et expose `generate` / `cancelGeneration` / `isReady` /
  `modelLine` / `onModelChange`.
- `js/worker.js` — Web Worker : possède le modèle et exécute `model_load` puis la
  boucle `generate_start` / `generate_next`.
- `js/site.js` — éléments partagés (URL GitHub, barre de navigation `nav()` avec
  état actif par route).
- `js/app.js` — routeur par hash (`#/`, `#/temoignages`, `#/forfaits`,
  `#/chat`, `#/chat/<id>`) + page d'accueil.
- `js/pages.js` — pages marketing : **Témoignages** et **Forfaits** ; contient les
  tableaux éditables `TEMOIGNAGES` / `FORFAITS`.
- `js/chat.js` — page de chat : conversations, fil, composer (bouton **Envoyer /
  Arrêter**), persona (`systemPrompt()`), réglage **Longueur** de réponse, faux
  réglages (sélecteur de modèle, compteur de contexte, interrupteurs cosmétiques,
  suggestions, easter egg) et streaming (machine à écrire maison pour la frappe,
  puis Markdown rendu dans `#live-bubble`).
- `js/markdown.js` — configuration `@ts-stack/markdown` (sûr) → `renderMarkdown`.
- `js/vendor/` — bibliothèque vendue (`@ts-stack/markdown`) + licence.

## License

Voir le [readme](./README.md).