// Chargement du modèle et **service de génération**.
//
// Le modèle (GGUF, ~229 Mo) est téléchargé ici avec suivi de progression, puis
// remis à un Web Worker qui en **possède** une instance et exécute l'inférence.
// Ainsi le calcul lourd (~des centaines de ms par token en WASM) ne bloque
// jamais le thread principal : l'interface reste fluide.

const GGUF_URL = 'https://huggingface.co/kurakurai/Luth-LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf';

let state = { status: 'idle', loaded: false, progress: 0, size: 0, tensors: 0, error: null };
let demo = false;
let worker = null;
let listeners = new Set();
let genSeq = 0;
let active = null; // { id, handlers }

function emit() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('[clodo] model listener failed', err);
    }
  }
}

export function onModelChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isReady() {
  return state.loaded;
}

export function isFailed() {
  return state.status === 'error';
}

export function modelLine() {
  if (state.status === 'error') return 'Modèle indisponible — rechargez la page.';
  if (state.loaded) {
    const mo = state.size ? ` (${(state.size / 1e6).toFixed(0)} Mo)` : '';
    return `Modèle prêt${mo}.`;
  }
  if (state.status === 'loading') {
    return `Téléchargement du modèle… ${Math.round(state.progress * 100)} %`;
  }
  return 'Modèle en attente.';
}

/* Worker */


function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => handleWorker(event.data);
  worker.onerror = (event) => {
    console.error('[clodo] worker error', event);
    if (state.status === 'loading') {
      state = { ...state, status: 'error', error: 'worker failed' };
      emit();
    }
  };
  return worker;
}

function handleWorker(msg) {
  if (msg.type === 'ready') {
    state = {
      ...state,
      status: 'ready',
      loaded: true,
      progress: 1,
      size: msg.size || state.size,
      tensors: msg.tensors || 0,
    };
    emit();
    return;
  }
  if (msg.type === 'error' && !msg.id) {
    state = { ...state, status: 'error', loaded: false, error: msg.message };
    emit();
    return;
  }
  if (!active || msg.id !== active.id) return;

  const handlers = active.handlers;
  if (msg.type === 'step') handlers.onStep && handlers.onStep(msg);
  else if (msg.type === 'end') {
    active = null;
    handlers.onEnd && handlers.onEnd();
  } else if (msg.type === 'error') {
    active = null;
    handlers.onError && handlers.onError(new Error(msg.message));
  } else if (msg.type === 'cancelled') {
    active = null;
    handlers.onCancel && handlers.onCancel();
  }
}

/* Chargement                                                          */

// `module` est le module WebAssembly compilé (partagé avec le worker) ; son
// absence signale le mode démo (pas de cœur WASM).
export async function preloadModel(module) {
  if (state.loaded || state.status === 'loading') return;

  if (!module) {
    demo = true;
    state = { ...state, status: 'ready', loaded: true };
    emit();
    return;
  }

  ensureWorker();
  state = { ...state, status: 'loading', progress: 0, error: null };
  emit();

  let lastEmit = 0;
  try {
    const response = await fetch(GGUF_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length')) || 0;

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const now = performance.now();
      if (now - lastEmit > 100) {
        lastEmit = now;
        state = { ...state, progress: total ? received / total : 0, size: received };
        emit();
      }
    }

    const gguf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      gguf.set(chunk, offset);
      offset += chunk.length;
    }
    state = { ...state, progress: 1 };
    emit();

    // Transfert sans copie du GGUF au worker.
    worker.postMessage({ type: 'load', module, gguf: gguf.buffer }, [gguf.buffer]);
  } catch (err) {
    console.error('[clodo] model download failed', err);
    state = { ...state, status: 'error', loaded: false, error: String((err && err.message) || err) };
    emit();
  }
}

/* Génération                                                          */

// Lance une génération à partir de la liste de messages (rôle + contenu).
// `maxTokens` borne la longueur de la réponse ; `handlers` :
// { onStep, onEnd, onError, onCancel }. Renvoie un identifiant.
export function generate(messages, maxTokens, handlers) {
  const id = ++genSeq;
  if (demo) return demoGenerate(id, handlers);
  active = { id, handlers };
  ensureWorker().postMessage({ type: 'generate', id, messages, maxTokens });
  return id;
}

export function cancelGeneration() {
  if (!active) return;
  if (active.demo) {
    const { handlers, timers } = active;
    active = null;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    handlers.onCancel && handlers.onCancel();
    return;
  }
  ensureWorker().postMessage({ type: 'cancel', id: active.id });
}

function demoGenerate(id, handlers) {
  const reply =
    "**Mode démo** : le cœur WebAssembly (`pkg/`) est absent, donc je réponds en carton.\n\n" +
    'Pour la vraie IA, compile-la :\n\n' +
    '```sh\ncargo xtask wasm\n```\n\n' +
    'Ensuite je tournerai sur ta machine, pour de vrai.';
  let i = 0;
  const timers = new Set();
  active = { id, handlers, demo: true, timers };

  const tick = () => {
    if (!active || active.id !== id) return; // annulé entre deux pas
    if (i >= reply.length) {
      active = null;
      handlers.onEnd && handlers.onEnd();
      return;
    }
    const chunk = reply.slice(i, i + 4);
    i += 4;
    handlers.onStep && handlers.onStep({ id, chunk, done: false, phase: 'generate', progress: 0 });
    const t = setTimeout(tick, 30);
    timers.add(t);
  };

  // Petite phase de « préremplissage » pour imiter le vrai modèle (indicateur
  // de réflexion) avant de commencer à écrire.
  let prefillStep = 0;
  const PREFILL_STEPS = 4;
  const prefill = () => {
    if (!active || active.id !== id) return;
    prefillStep += 1;
    handlers.onStep && handlers.onStep({
      id,
      chunk: '',
      done: false,
      phase: 'prefill',
      progress: prefillStep / PREFILL_STEPS,
    });
    if (prefillStep < PREFILL_STEPS) {
      timers.add(setTimeout(prefill, 40));
      return;
    }
    tick();
  };

  prefill();
  return id;
}