# Catalog sources

This directory is a vendored copy of galaxio's `packages/catalog`, the
zero-dependency TypeScript reader and writer for the `.gxct` packed-column
binary format that `data/catalogs` is stored in. It is published here as
`@cssearth/catalog`. Nothing under it is edited by hand.

- Upstream: `https://github.com/apresmoi/galaxio`, directory
  `packages/catalog`, MIT licensed. The exact upstream commit, sync date,
  file count, byte count, and per-file SHA-256 manifest are recorded in
  `upstream.json`.
- The whole package directory is vendored as galaxio tracks it: `package.json`,
  `README.md`, `AGENTS.md` (with its `CLAUDE.md` symlink), `FORMAT.md` (the
  byte-level spec), `tsconfig.json`, `tsup.config.ts`, `src/` (format, read,
  write, and the vitest test), and `scripts/` (the Python/TypeScript parity
  check). The test and the parity scripts are inert reference here: cssEarth
  has no vitest, and `scripts/gen_fixture.py` imports galaxio's Python
  pipeline, which is not vendored.
- Identity: the only edit on the way in is galaxio's identity becoming
  cssEarth's, and only in the package name and in prose. `package.json`'s
  `name` is `@cssearth/catalog`; `README.md` and `AGENTS.md` say
  `@cssearth/catalog` and link cssEarth where they linked Galaxio. Each
  rewritten file records both its vendored and upstream hash in
  `upstream.json`. Everything else is byte-identical to upstream.
- Upstream identity deliberately left in place: `FORMAT.md` and `AGENTS.md`
  cite the Python writer at `pipeline/galaxio_pipeline/formats/catalog.py`,
  a path into galaxio's pipeline that does not exist in cssEarth;
  `scripts/gen_fixture.py` imports `galaxio_pipeline`; `package.json` keeps
  galaxio's `repository`, `bugs`, and `homepage` URLs. These are paths, code,
  and statements of origin rather than prose naming.
- Sync: `node tools/sync-galaxio.mjs` re-copies this package,
  `packages/astronomy`, and `data/catalogs` from `GALAXIO_ROOT` in one run.
  See `packages/astronomy/SOURCE.md` for the sync and integrity contract; it
  is the same for both packages.
- No specifier rewrite is applied; `src/index.ts` imports `./x.js` for `./x.ts`
  files. The open decision on Node-side consumption is recorded in
  `upstream.json` under `importNote`.
