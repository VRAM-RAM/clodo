// Wllama inference backend (WebGPU when available, otherwise CPU via wllama).
// Runs on the main thread; wllama spawns its own worker internally.
import { Wllama } from '../vendor/wllama/wllama.js';

let wllama = null;
let queue = [];
let done = false;
let error = null;
let abortController = null;

export async function initSync() {
  // wllama self-loads its wasm; nothing to do here
}

export async function model_load(bytes) {
  await dispose();

  const wasmUrl = new URL('../vendor/wllama/wllama.wasm', import.meta.url).href;
  wllama = new Wllama({ default: wasmUrl });

  const blob = new Blob([bytes]);
  await wllama.loadModel([blob], {
    n_ctx: 2048,
  });
}

// Préchauffage : la première inférence WebGPU compile les shaders (~3 tok/s
// pendant les premiers tokens). On l'absorbe pour que le premier vrai message
// soit déjà rapide. Appelé *après* que l'UI est passée en « prêt » (le bouton
// reste utilisable) ; une erreur est propagée au caller.
export async function warmup() {
  if (!wllama) return;
  await wllama.createChatCompletion({
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 8,
    temperature: 0,
  });
}

export function model_status() {
  if (!wllama) return JSON.stringify({ size: 0, tensors: 0 });
  let meta = {};
  try {
    meta = wllama.getModelMetadata ? wllama.getModelMetadata() : {};
  } catch (err) {
    console.warn('[clodo] wllama metadata failed', err);
  }
  const nLayer = meta && meta.hparams && meta.hparams.nLayer;
  const size = 0; // size not tracked here (already known upstream)
  return JSON.stringify({ size, tensors: typeof nLayer === 'number' ? nLayer : 0, meta });
}

export async function generate_start(messagesJson, maxTokens) {
  queue = [];
  done = false;
  error = null;

  if (!wllama) {
    throw new Error('modèle wllama non chargé');
  }

  let messages;
  try {
    messages = JSON.parse(messagesJson);
  } catch (err) {
    throw new Error('messages JSON invalide');
  }

  const max = Math.max(1, Math.min(maxTokens || 256, 1024));

  abortController = new AbortController();

  const completionParams = {
    messages,
    max_tokens: max,
    temperature: 0.7,
    top_k: 40,
    top_p: 0.9,
    stream: true,
    abortSignal: abortController.signal,
    onData: (data) => {
      try {
        const choice = data && data.choices && data.choices[0];
        const delta = choice && choice.delta;
        const chunk = (delta && delta.content) || '';
        if (chunk) {
          queue.push({ chunk, done: false, phase: 'generate', progress: 0 });
        }
        if (choice && choice.finish_reason) {
          done = true;
        }
      } catch (err) {
        console.warn('[clodo] wllama onData error', err);
      }
    },
  };

  // Fire-and-forget: with `stream` + `onData`, wllama's promise only resolves
  // once the *whole* completion is done. Awaiting it here would block the
  // first step until generation finishes (the UI would stay on "réfléchit…").
  // Instead we start it and let `onData` feed the queue drained by generate_next.
  Promise.resolve(wllama.createChatCompletion(completionParams)).catch((err) => {
    if (err && err.name === 'WllamaAbortError') {
      done = true;
    } else {
      error = err;
    }
  });

  return JSON.stringify({ chunk: '', done: false, phase: 'prefill', progress: 0 });
}

export function generate_next() {
  if (queue.length > 0) {
    return JSON.stringify(queue.shift());
  }
  if (error) {
    const err = error;
    error = null;
    done = true;
    throw err;
  }
  if (done) {
    return JSON.stringify({ chunk: '', done: true, phase: 'generate', progress: 1 });
  }
  return JSON.stringify({ chunk: '', done: false, phase: 'generate', progress: 0 });
}

export function cancel() {
  done = true;
  queue = [];
  error = null;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

// Libère le modèle wllama (mémoire wasm). Utilisé au repli vers le cœur Rust.
export async function dispose() {
  queue = [];
  done = true;
  error = null;
  abortController = null;
  if (wllama) {
    try {
      await wllama.exit();
    } catch (err) {
      console.warn('[clodo] wllama exit failed', err);
    }
    wllama = null;
  }
}
