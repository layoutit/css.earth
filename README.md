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

Prepared runtime files (public browser textures via `runtime-assets.json`, and — since Phase 2 of the R2
migration — baked `prepared/*` output via `prepared-assets.json`: a body's `prepared/runtime.json` +
`prepared/scene.json`, or a context/nebula object's whole `prepared/` closure) are served from an R2 bucket,
content-addressed by `runtime-assets/<sha256>/<filename>`. Neither inventory is committed as its baked bytes —
only the small JSON inventory file is tracked; git no longer carries `prepared/runtime.json` or
`prepared/scene.json` for any object. `node tools/publish-runtime-assets.mts [--object=<id> ...]` publishes every
file either inventory kind describes for the given ids (omit `--object` to publish everything discovered under
`src/objects/`). It is incremental: it HEADs every key first and uploads only the misses (one `wrangler r2 object
put` per miss), then HEAD-verifies every key again, retries any miss the upload step somehow still left missing,
and byte-verifies every JSON key plus a sample of the rest — a publish that reports success has actually confirmed
the files are live, not just that the upload command exited 0. JSON keys upload as `application/json`; everything
else as `application/octet-stream`. `node tools/check-assets-published.mts [--object=<id> ...]` HEADs every key
from both inventories without uploading anything, and exits non-zero listing whatever is missing.

A second, smaller cache lives beside it at `source-cache/<sha256>/<filename>`: pinned publisher inputs (a facility
volume preview, a fragile-upstream archive such as a USGS Gazetteer nomenclature export) mirrored so a build never
depends on a third party's uptime. `node tools/publish-source-cache.mts --object=<id> [...]` publishes every such
pin this repository knows how to find for that object (skipping one that isn't present locally or doesn't match its
own hash — run `node tools/restore-source-inputs.mts --object=<id>` first); `--file=<path> --sha256=<hex>
--bytes=<n>` publishes one file directly. Same verify-after-publish contract as above.

Both scripts require `wrangler` to already be authenticated. Neither ever deletes a key.

## Contributing scientific data and evidence

Start with [adding a body](src/objects/README.md), the
[provenance and documentation contract](docs/provenance/CONTRACT.md), and the
[repository-owned celestial skill](.agents/skills/celestial-skill/SKILL.md).
The [documentation index](docs/README.md) separates maintained guidance from
historical qualification records. Source integrity, scientific interpretation,
visual acceptance and clean installation are distinct claims.
