# Astronomy sources

This directory is a vendored copy of galaxio's `packages/astronomy`, the
zero-dependency TypeScript package that owns time scales, float64 vectors, the
reference-frame tree, VSOP87A planetary series, ELP2000 lunar series, Keplerian
satellite and dwarf-planet elements, IAU rotation models, and their accuracy
records. It is published here as `@cssearth/astronomy`. Nothing under it is
edited by hand.

- Upstream: `https://github.com/apresmoi/galaxio`, directory
  `packages/astronomy`, MIT licensed. The exact upstream commit, sync date,
  file count, byte count, and per-file SHA-256 manifest are recorded in
  `upstream.json`.
- The whole package directory is vendored as galaxio tracks it: `package.json`,
  `README.md`, `AGENTS.md` (with its `CLAUDE.md` symlink), `tsconfig.json`,
  `tsup.config.ts`, the library modules under `src/`, the VSOP87A and ELP2000
  coefficient data under `src/data/`, the Horizons and rotation fixtures under
  `src/__fixtures__/`, the vitest test files, and the generator scripts under
  `tools/`. The gitignored `tools/.cache/` download cache is not upstream
  material and is not copied. The test files are inert reference here;
  cssEarth has no vitest and does not run them.
- Identity: the only edit on the way in is galaxio's identity becoming
  cssEarth's, and only in the package name and in prose. `package.json`'s
  `name` is `@cssearth/astronomy`; `README.md` and `AGENTS.md` say
  `@cssearth/astronomy` and link cssEarth where they linked Galaxio. Each
  rewritten file records both its vendored and upstream hash in
  `upstream.json` under `files`, and the rule set under `identityRules`.
  Everything else — code, import specifiers, data, fixtures, tools — is
  byte-identical to upstream.
- Upstream identity deliberately left in place, because it is code or a
  true statement of origin rather than prose: `src/modelAccuracy.ts` names
  Galaxio in `PROJECT_SOURCE_URL` and two `'Galaxio … convention'` labels;
  `package.json` keeps galaxio's `repository`, `bugs`, and `homepage` URLs.
- Sync: `node tools/sync-galaxio.mjs` re-copies this package, `packages/catalog`,
  and `data/catalogs` from `GALAXIO_ROOT` (default: the local galaxio
  checkout) in one run. It refuses a dirty upstream subtree unless
  `--allow-dirty` is passed, carries the licence across to
  `LICENSE.GALAXIO-MIT`, and regenerates `upstream.json`. Re-running against
  an unchanged upstream is a no-op.
- Integrity proof: `tools/sync-galaxio.test.mjs` (run by `pnpm test:platform`)
  asserts every vendored file matches its manifest hash, no unlisted file
  exists, and no file outside `package.json`, `README.md`, and `AGENTS.md`
  carries an identity rewrite, so a local edit fails loudly instead of
  diverging from upstream.
- Workspace: `pnpm-workspace.yaml` lists `packages/*`, so `@cssearth/astronomy`
  resolves as a workspace package. No cssEarth consumer imports it yet;
  `tools/prepare-solar-geometry.mjs` still reads the galaxio build through
  `GALAXIO_ASTRONOMY_URL`.
- No specifier rewrite is applied. The source imports `./x.js` for `./x.ts`
  files; Vite and Astro resolve that, Node does not. The open decision on
  Node-side consumption is recorded in `upstream.json` under `importNote`.
