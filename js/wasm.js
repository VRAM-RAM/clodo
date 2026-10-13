// Accès WASM du **thread principal**.
//
// Ici on ne charge pas le modèle : on se sert du cœur Rust uniquement pour le
// **stockage** des conversations (localStorage encapsulé côté Rust). Le modèle
// vit dans le Web Worker (voir `model.js` / `worker.js`).
//
// `init()` compile le module WebAssembly une seule fois et le renvoie : il est
// ensuite partagé avec le worker, qui l'instancie de son côté sans recompiler.

let runtime = null;

const STORE_KEY = 'clodo.demo.store.v1';
let mem = null;

function loadMem() {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    mem = [];
  }
  return mem;
}

function saveMem() {
  localStorage.setItem(STORE_KEY, JSON.stringify(mem));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function summary(c) {
  return { id: c.id, title: c.title, updated: c.updated };
}

// Persistance de secours si le cœur WASM n'est pas compilé.
function demoApi() {
  return {
    ping() {
      return 'clodo wasm alive (demo)';
    },
    chat_list() {
      const list = loadMem()
        .slice()
        .sort((a, b) => b.updated - a.updated)
        .map(summary);
      return JSON.stringify(list);
    },
    chat_new() {
      const c = { id: uid(), title: 'New chat', messages: [], updated: Date.now() };
      loadMem().push(c);
      saveMem();
      return JSON.stringify(c);
    },
    chat_get(id) {
      const c = loadMem().find((x) => x.id === id);
      if (!c) throw new Error('conversation not found');
      return JSON.stringify(c);
    },
    chat_append(id, role, content) {
      const c = loadMem().find((x) => x.id === id);
      if (!c) throw new Error('conversation not found');
      c.messages.push({ role, content });
      if (role !== 'assistant' && c.title === 'New chat') c.title = content.slice(0, 40);
      c.updated = Date.now();
      saveMem();
      return JSON.stringify(c);
    },
    chat_rename(id, title) {
      const c = loadMem().find((x) => x.id === id);
      if (!c) throw new Error('conversation not found');
      c.title = title;
      saveMem();
    },
    chat_delete(id) {
      mem = loadMem().filter((x) => x.id !== id);
      saveMem();
    },
  };
}

async function compileWasm() {
  const url = new URL('../pkg/clodo_bg.wasm', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`wasm introuvable (HTTP ${response.status})`);
  const type = response.headers.get('content-type') || '';
  if (typeof WebAssembly.compileStreaming === 'function' && type.includes('wasm')) {
    try {
      return await WebAssembly.compileStreaming(response.clone());
    } catch {
      /* retombe sur la compilation buffer */
    }
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

async function init() {
  if (runtime) return runtime;
  try {
    const mod = await import('../pkg/clodo.js');
    const module = await compileWasm();
    mod.initSync({ module });
    runtime = {
      demo: false,
      module,
      api: {
        ping: mod.ping,
        chat_list: mod.chat_list,
        chat_new: mod.chat_new,
        chat_get: mod.chat_get,
        chat_append: mod.chat_append,
        chat_rename: mod.chat_rename,
        chat_delete: mod.chat_delete,
      },
    };
  } catch (err) {
    console.warn('[clodo] pkg/ absent — exécution en MODE DÉMO.', err);
    runtime = { demo: true, module: null, api: demoApi() };
  }
  return runtime;
}

export { init };
