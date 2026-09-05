# Astronomy sources

`@cssearth/astronomy` is the zero-dependency TypeScript package that owns time
scales, float64 vectors, the reference-frame tree, VSOP87A planetary series,
ELP2000 lunar series, Keplerian satellite and dwarf-planet elements, IAU
rotation models, and their accuracy records. It is the author's own code,
maintained in another of his projects and mirrored into this directory by a
sync. Nothing under it is edited by hand.

- Origin: the mirror's source repository, directory, commit, sync date, file
  count, byte count, and per-file SHA-256 manifest are recorded in
  `upstream.json`. That file is an engineering record so the mirror can be
  refreshed and drift detected; it is not a third-party attribution (see
  its `origin` field). The licence is MIT, copyright Juan Cruz Fortunatti,
  in `LICENSE`.
- The whole package directory is mirrored as the source tracks it:
  `package.json`, `README.md`, `AGENTS.md`, `tsconfig.json`,
  `tsup.config.ts`, the library modules under `src/`, the VSOP87A and ELP2000
  coefficient data under `src/data/`, the Horizons and rotation fixtures under
  `src/__fixtures__/`, the vitest test files, and the generator scripts under
  `tools/`. The gitignored `tools/.cache/` download cache is not source
  material and is not copied. The test files are inert reference here;
  cssEarth has no vitest and does not run them.
- Not mirrored (`upstream.json` under `excludedFiles`): the source's
  `CLAUDE.md` symlink to `AGENTS.md`. Claude Code loads `CLAUDE.md` per
  directory, so carrying it would silently apply the other project's operator
  instructions to any session working here.
- Identity: the only edit on the way in is the other project's identity
  becoming cssEarth's (`upstream.json` under `identityRules`): the package
  name and repository URLs in `package.json`; `@cssearth/astronomy`, the
  project link, and the frame-tree documentation reference in `README.md`
  and `AGENTS.md`; and, in `src/modelAccuracy.ts`, the `PROJECT_SOURCE_URL`
  documentation URL and the two `'cssEarth … convention/definition'` source
  labels. Those two rules match string literals only; no behaviour changes.
  Each rewritten file records both its mirrored and source hash in
  `upstream.json` under `files`. Everything else — code, import specifiers,
  data, fixtures, tools — is byte-identical to the source.
- Sync: `node tools/sync-upstream.mjs` re-copies this package,
  `packages/catalog`, and `data/catalogs` from `UPSTREAM_ROOT` (default: the
  local checkout of the source project named in `upstream.json`) in one run.
  It refuses a dirty source subtree unless `--allow-dirty` is passed, carries
  the licence across to `LICENSE`, and regenerates `upstream.json`. Re-running
  against an unchanged source is a no-op, and the identity rules are part of
  the sync, so a re-sync cannot reintroduce the other project's identity.
- Integrity proof: `tools/sync-upstream.test.mjs` (run by `pnpm test:platform`)
  asserts every mirrored file matches its manifest hash, no unlisted file
  exists, the excluded files are absent, only the listed files carry an
  identity rewrite (and in `src/` only `modelAccuracy.ts`, only by the two
  string rules), and no file in this directory names the other project apart
  from the provenance fields of `upstream.json`. A local edit fails loudly
  instead of diverging from the source.
- Workspace: `pnpm-workspace.yaml` lists `packages/*`, so `@cssearth/astronomy`
  resolves as a workspace package. No cssEarth consumer imports it yet;
  `tools/prepare-solar-geometry.mjs` still reads a separately built copy
  through its own environment override (see that script).
- No specifier rewrite is applied. The source imports `./x.js` for `./x.ts`
  files; Vite and Astro resolve that, Node does not. The open decision on
  Node-side consumption is recorded in `upstream.json` under `importNote`.
