# Js external libraries licenses

Why does *clodo* use `npm` & an integrated `/vendor/` directory ? Because
`wllama` is too huge to ship by hand, and because a project with a real
`package.json` is easier to keep tidy.

`wllama` (`@wllama/wllama`) is installed via `npm` and **not committed**. The
`postinstall` hook (`scripts/vendor-wllama.mjs`) copies `esm/index.min.js` and
`esm/wasm/wllama.wasm` into `js/vendor/wllama/` (`wllama.js` + `wllama.wasm`,
ignored by git), so both local dev and CI (`npm ci`) get the same files. The rest
of the vendored JS (`@ts-stack/markdown`) lives here too.

All the **Js-related** licenses are in this directory:

- `@ts-stack/markdown` — MIT (`ts-stack-markdown.LICENSE`) ;
- `@wllama/wllama` 3.8.1 — MIT (`wllama/LICENSE`, recopié depuis npm au
  `postinstall`) ;
- `npm` — licence propre (`npm.LICENSE`).
