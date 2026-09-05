# Astronomy sources

This directory is a byte-identical vendored copy of `@galaxio/astronomy`, the
zero-dependency TypeScript package that owns time scales, float64 vectors, the
reference-frame tree, VSOP87A planetary series, ELP2000 lunar series, Keplerian
satellite and dwarf-planet elements, IAU rotation models, and their accuracy
records. Nothing here is edited by hand.

- Upstream: `https://github.com/apresmoi/galaxio`, directory
  `packages/astronomy/src`, MIT licensed. The exact upstream commit, sync date,
  file count, byte count, and per-file SHA-256 manifest are recorded in
  `upstream.json`.
- The whole package is vendored: the library modules, the VSOP87A and ELP2000
  coefficient data under `data/`, the Horizons and rotation fixtures under
  `__fixtures__/`, and the vitest test files. The test files are inert
  reference here; cssEarth has no vitest and does not run them.
- Sync: `node tools/sync-astronomy.mjs` re-copies the tree from
  `GALAXIO_ASTRONOMY_SRC` (default: the local galaxio checkout), refuses a
  dirty upstream subtree unless `--allow-dirty` is passed, carries the licence
  across to `LICENSE.GALAXIO-MIT`, and regenerates `upstream.json`. Re-running
  against an unchanged upstream is a no-op.
- Integrity proof: `tools/sync-astronomy.test.mjs` (run by `pnpm test:platform`)
  asserts every vendored file matches its manifest hash and no unlisted file
  exists, so a local edit fails loudly instead of diverging from upstream.
- No specifier rewrite is applied. The source imports `./x.js` for `./x.ts`
  files; Vite and Astro resolve that, Node does not. The open decision on
  Node-side consumption is recorded in `upstream.json` under `importNote`.
- Remaining upstream identity references live inside code
  (`modelAccuracy.ts` string constants naming Galaxio and its
  `ARCHITECTURE.md`) and are deliberately left as-is.
