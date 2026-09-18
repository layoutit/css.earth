# css.earth 🌎

A 3D CSS astrovisualization platform. [css.earth](https://css.earth) renders celestial bodies as real HTML and CSS 3D
geometry through [PolyCSS](https://github.com/LayoutitStudio/polycss), without
a WebGL or canvas scene renderer. It preprocesses planetary data into
browser-ready textures, charts, and retained scene plans, then lets you explore the universe.

## License and Data

cssEarth source code is [MIT licensed](LICENSE). Scientific data, imagery, and
prepared derivatives retain the terms and attribution of their respective
sources. See the planet-owned
[Mars](src/objects/mars/README.md) and
[Saturn](src/objects/saturn/README.md) source records for exact provenance,
presentation limits, and credits. NASA and other source credits do not imply
endorsement.

## Publishing prepared assets (maintainers)

Prepared runtime files (public browser textures via `runtime-assets.json`, and baked `prepared/*` output via
`prepared-assets.json`: a body's `prepared/runtime.json` + `prepared/scene.json`, or a context/nebula object's
whole `prepared/` closure) are served from an R2 bucket, content-addressed by `runtime-assets/<sha256>/<filename>`.
Neither inventory is committed as its baked bytes — only the small JSON inventory file is tracked; git no longer
carries `prepared/runtime.json` or `prepared/scene.json` for any object. `node tools/publish-runtime-assets.mts
[--object=<id> ...]` publishes every file either inventory kind describes for the given ids (omit `--object` to
publish everything discovered under `src/objects/`). It is incremental: it HEADs every key first and bulk-uploads
only the misses (`wrangler r2 bulk put`, batched by content type and retried on a transient failure), then
HEAD-verifies every key again, retries any miss that bulk upload silently dropped one at a time, and byte-verifies
every JSON key plus a sample of the rest — a publish that reports success has actually confirmed the files are
live, not just that the upload command exited 0. JSON keys upload as `application/json`; everything else as
`application/octet-stream`. `node tools/check-assets-published.mts [--object=<id> ...]` HEADs every key from both
inventories (re-checking a miss up to 3 more times with backoff before reporting it, since a single HEAD can miss
transiently) without uploading anything, and exits non-zero listing whatever is still missing; with
`--changed-since=<git ref>`, a miss in an object the current branch's own diff against that ref did not touch only
warns instead of failing, so an unrelated pre-existing gap cannot block an otherwise unrelated change.

A second, smaller cache lives beside it at `source-cache/<sha256>/<filename>`: pinned publisher inputs (a facility
volume preview, a fragile-upstream archive such as a USGS Gazetteer nomenclature export) mirrored so a build never
depends on a third party's uptime. `node tools/publish-source-cache.mts --object=<id> [...]` publishes every such
pin this repository knows how to find for that object (skipping one that isn't present locally or doesn't match its
own hash — run `node tools/restore-source-inputs.mts --object=<id>` first); `--file=<path> --sha256=<hex>
--bytes=<n>` publishes one file directly. Same verify-after-publish contract as above. The three pinned VizieR
galaxy-field catalogues (`src/objects/nearby-universe/source/catalogue.json`) are mirrored the same way via
`--file=...`; `pnpm prepare:galaxy-field` tries that mirror first and only falls back to a live VizieR query on a
miss, so an ordinary clean build never depends on VizieR's uptime.

Both scripts require `wrangler` to already be authenticated. Neither ever deletes a key.

`node tools/prune-runtime-assets.mts --dry-run` reports (never deletes) which `runtime-assets/<sha256>/...` keys are
live in R2 but referenced by no current inventory; it never lists or reports on `scenes/` or `source-cache/`. It
needs a separate, read-only R2 API token (`wrangler` itself has no way to list a bucket's objects) — see the
comment at the top of that file for how to obtain and set one.

## Contributing scientific data and evidence

Start with [adding a body](src/objects/README.md), the
[provenance and documentation contract](docs/provenance/CONTRACT.md), and the
[repository-owned celestial skill](.agents/skills/celestial-skill/SKILL.md).
The [documentation index](docs/README.md) separates maintained guidance from
historical qualification records. Source integrity, scientific interpretation,
visual acceptance and clean installation are distinct claims.
