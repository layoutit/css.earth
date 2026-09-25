# cssEarth project contract

This is the shared agent contract. `CLAUDE.md` is a symlink to this file;
directory-specific `AGENTS.md` files add guidance for their owners.

- Mount exactly one object scene at a time. Navigation entries navigate; they never coexist as rendered objects.
- Shared input policy belongs in `site/runtime-policy.mts`; browser conformance proves common interaction behavior. Keep object-specific rendering facts inside each object package. Do not fabricate fallback scenes for planned objects.
- Keep one open-ended `OBJECTS` registry and one generic object adapter. The Sun, planets, and future moons, dwarf planets, asteroids, or other bodies use the same object contract. The fixed eight planet ids are a reporting filter, not a second registry or adapter.
- Use one shared world camera and navigation contract for every prepared object. Menu membership never limits rendering; new object types extend prepared capabilities rather than introduce separate page-based scene owners.
- Keep one shared application shell. Object packages supply content and supported capabilities, not shell markup, typography, navigation, or responsive behavior.
- Keep runtime DOM retained and stable. Prepare textures, atlases, scene state, lighting, weather, and other static work ahead of runtime.
- Runtime may decode and transport prepared state. It must not derive source data, geometry, charts, atlases, or scene assets.
- Select the canonical prepared dataset once for each mount, independent of device DPR. A body may declare prepared surface texture levels that the shared selection swaps by projected silhouette size. Neither may generate geometry or imagery at runtime. Other object asset banks remain fixed after mount.
- With shadows off (flood lighting), every lighting and material lane shows one prepared frame, published as its own file. Lighting rows load only when shadows are on.
- Do not use runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas, or WebGL.
- SVG is allowed sparingly where it makes sense. Keep detailed body rendering in PolyCSS. Different SVG edge antialiasing is acceptable; preserve geometry, colors, line thickness, content, and interactions when optimizing.
- Bytes are the mobile reader's cost. Lossy images from the raster, terrestrial and cutaway lanes and Earth's texture
  levels go through the lossy lane (`src/preparation/raster/lossy-lane.ts`): WebP at one quality constant whose comment
  carries its measurement. Numeric and categorical images stay lossless. The lanes that still set their own quality are
  listed in [surface preparation](docs/surface-preparation.md#the-lossy-lane).
- Use the affected shared package, runtime, router and rendered-page tests, plus inspected browser evidence for changed interactions or appearance. Do not duplicate body facts as declaration-only constants. The [body guide](src/objects/README.md#sources-and-delivery) lists current commands and test owners.

## Sources and prepared delivery

- Preserve source records beside each body. Manifests and recipes identify inputs by path, provider product/version, acquisition route and source binding. Git records tracked bytes; missing downloads are restored by their origin or `source-cache/<object id>/<manifest path>`. Do not add file-stability hashes to tracked manifests, descriptors or recipes. Declared-file coverage is not download digest verification.
- `inventory.json` owns each published runtime file's location, filename, byte count and SHA-256. Nothing under an object's `prepared/` directory is tracked. Publish changed baked assets to R2 and commit the refreshed inventory; `pnpm setup:assets` or `pnpm setup:prepared` restores them.
- Follow `src/platform/runtime-asset-closure.mts` for inventory membership. `prepared/object.json` and `prepared/page.json` are regenerated from the installed runtime. Layered bodies also regenerate `prepared/provenance.json`; volume, image-layer and catalogue packages inventory and publish their baked provenance. Audit-only terrain reports and source-index rasters stay out of delivery inventories. Evidence cited by a maintained document belongs in `evidence/`.
- `pnpm prepare:object-json` restores transport and page metadata, republishes facts and regenerates layered-body provenance during development and builds. Source records and scientific qualification remain separate from this generated lineage.
- Preserve hashes where their existing owner needs them: runtime inventories, toolchain locks, historical evidence, and untracked processing results or telescope delivery receipts. Reuse/export checks on those results are not a reason to reintroduce manifest pins. Follow the [provenance contract](docs/provenance/CONTRACT.md) for evidence and the [publishing guide](CONTRIBUTING.md#publishing-prepared-assets-maintainers) for delivery.

## TypeScript ownership

- Write application, preparation, tooling, test, executable fixture-helper, and capture implementations in strict TypeScript. Validate external values at runtime; do not replace runtime validation with type assertions or unchecked declaration files.
- Keep generated outputs and preserved vendor code in their source-owned formats. Existing JavaScript compatibility modules must only re-export their typed owners.
- Do not commit generated shell modules. Keep their sources and generators; `pnpm prepare:shell` must restore missing inputs and reproduce the outputs before consumers run.
- `node tools/ci/typescript-ownership.mts` enforces TypeScript ownership and the explicit JavaScript exceptions in its inventory; `pnpm typecheck` includes it. Do not add implementation debt to make the check pass. Run behavior/source checks appropriate to each migration.

## Provenance and documentation

- Follow [the provenance and documentation contract](docs/provenance/CONTRACT.md) for source records, credits and test evidence. It combines PDS4 1.26.0 provenance guidance with ISO 24495-1:2023 plain-language principles in the existing repository formats. Contributors maintain the instructions and records affected by their change.
- For body work, use the checked-in [celestial skill](.agents/skills/celestial-skill/SKILL.md). Make the body README its source-and-evidence document: explain the datasets, processing, test results and known problems, with links to substantial method notes and original reports. Do not keep a duplicate SOURCE account. Keep installation and common usage in shared repo guides.
- Keep each report tied to the version it tested. When reusing an old result, explain why it still applies to the new version.
- Select local tests under the [PR check rules](docs/provenance/CONTRACT.md#pull-requests). Run affected checks, reuse valid passes and record unrelated failures once; do not launch every suite for an ordinary body addition.
- Keep `docs/` for maintained shared explanations and their illustrations. Put processing code in `tools/`, test fixtures in `tests/`, and body evidence beside the body. Keep scratch runs in ignored `output/`; do not commit PR completion reports.
- Before committing, inspect the staged diff, including added files and their sizes. Each added artifact must support a named claim, explanation or test. Follow the [PR rules](docs/provenance/CONTRACT.md#pull-requests) for the title and content, using the [PR template](.github/pull_request_template.md) as a starting point. Inspect every image on the published GitHub PR before handing it off.
