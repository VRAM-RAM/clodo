// Détection du backend « GPU ».
//
// Attention : la simple présence de `navigator.gpu` ne suffit pas. wllama
// n'active WebGPU que si l'exécution WebAssembly dispose de JSPI
// (`WebAssembly.Suspending`) ; sinon il retombe sur un backend CPU
// mono-thread (cf. « WebGPU is disabled on Firefox due to missing JSPI
// support »). On ne choisit donc wllama que si JSPI est réellement là.

function hasJspi() {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.Suspending === 'function';
}

export async function isGpuAvailable() {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (err) {
    return false;
  }
}

// Wllama utilisera-t-il vraiment le GPU (donc vaut-il mieux que le cœur Rust) ?
export async function isWllamaWebGpuUsable() {
  if (!hasJspi()) return false;
  return isGpuAvailable();
}
