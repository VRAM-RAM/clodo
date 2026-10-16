// Web Worker : il possède **seul** le modèle (GGUF quantifié) et exécute
// l'inférence. Celle-ci est synchrone et lente (~centaines de ms par token) :
// la sortir du thread principal est ce qui garde l'interface fluide
// (animations, saisie, défilement) pendant que le modèle « réfléchit ».
//
// Le Worker ne touche **pas** au stockage : la persistance des conversations
// reste sur le thread principal (voir `wasm.js` / `chat.js`). Ici on ne fait
// que : charger le modèle, puis générer du texte à partir de messages.

import clodoInit, { model_load, model_status, generate_start, generate_next } from '../pkg/clodo.js';

const cancelled = new Set();

// Les messages sont traités **séquentiellement** : une génération occupe
// l'unique état `ACTIVE` côté Rust, on ne peut donc pas en lancer deux en
// parallèle. `cancel` est traité immédiatement (hors file) pour pouvoir
// interrompre la génération en cours entre deux pas.
let chain = Promise.resolve();

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }
  chain = chain.then(() => handle(msg)).catch(() => {});
};

async function handle(msg) {
  if (msg.type === 'load') {
    try {
      await clodoInit({ module_or_path: msg.module });
      model_load(new Uint8Array(msg.gguf));
      const status = JSON.parse(model_status());
      self.postMessage({ type: 'ready', size: status.size, tensors: status.tensors });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.type === 'generate') {
    const { id, messages } = msg;
    try {
      let step = JSON.parse(generate_start(JSON.stringify(messages), msg.maxTokens || 256));
      postStep(id, step);
      while (!step.done) {
        // Rend la main au worker pour pouvoir recevoir un éventuel 'cancel'.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled.has(id)) {
          cancelled.delete(id);
          self.postMessage({ type: 'cancelled', id });
          return;
        }
        step = JSON.parse(generate_next());
        postStep(id, step);
      }
      self.postMessage({ type: 'end', id });
    } catch (err) {
      self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
    }
  }
}

function postStep(id, step) {
  self.postMessage({
    type: 'step',
    id,
    chunk: step.chunk,
    done: step.done,
    phase: step.phase,
    progress: step.progress,
  });
}
