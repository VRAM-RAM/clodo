export async function isGpuAvailable() {
    if (!navigator.gpu) return false;

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) return false;

    return true;
}