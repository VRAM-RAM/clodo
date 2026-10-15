// Chargement du modèle et **service de génération**.
//
// Le modèle (GGUF, ~229 Mo) est téléchargé ici avec suivi de progression, puis
// remis à un Web Worker qui en **possède** une instance et exécute l'inférence.
// Ainsi le calcul lourd (~des centaines de ms par token en WASM) ne bloque
// jamais le thread principal : l'interface reste fluide.

import * as wllama from './inference/wllama-inference.js';
import { isGpuAvailable } from './inference/js-gpu-inference.js';

const GGUF_URL = 'https://huggingface.co/kurakurai/Luth-LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf';

let state = { status: 'idle', loaded: false, progress: 0, size: 0, tensors: 0, error: null, backend: null };
let demo = false;
let worker = null;
let listeners = new Set();
let genSeq = 0;
let active = null; // { id, handlers }
let watchdog = 0; // garde-fou : réveille le flux si le Worker meurt en silence

function clearWatchdog() {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = 0;
  }
}

function armWatchdog() {
  clearWatchdog();
  watchdog = setTimeout(() => {
    const current = active;
    if (!active) return;
    active = null;
    if (current.handlers.onError) {
      current.handlers.onError(new Error('Génération interrompue : le Worker ne répond plus.'));
    }
  }, 120000);
}

// Signale un échec du Worker à la génération en cours (le cas échéant).
function failActive(err) {
  if (!active) return;
  const { handlers } = active;
  active = null;
  clearWatchdog();
  if (handlers.onError) handlers.onError(err);
}

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
    const backend = state.backend === 'wllama' ? ' (GPU)' : state.backend === 'rust' ? ' (CPU)' : '';
    return `Modèle prêt${mo}${backend}.`;
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
    const message = (event && event.message) || 'erreur du Worker';
    console.error('[clodo] worker error', event);
    // Un Worker qui plante en pleine génération doit remonter à l'UI, pas
    // rester silencieux (sinon la bulle reste bloquée sur « réfléchit »).
    failActive(new Error(message));
    if (!state.loaded) {
      state = { ...state, status: 'error', loaded: false, error: message };
      emit();
    }
  };
  worker.onmessageerror = (event) => {
    console.error('[clodo] worker messageerror', event);
    failActive(new Error('Message invalide reçu du Worker'));
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
  if (msg.type === 'step') {
    armWatchdog();
    handlers.onStep && handlers.onStep(msg);
  } else if (msg.type === 'end') {
    clearWatchdog();
    active = null;
    handlers.onEnd && handlers.onEnd();
  } else if (msg.type === 'error') {
    clearWatchdog();
    active = null;
    handlers.onError && handlers.onError(new Error(msg.message));
  } else if (msg.type === 'cancelled') {
    clearWatchdog();
    active = null;
    handlers.onCancel && handlers.onCancel();
  }
}

/* Chargement                                                          */

const GGUF_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Télécharge le GGUF d'un seul flot (rapide). On retente le flot complet
// quelques fois en cas de coupure réseau, sans ralentir le cas nominal.
async function downloadGguf(onProgress) {
  let lastError;
  for (let attempt = 1; attempt <= GGUF_RETRIES + 1; attempt++) {
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
        onProgress(received, total);
      }
      if (total && received !== total) throw new Error(`flot incomplet (${received}/${total})`);

      const gguf = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        gguf.set(chunk, offset);
        offset += chunk.length;
      }
      return gguf;
    } catch (err) {
      lastError = err;
      if (attempt > GGUF_RETRIES) break;
      await delay(800 * attempt);
    }
  }
  throw lastError;
}

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
  const onProgress = (received, total) => {
    const now = performance.now();
    if (received < total && now - lastEmit < 100) return;
    lastEmit = now;
    state = { ...state, progress: total ? Math.min(received / total, 1) : 0, size: received };
    emit();
  };

  try {
    const gguf = await downloadGguf(onProgress);
    state = { ...state, progress: 1, size: gguf.length };
    emit();

    // Essaye wllama (WebGPU) si disponible, fallback vers le worker Rust
    const gpu = await isGpuAvailable();
    if (gpu) {
      try {
        await wllama.model_load(gguf);
        state = {
          ...state,
          status: 'ready',
          loaded: true,
          backend: 'wllama',
          progress: 1,
          size: gguf.length,
        };
        emit();
        return;
      } catch (err) {
        console.warn('[clodo] wllama load failed, falling back to rust worker', err);
      }
    }

    // Transfert sans copie du GGUF au worker.
    ensureWorker().postMessage({ type: 'load', module, gguf: gguf.buffer }, [gguf.buffer]);
    state = { ...state, backend: 'rust' };
    emit();
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
  active = { id, handlers, backend: state.backend };
  armWatchdog();

  if (state.backend === 'wllama') {
    const messagesJson = JSON.stringify(messages);
    wllama
      .generate_start(messagesJson, maxTokens)
      .then((firstStepJson) => {
        if (!active || active.id !== id) return;
        const step = JSON.parse(firstStepJson);
        handlers.onStep && handlers.onStep({ id, ...step });
        const pump = () => {
          if (!active || active.id !== id) return;
          const nextJson = wllama.generate_next();
          const next = JSON.parse(nextJson);
          if (next.done) {
            clearWatchdog();
            active = null;
            handlers.onEnd && handlers.onEnd();
            return;
          }
          handlers.onStep && handlers.onStep({ id, ...next });
          setTimeout(pump, 0);
        };
        pump();
      })
      .catch((err) => {
        if (!active || active.id !== id) return;
        clearWatchdog();
        active = null;
        handlers.onError && handlers.onError(new Error(String((err && err.message) || err)));
      });
    return id;
  }

  ensureWorker().postMessage({ type: 'generate', id, messages, maxTokens });
  return id;
}

export function cancelGeneration() {
  if (!active) return;
  if (active.demo) {
    const { handlers, timers } = active;
    active = null;
    clearWatchdog();
    for (const t of timers) clearTimeout(t);
    timers.clear();
    handlers.onCancel && handlers.onCancel();
    return;
  }
  clearWatchdog();
  if (active.backend === 'wllama') {
    try {
      wllama.cancel();
    } catch (err) {
      console.warn('[clodo] wllama cancel failed', err);
    }
    active = null;
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