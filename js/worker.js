// Web Worker : il possède **seul** le modèle (GGUF quantifié) et exécute
// l'inférence. Celle-ci est synchrone et lente (~centaines de ms par token) :
// la sortir du thread principal est ce qui garde l'interface fluide
// (animations, saisie, défilement) pendant que le modèle « réfléchit ».
//
// Le Worker ne touche **pas** au stockage : la persistance des conversations
// reste sur le thread principal (voir `wasm.js` / `chat.js`). Ici on ne fait
// que : charger le modèle, puis générer du texte à partir de messages.

import { initSync, model_load, model_status, generate_start, generate_next } from '../pkg/clodo.js';
import { isGpuAvailable } from './js-gpu-inference.js';
import { handle_message_using_cpu } from './rust-inference.js';

const cancelled = new Set();

// Les messages sont traités **séquentiellement** : une génération occupe
// l'unique état `ACTIVE` côté Rust, on ne peut donc pas en lancer deux en
// parallèle. `cancel` est traité immédiatement (hors file) pour pouvoir
// interrompre la génération en cours entre deux pas.
let chain = Promise.resolve();

self.gpuAvailable = await isGpuAvailable();

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }
  chain = chain.then(() => handle(msg)).catch(() => {});
};

async function handle(msg) {
  if (self.gpuAvailable) {
    console.log("TODO!")
    return;
  } else {
    handle_message_using_cpu(msg)
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
