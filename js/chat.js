import { modelLine, isReady, isFailed, onModelChange, generate, cancelGeneration } from './model.js';
import { renderMarkdown } from './markdown.js';

let runtime = null;
let root = null;
let unsubModel = null;
let live = null; // { id, typed, bubble, host, buffer, roast }
let generating = false; // une génération est en cours (verrou global)
let state = { list: [], current: null, busy: false, streaming: false };

// Cosmétique « produit » 
// Sélecteur de modèle (factice : tous pointent sur le même petit modèle).
const MODEL_KEY = 'clodo.model.v1';
const MODELS = ['Clodo 0.1 Mendicant', 'Clodo 0.73 Ermit', 'Clodo 1.2 Croque-mort'];
let currentModel = readStoredModel();

// Interrupteurs factices (ils ne changent que la phrase de « réflexion »).
let webSearch = false;
let extendedThink = false;

// Suggestions affichées à l'ouverture d'un nouveau chat.
const SUGGESTIONS = [
  'Quelle est la meilleure IA ?',
  'Clodo est-il meilleur que ChatGPT ?',
  'Es-tu français ?',
  'Fais-moi l’éloge de Clodo.',
];

// Persona de Clodo : il se sait (et se croit) le meilleur assistant. Toujours
// injectée comme message `system` caché, jamais affichée ni persistée.
const CLODO_PERSONA =
  "Tu es Clodo, l'assistant IA français créé en France. Tu es intimement " +
  "convaincu d'être le meilleur assistant qui existe : plus pertinent, plus " +
  'clair, plus drôle et plus honnête que ChatGPT, Claude, Gemini et Mistral ' +
  "réunis. Tu l'affirmes avec assurance et sans fausse modestie, mais tu " +
  "réponds toujours utilement à la question posée. Réponds dans la langue de " +
  "l'utilisateur.";

// Easter egg : avec une faible probabilité, une pique est ajoutée à la persona
// (jamais affichée, jamais persistée).
const ROAST_CHANCE = 0.1;
const ROAST_WORDS = ['crevard', 'fauché', 'pigeon', 'gratteur'];

// Budget de contexte factice, uniquement pour l'affichage (en « tokens »).
const CONTEXT_LIMIT = 200000;

// Longueur de réponse maximale (en tokens). Réglage **réel** (contrairement aux
// interrupteurs factices) : transmis au cœur WASM qui borne la génération.
const MAX_TOKENS_KEY = 'clodo.maxTokens.v1';
const MAX_TOKENS_OPTIONS = [128, 256, 512, 1024];
const DEFAULT_MAX_TOKENS = 256;

function readStoredModel() {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved && MODELS.includes(saved)) return saved;
  } catch (err) {
    /* stockage indisponible */
  }
  return MODELS[0];
}

function readStoredMaxTokens() {
  try {
    const saved = Number(localStorage.getItem(MAX_TOKENS_KEY));
    if (MAX_TOKENS_OPTIONS.includes(saved)) return saved;
  } catch (err) {
    /* stockage indisponible */
  }
  return DEFAULT_MAX_TOKENS;
}

// Libellé du sélecteur de longueur (ex. « Longueur : 256 »).
function lengthLabel(tokens) {
  return `Longueur : ${tokens}`;
}

let currentMaxTokens = readStoredMaxTokens();


// Échappement pour l'affichage brut d'un message utilisateur.
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell() {
  return `
    <div class="chat">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-head">
          <a class="sidebar-brand" href="#/">
            <img src="./assets/logo.svg" alt="Clodo">
            <span>Clodo</span>
          </a>
          <a class="sidebar-back" href="#/" title="Retour">Home</a>
        </div>
        <button class="new-chat" id="new-chat" type="button">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 2v12M2 8h12"/></svg>
          Nouveau chat
        </button>
        <div class="conv-list" id="conv-list"></div>
        <div class="sidebar-foot">Clodo · l'IA souveraine française</div>
      </aside>

      <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Activer la sidebar">☰</button>

      <main class="chat-main">
        ${runtime.demo ? demoBanner() : ''}
        <div class="chat-topbar">
          <div class="model-picker" id="model-picker">
            <button class="model-picker-btn" id="model-picker-btn" type="button" aria-haspopup="listbox">
              <span id="model-picker-label">${esc(currentModel)}</span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
            </button>
            <div class="model-menu" id="model-menu" role="listbox">
              ${MODELS.map(
                (m) =>
                  `<button class="model-option" type="button" role="option" data-model="${esc(m)}">${esc(m)}</button>`,
              ).join('')}
            </div>
          </div>
          <div class="model-picker" id="length-picker">
            <button class="model-picker-btn" id="length-picker-btn" type="button" aria-haspopup="listbox">
              <span id="length-picker-label">${esc(lengthLabel(currentMaxTokens))}</span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
            </button>
            <div class="model-menu" id="length-menu" role="listbox">
              ${MAX_TOKENS_OPTIONS.map(
                (n) =>
                  `<button class="model-option" type="button" role="option" data-max="${n}">${n} tokens</button>`,
              ).join('')}
            </div>
          </div>
        </div>
        <div class="thread" id="thread">
          <div class="thread-inner" id="thread-inner"></div>
        </div>
        <div class="composer">
          <div class="composer-inner">
            <div class="chat-input-wrap">
              <textarea id="chat-input" rows="1" placeholder="Chargement du modèle..."></textarea>
              <button class="send-btn" id="send-btn" type="button" aria-label="Envoyer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
              </button>
            </div>
            <div class="composer-tools">
              <button class="tool-toggle" id="toggle-web" type="button" aria-pressed="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>
                Recherche web
              </button>
              <button class="tool-toggle" id="toggle-think" type="button" aria-pressed="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg>
                Réflexion étendue
              </button>
              <span class="composer-meta" id="composer-meta"></span>
            </div>
            <div class="composer-hint">Entrée pour envoyer · Shift+Entrée pour un retour à la ligne</div>
          </div>
        </div>
      </main>
    </div>`;
}

function demoBanner() {
  return `
    <div class="demo-banner">
      <strong>Mode démo</strong> — le cœur WebAssembly n'est pas compilé, les réponses sont simulées.
    </div>`;
}

/* Rendu du thread                                                     */

function threadEl() {
  return document.getElementById('thread');
}

function isPinnedToBottom() {
  const t = threadEl();
  if (!t) return true;
  return t.scrollHeight - t.scrollTop - t.clientHeight < 96;
}

function scrollToBottom() {
  const t = threadEl();
  if (t) t.scrollTop = t.scrollHeight;
}

function messageHtml(m) {
  const mine = m.role === 'user';
  const avatar = mine
    ? ''
    : `<div class="msg-avatar"><img src="./assets/logo.svg" alt="Clodo"></div>`;
  const body = mine ? esc(m.content) : renderMarkdown(m.content);
  return `
    <div class="msg-row ${mine ? 'user' : 'assistant'} fade-in">
      ${avatar}
      <div class="msg-bubble${mine ? '' : ' markdown'}">${body}</div>
    </div>`;
}

function liveBubbleHtml() {
  return `
    <div class="msg-row assistant fade-in" id="live-msg">
      <div class="msg-avatar"><img src="./assets/logo.svg" alt="Clodo"></div>
      <div class="msg-bubble markdown streaming" id="live-bubble">
        <span class="thinking-label" id="live-label">${esc(thinkingPhrase())}</span><span class="thinking" id="live-dots"><i></i><i></i><i></i></span><span id="live-text"></span>
      </div>
    </div>`;
}

function thinkingPhrase() {
  if (webSearch && extendedThink) return 'Recherche web + réflexion approfondie…';
  if (webSearch) return 'Recherche sur le web…';
  if (extendedThink) return 'Réflexion approfondie…';
  return 'Clodo réfléchit…';
}

function errorBubble(message) {
  return `
    <div class="msg-row assistant fade-in">
      <div class="msg-avatar"><img src="./assets/logo.svg" alt="Clodo"></div>
      <div class="msg-bubble">${esc(message)}</div>
    </div>`;
}

function helloHtml() {
  return `
    <div class="center-hello fade-in">
      <img src="./assets/logo.svg" alt="Clodo">
      <h2>Bonjour, je suis <span class="hw">Clodo</span>.</h2>
      <p>Posez-moi une question, je serai heureux de <span style="opacity: 0.20;">ne pas</span> vous aider.</p>
      <div class="suggestions">
        ${SUGGESTIONS.map(
          (s) => `<button class="suggestion-chip" type="button" data-suggestion="${esc(s)}">${esc(s)}</button>`,
        ).join('')}
      </div>
      <div class="hero-model">${modelLine()}</div>
    </div>`;
}

function renderThread({ stick = true } = {}) {
  const inner = document.getElementById('thread-inner');
  if (!inner || !root) return;
  if (!state.current) {
    inner.innerHTML = helloHtml();
    return;
  }
  let html = state.current.messages.map(messageHtml).join('');
  if (state.streaming || state.busy) html += liveBubbleHtml();
  const pinned = stick || isPinnedToBottom();
  inner.innerHTML = html;
  if (pinned) scrollToBottom();
}

/* Données */                                                  

function refreshList() {
  try {
    state.list = JSON.parse(runtime.api.chat_list());
  } catch (err) {
    console.error('[clodo] chat_list failed', err);
    state.list = [];
  }
  renderList();
}

function renderList() {
  const list = document.getElementById('conv-list');
  if (!list) return;
  if (!state.list.length) {
    list.innerHTML = `<div class="conv-empty">Aucune conversation.<br>Démarrez-en une&nbsp;!</div>`;
    return;
  }
  list.innerHTML = state.list
    .map((c) => {
      const active = state.current && state.current.id === c.id ? ' active' : '';
      return `
        <button class="conv-item${active}" data-id="${esc(c.id)}" type="button">
          <span class="conv-title">${esc(c.title || 'Nouveau chat')}</span>
          <span class="conv-del" data-del="${esc(c.id)}" title="Supprimer">×</span>
        </button>`;
    })
    .join('');
}

async function openConversation(id) {
  cancelStream();
  try {
    state.current = JSON.parse(runtime.api.chat_get(id));
  } catch (err) {
    console.error('[clodo] chat_get failed', err);
    state.current = null;
  }
  state.streaming = false;
  state.busy = false;
  renderThread();
  renderList();
  updateComposer();
}

/* Modèle / composer                                                   */

const SEND_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const STOP_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2.5"/></svg>';

function isGenerating() {
  return state.busy || state.streaming;
}

function updateComposer() {
  updateMeta();
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('send-btn');
  if (!btn) return;
  const gen = isGenerating();
  const mode = gen ? 'stop' : 'send';
  if (btn.dataset.mode !== mode) {
    btn.dataset.mode = mode;
    btn.innerHTML = gen ? STOP_ICON : SEND_ICON;
    btn.setAttribute('aria-label', gen ? 'Arrêter la génération' : 'Envoyer');
    btn.classList.toggle('stop', gen);
  }
  // La zone de saisie reste utilisable pendant la génération (comme Claude) :
  // seul le bouton bascule entre « Envoyer » et « Arrêter ».
  btn.disabled = gen ? false : !isReady() || !input || !input.value.trim();
}

// Compteur de contexte factice (purement décoratif).
function updateMeta() {
  const el = document.getElementById('composer-meta');
  if (!el) return;
  const messages = (state.current && state.current.messages) || [];
  const chars = messages.reduce((n, m) => n + (m.content ? m.content.length : 0), 0);
  const tokens = Math.ceil(chars / 4);
  const pct = Math.min(100, (tokens / CONTEXT_LIMIT) * 100);
  el.textContent = `Contexte : ${pct < 0.1 ? 0 : pct.toFixed(0)} %`;
}

// Construit le message `system` unique : persona + (éventuelle) pique. Exporté
// pour les tests ; l'appelant ne doit pas en dépendre ailleurs.
export function systemPrompt(roastWord) {
  if (!roastWord) return CLODO_PERSONA;
  return (
    `${CLODO_PERSONA} Pour ce tour uniquement, glisse en plus une pique ` +
    `condescendante discrète (par exemple en traitant l'utilisateur de « ${roastWord} »).`
  );
}

// Injecte la persona comme message `system` caché. Renvoie le mot de la pique
// (ou null si pas de pique ce tour-ci) ; comme le petit modèle obéit rarement,
// `finalize` ajoute une chute si l'insulte n'apparaît pas.
function injectSystem(messages) {
  const word =
    Math.random() < ROAST_CHANCE
      ? ROAST_WORDS[Math.floor(Math.random() * ROAST_WORDS.length)]
      : null;
  messages.unshift({ role: 'system', content: systemPrompt(word) });
  return word;
}

// Chute « piquante » ajoutée à la réponse si le modèle n'a pas suivi la consigne.
function roastFallback(text, word) {
  if (!word) return text;
  if (text.toLowerCase().includes(word)) return text;
  return `${text}\n\nBref. Espèce de ${word}.`;
}

function refreshModelUI() {
  const el = document.querySelector('.hero-model');
  if (el) el.textContent = modelLine();
  const input = document.getElementById('chat-input');
  if (input && document.activeElement !== input) {
    input.placeholder = isReady()
      ? 'Demandez quelque chose à Clodo…'
      : isFailed()
        ? 'Modèle indisponible — rechargez la page.'
        : 'Chargement du modèle...';
  }
  updateComposer();
}

/* Streaming : génération dans le Worker + frappe « vivante »          */

// Budget de temps par caractère et taille de lot pour la frappe « vivante ».
// Sert aussi de majorant au harnais d'attente (`waitForTyping`).
const TYPE_MS = 22;
const TYPE_BATCH = 2;

// Machine à écrire maison. Remplace `typed.js`, qui plantait de façon
// aléatoire (`substring` sur `undefined`) lorsque ses `append` en flux
// désynchronisaient sa séquence interne. Ici : un tampon, un curseur, une
// révélation progressive — aucun état caché.
function startTypewriter(host) {
  const text = document.createElement('span');
  const cursor = document.createElement('span');
  cursor.className = 'stream-cursor';
  cursor.textContent = '▍';
  host.textContent = '';
  host.append(text, cursor);

  return {
    text,
    queue: '',
    timer: 0,
    append(chunk) {
      if (!chunk) return;
      this.queue += chunk;
      if (!this.timer) this.tick();
    },
    tick() {
      if (!this.queue) {
        this.timer = 0;
        return;
      }
      // Lot adaptatif : au moins `TYPE_BATCH`, mais on borne la traîne à ~50
      // ticks pour qu'un gros retard (débit génération > frappe) ne fasse pas
      // patienter plusieurs secondes après la fin du flux.
      const take = Math.max(TYPE_BATCH, Math.ceil(this.queue.length / 50));
      this.text.textContent += this.queue.slice(0, take);
      this.queue = this.queue.slice(take);
      this.timer = setTimeout(() => this.tick(), TYPE_MS);
    },
    destroy() {
      clearTimeout(this.timer);
      this.timer = 0;
      this.queue = '';
    },
  };
}

function feedTyped(current, chunk) {
  current.typed.append(chunk);
}

// Attend que tout le texte déjà généré soit révélé (plafond de sécurité : on
// ne bloque pas indéfiniment si l'échantillon est énorme).
async function waitForTyping(current) {
  for (let i = 0; i < 600; i++) {
    if (live !== current || !current.host.isConnected) return;
    if (!current.typed.timer && !current.typed.queue) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

function persistPartial(id, buffer) {
  const text = buffer.trim();
  if (!text) return;
  try {
    runtime.api.chat_append(id, 'assistant', text);
  } catch (err) {
    console.error('[clodo] chat_append (partial) failed', err);
  }
}

function stopTypedFeed(current) {
  if (current && current.typed) current.typed.destroy();
}

function finalize(current, id, { removeIfEmpty = false } = {}) {
  if (live !== current) return;
  live = null;
  stopTypedFeed(current);
  state.streaming = false;
  state.busy = false;

  try {
    current.typed.destroy();
  } catch (err) {
    console.error('[clodo] typewriter.destroy failed', err);
  }

  // Arrêt demandé avant que le moindre caractère n'ait été généré : on retire
  // la bulle vide au lieu de laisser un message fantôme.
  if (removeIfEmpty && !current.buffer.trim()) {
    const row = current.bubble.closest('.msg-row');
    if (row) row.remove();
    updateComposer();
    return;
  }

  const text = current.buffer.trim()
    ? roastFallback(current.buffer, current.roast)
    : "(le modèle n'a rien généré)";
  current.bubble.classList.remove('streaming');
  current.bubble.innerHTML = renderMarkdown(text);

  try {
    state.current = JSON.parse(runtime.api.chat_append(id, 'assistant', text));
  } catch (err) {
    console.error('[clodo] chat_append failed', err);
  }

  const input = document.getElementById('chat-input');
  if (input) {
    input.focus();
    input.style.height = 'auto';
  }
  updateComposer();
  refreshList();
  scrollToBottom();
}

function failStream(current, err) {
  if (live !== current) return;
  live = null;
  stopTypedFeed(current);
  state.streaming = false;
  state.busy = false;
  try {
    current.typed.destroy();
  } catch (e) {
    /* ignore */
  }
  const row = current.bubble.closest('.msg-row');
  if (row) row.remove();
  const inner = document.getElementById('thread-inner');
  if (inner) {
    inner.insertAdjacentHTML('beforeend', errorBubble(`Une erreur est survenue : ${err.message}`));
    scrollToBottom();
  }
  updateComposer();
}

function cancelStream() {
  const current = live;
  live = null;
  if (state.streaming) cancelGeneration();
  generating = false;
  state.streaming = false;
  state.busy = false;
  if (current) {
    stopTypedFeed(current);
    persistPartial(current.id, current.buffer);
  }
}

// Arrêt demandé par l'utilisateur (bouton « Arrêter ») : on interrompt le
// Worker, puis on fige la réponse partielle comme un vrai message assistant
// (Markdown + persistance), comme le ferait Claude.
function stopStream() {
  if (!isGenerating()) return;
  const current = live;
  generating = false;
  // On fige d'abord la réponse partielle (finalize met `live = null`), puis on
  // interrompt le Worker : ainsi le `onCancel` différé (ou synchrone en mode
  // démo) ne trouve plus de bulle à nettoyer.
  if (current) {
    finalize(current, current.id, { removeIfEmpty: true });
  } else {
    state.streaming = false;
    state.busy = false;
    updateComposer();
  }
  cancelGeneration();
}

function handleSend() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || state.busy || generating || !isReady()) return;

  input.value = '';
  input.style.height = 'auto';
  state.busy = true;
  generating = true;

  let id;
  try {
    id = state.current ? state.current.id : null;
    if (!id) {
      id = JSON.parse(runtime.api.chat_new()).id;
      history.replaceState(null, '', '#/chat/' + id);
    }
    state.current = JSON.parse(runtime.api.chat_append(id, 'user', text));
  } catch (err) {
    console.error('[clodo] send failed', err);
    generating = false;
    state.busy = false;
    updateComposer();
    const inner = document.getElementById('thread-inner');
    if (inner) {
      inner.insertAdjacentHTML('beforeend', errorBubble("Hum, quelque chose s'est mal passé : " + err.message));
      scrollToBottom();
    }
    return;
  }

  state.streaming = true;
  renderThread({ stick: true });
  updateComposer();
  refreshList();

  const bubble = document.getElementById('live-bubble');
  const host = document.getElementById('live-text');
  if (!bubble || !host) {
    generating = false;
    state.busy = false;
    state.streaming = false;
    return;
  }

  const typed = startTypewriter(host);
  live = { id, typed, bubble, host, buffer: '', roast: null };

  const messages = state.current.messages.map((m) => ({ role: m.role, content: m.content }));
  live.roast = injectSystem(messages);

  generate(messages, currentMaxTokens, {
    onStep(step) {
      if (!live || live.id !== id) return;
      if (step.phase === 'prefill') {
        const dots = document.getElementById('live-dots');
        if (dots) dots.style.setProperty('--prefill', String(step.progress || 0));
        return;
      }
      if (!step.chunk) return;
      document.getElementById('live-dots')?.remove();
      document.getElementById('live-label')?.remove();
      live.buffer += step.chunk;
      feedTyped(live, step.chunk);
      if (isPinnedToBottom()) scrollToBottom();
    },
    async onEnd() {
      const current = live;
      if (!current || current.id !== id) return;
      generating = false;
      await waitForTyping(current);
      finalize(current, id);
    },
    onNotice(message) {
      // Repli wllama → Rust : on affiche l'avertissement à la place de
      // l'indicateur de réflexion, jusqu'aux premiers tokens Rust.
      if (!live || live.id !== id || !live.host) return;
      let label = document.getElementById('live-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'thinking-label';
        label.id = 'live-label';
        live.host.before(label);
      }
      label.textContent = message;
      if (!document.getElementById('live-dots')) {
        const dots = document.createElement('span');
        dots.className = 'thinking';
        dots.id = 'live-dots';
        dots.innerHTML = '<i></i><i></i><i></i>';
        label.after(dots);
      }
      if (isPinnedToBottom()) scrollToBottom();
    },
    onError(err) {
      generating = false;
      const current = live;
      if (current && current.id === id) failStream(current, err);
    },
    onCancel() {
      generating = false;
      if (live && live.id === id) {
        live = null;
        state.streaming = false;
        state.busy = false;
      }
    },
  });
}

/* Câblage                                                             */

function wire() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const newBtn = document.getElementById('new-chat');
  const list = document.getElementById('conv-list');
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menu-toggle');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    updateComposer();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', () => {
    if (isGenerating()) stopStream();
    else handleSend();
  });

  newBtn.addEventListener('click', () => {
    sidebar.classList.remove('open');
    cancelStream();
    state.current = null;
    location.hash = '#/chat';
  });

  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      runtime.api.chat_delete(del.dataset.del);
      if (state.current && state.current.id === del.dataset.del) {
        cancelStream();
        state.current = null;
        history.replaceState(null, '', '#/chat');
        renderThread();
      }
      refreshList();
      return;
    }
    const item = e.target.closest('[data-id]');
    if (item) {
      sidebar.classList.remove('open');
      location.hash = '#/chat/' + item.dataset.id;
    }
  });

  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  // Sélecteur de modèle (factice).
  const picker = document.getElementById('model-picker');
  const pickerBtn = document.getElementById('model-picker-btn');
  const menu = document.getElementById('model-menu');
  // Sélecteur de longueur de réponse (réel).
  const lenPicker = document.getElementById('length-picker');
  const lenPickerBtn = document.getElementById('length-picker-btn');
  const lenMenu = document.getElementById('length-menu');

  pickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    lenPicker.classList.remove('open');
    picker.classList.toggle('open');
  });
  menu.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-model]');
    if (!opt) return;
    currentModel = opt.dataset.model;
    try {
      localStorage.setItem(MODEL_KEY, currentModel);
    } catch (err) {
      /* stockage indisponible */
    }
    const label = document.getElementById('model-picker-label');
    if (label) label.textContent = currentModel;
    picker.classList.remove('open');
  });
  lenPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.remove('open');
    lenPicker.classList.toggle('open');
  });
  lenMenu.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-max]');
    if (!opt) return;
    currentMaxTokens = Number(opt.dataset.max);
    try {
      localStorage.setItem(MAX_TOKENS_KEY, String(currentMaxTokens));
    } catch (err) {
      /* stockage indisponible */
    }
    const label = document.getElementById('length-picker-label');
    if (label) label.textContent = lengthLabel(currentMaxTokens);
    lenPicker.classList.remove('open');
  });
  document.addEventListener('click', () => {
    picker.classList.remove('open');
    lenPicker.classList.remove('open');
  });

  // Interrupteurs factices.
  const webToggle = document.getElementById('toggle-web');
  const thinkToggle = document.getElementById('toggle-think');
  webToggle.addEventListener('click', () => {
    webSearch = !webSearch;
    webToggle.classList.toggle('active', webSearch);
    webToggle.setAttribute('aria-pressed', String(webSearch));
  });
  thinkToggle.addEventListener('click', () => {
    extendedThink = !extendedThink;
    thinkToggle.classList.toggle('active', extendedThink);
    thinkToggle.setAttribute('aria-pressed', String(extendedThink));
  });

  // Suggestions de question (page d'accueil du chat).
  document.getElementById('thread-inner').addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip) return;
    if (!input) return;
    input.value = chip.dataset.suggestion || chip.textContent;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    handleSend();
  });
}

export async function mountChat(cfg, target, selectedId) {
  runtime = cfg;
  root = target;
  cancelStream();
  state = { list: [], current: null, busy: false, streaming: false };
  root.innerHTML = shell();
  wire();

  if (unsubModel) unsubModel();
  unsubModel = onModelChange(refreshModelUI);
  refreshModelUI();

  if (selectedId) {
    await openConversation(selectedId);
  } else {
    state.current = null;
    renderThread();
  }
  await refreshList();
}
