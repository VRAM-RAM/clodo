// Copie `@wllama/wllama` depuis `node_modules` vers `js/vendor/wllama/`.
//
// wllama (index.min.js + wllama.wasm, ~8,7 Mo) n'est **pas** commité : il est
// installé via npm et copié ici par le hook `postinstall` (donc aussi en CI,
// via `npm ci`). Le site statique le sert depuis `js/vendor/wllama/`.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = join(root, 'node_modules', '@wllama', 'wllama');
const dest = join(root, 'js', 'vendor', 'wllama');

// [source, destination] — les noms de destination sont ceux attendus par
// `js/inference/wllama-inference.js` (import relatif + URL du `.wasm`).
const files = [
  ['esm/index.min.js', 'wllama.js'],
  ['esm/wasm/wllama.wasm', 'wllama.wasm'],
  ['LICENCE', 'LICENSE'],
];

if (!existsSync(pkg)) {
  console.error(
    `[vendor] @wllama/wllama introuvable dans node_modules (${pkg}).\n` +
      '[vendor] lance `npm install` avant de construire/servir le site.',
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

for (const [from, to] of files) {
  const src = join(pkg, from);
  if (!existsSync(src)) {
    console.error(`[vendor] fichier manquant : ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(dest, to));
  console.log(`[vendor] ${from} -> js/vendor/wllama/${to}`);
}
