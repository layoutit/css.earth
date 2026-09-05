# Catalog sources

`@cssearth/catalog` is the zero-dependency TypeScript reader and writer for
the `.gxct` packed-column binary format that `data/catalogs` is stored in. It
is the author's own code, maintained in another of his projects and mirrored
into this directory by a sync. Nothing under it is edited by hand.

- Origin: the mirror's source repository, directory, commit, sync date, file
  count, byte count, and per-file SHA-256 manifest are recorded in
  `upstream.json`. That file is an engineering record so the mirror can be
  refreshed and drift detected; it is not a third-party attribution (see
  its `origin` field). The licence is MIT, copyright Juan Cruz Fortunatti,
  in `LICENSE`.
- The whole package directory is mirrored as the source tracks it:
  `package.json`, `README.md`, `AGENTS.md`, `FORMAT.md` (the byte-level
  spec), `tsconfig.json`, `tsup.config.ts`, `src/` (format, read, write, and
  the vitest test), and `scripts/check-parity.mjs`. The test and the parity
  script are inert reference here: cssEarth has no vitest, and the parity
  check needs the Python writer, which lives in the external catalogue
  pipeline, not in this repository.
- Not mirrored (`upstream.json` under `excludedFiles`): `scripts/gen_fixture.py`,
  which imports that external pipeline and so cannot run here; and the
  source's `CLAUDE.md` symlink to `AGENTS.md`, which Claude Code would load
  per directory as operator instructions.
- Identity: the only edit on the way in is the other project's identity
  becoming cssEarth's (`upstream.json` under `identityRules`): the package
  name and repository URLs in `package.json`; `@cssearth/catalog` and the
  project link in `README.md` and `AGENTS.md`; and the Python writer's
  location in `README.md`, `AGENTS.md`, and `FORMAT.md`, which now say it is
  in the external catalogue pipeline instead of citing a path that does not
  exist in this repository. Each rewritten file records both its mirrored and
  source hash in `upstream.json`. Everything else is byte-identical to the
  source.
- Sync: `node tools/sync-upstream.mjs` re-copies this package,
  `packages/astronomy`, and `data/catalogs` from `UPSTREAM_ROOT` in one run.
  See `packages/astronomy/SOURCE.md` for the sync and integrity contract; it
  is the same for both packages.
- No specifier rewrite is applied; `src/index.ts` imports `./x.js` for `./x.ts`
  files. The open decision on Node-side consumption is recorded in
  `upstream.json` under `importNote`.
