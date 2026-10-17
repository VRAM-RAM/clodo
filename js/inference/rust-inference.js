export async function handle_message_using_cpu(msg) {
    if (msg.type === 'load') {
        try {
            initSync({ module: msg.module });
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