// Wllama inference backend (WebGPU when available, otherwise CPU via wllama).
// Runs on the main thread; wllama spawns its own worker internally.
import { Wllama } from '../vendor/wllama/wllama.js';

let wllama = null;
let queue = [];
let done = false;
let abortController = null;

export async function initSync() {
  // wllama self-loads its wasm; nothing to do here
}

export async function model_load(bytes) {
  queue = [];
  done = false;
  abortController = null;

  if (wllama) {
    try {
      await wllama.exit();
    } catch (err) {
      console.warn('[clodo] wllama exit failed', err);
    }
    wllama = null;
  }

  const wasmUrl = new URL('../vendor/wllama/wllama.wasm', import.meta.url).href;
  wllama = new Wllama({ default: wasmUrl });

  const blob = new Blob([bytes]);
  await wllama.loadModel([blob], {
    n_ctx: 2048,
    n_gpu_layers: 99,
  });
}

export function model_status() {
  if (!wllama) return JSON.stringify({ size: 0, tensors: 0 });
  const meta = wllama.getModelMetadata ? wllama.getModelMetadata() : {};
  const size = 0; // size not tracked here (already known upstream)
  return JSON.stringify({ size, tensors: 0, meta });
}

export async function generate_start(messagesJson, maxTokens) {
  queue = [];
  done = false;
  abortController = new AbortController();

  let messages;
  try {
    messages = JSON.parse(messagesJson);
  } catch (err) {
    throw new Error('messages JSON invalide');
  }

  const max = Math.max(1, Math.min(maxTokens || 256, 1024));

  // Prefill step to match Rust path indicator
  const prefill = { chunk: '', done: false, phase: 'prefill', progress: 0 };
  queue.push(prefill);

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
        const choice = data?.choices?.[0];
        const delta = choice?.delta;
        const chunk = delta?.content || '';
        if (chunk) {
          queue.push({
            chunk,
            done: false,
            phase: 'generate',
            progress: 0,
          });
        }
        if (choice?.finish_reason) {
          done = true;
        }
      } catch (err) {
        console.warn('[clodo] wllama onData error', err);
      }
    },
  };

  try {
    await wllama.createChatCompletion(completionParams);
  } catch (err) {
    if (err?.name === 'WllamaAbortError') {
      done = true;
    } else {
      throw err;
    }
  }

  if (queue.length === 0) {
    done = true;
  }

  return JSON.stringify(queue.shift() || { chunk: '', done: true, phase: 'generate', progress: 1 });
}

export function generate_next() {
  if (queue.length > 0) {
    const step = queue.shift();
    return JSON.stringify(step);
  }
  if (done) {
    return JSON.stringify({ chunk: '', done: true, phase: 'generate', progress: 1 });
  }
  return JSON.stringify({ chunk: '', done: false, phase: 'generate', progress: 0 });
}

export function cancel() {
  done = true;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}