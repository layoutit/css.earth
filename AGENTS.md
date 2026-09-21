# cssEarth project contract

- Mount exactly one object scene at a time. Navigation entries navigate; they never coexist as rendered objects.
- Saturn is the accepted visual-quality reference. Shared input policy belongs in `site/runtime-policy.mts`; browser conformance proves common interaction behavior. Keep object-specific rendering facts inside each object package. Do not fabricate fallback scenes for planned objects.
- Keep one open-ended `OBJECTS` registry and one generic object adapter. The Sun, planets, and future moons, dwarf planets, asteroids, or other bodies use the same object contract. The fixed eight planet ids are a reporting filter, not a second registry or adapter.
- Use one shared world camera and navigation contract for every prepared object. Menu membership never limits rendering; new object types extend prepared capabilities rather than introduce separate page-based scene owners.
- Keep one shared application shell. Object packages supply content and supported capabilities, not shell markup, typography, navigation, or responsive behavior.
- Keep runtime DOM retained and stable. Prepare textures, atlases, scene state, lighting, weather, and other static work ahead of runtime.
- Runtime may decode and transport prepared state. It must not derive source data, geometry, charts, atlases, or scene assets.
- Select the canonical prepared dataset once for each mount, independent of device DPR. Earth city-level paging may change the bounded resident set of that dataset's prepared pages and resolution levels. A body may declare prepared surface texture levels that the shared selection swaps by projected silhouette size. Neither may generate geometry or imagery at runtime. Other object asset banks remain fixed after mount.
- Do not use runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas, or WebGL.
- SVG is allowed sparingly where it makes sense. Keep detailed body rendering in PolyCSS. Different SVG edge antialiasing is acceptable; preserve geometry, colors, line thickness, content, and interactions when optimizing.
- Preserve source/provenance files beside each planet and keep prepared outputs reproducible from the checked-in inputs. Each object's baked `prepared/runtime.json` and `prepared/scene.json` (or, for an object with no `runtime-assets.json`, its whole baked `prepared/` output) are published to R2 and restored by `pnpm setup:assets`/`setup:prepared`, not committed; keep the small `prepared-assets.json` inventory (filenames, bytes, sha256) tracked beside each object, and keep every other `prepared/*` contract file (`content.json`, `page.json`, …) tracked as before. A body's `prepared/provenance.json` is a build output: `tools/prepare-provenance.mts` generates it from the manifest, recipes and prepared inventory in `predev` and `prebuild`. It is never committed; the authored files are the record.
- Use source and runtime closure tests, object-package tests, router tests, and `OBJECTS`-derived browser conformance as proof. Do not duplicate those facts as declaration-only constants.

## TypeScript ownership

- Write application, preparation, tooling, test, executable fixture-helper, and capture implementations in strict TypeScript. Validate external values at runtime; do not replace runtime validation with type assertions or unchecked declaration files.
- Keep generated outputs and preserved vendor code in their source-owned formats. Existing JavaScript compatibility modules must only re-export their typed owners.
- Do not commit generated shell modules. Keep their sources and generators; `pnpm prepare:shell` must restore missing inputs and reproduce the outputs before consumers run.
- `pnpm check:typescript-ownership` enforces the remaining authored-JavaScript backlog and justified exceptions. Remove migrated or retired entries; do not add new implementation debt to make the check pass. Run `pnpm typecheck` and behavior/source checks appropriate to each migration.

## Provenance and documentation

- Follow [the provenance and documentation contract](docs/provenance/CONTRACT.md) for source records, credits and test evidence. It combines PDS4 1.26.0 provenance guidance with ISO 24495-1:2023 plain-language principles in the existing repository formats. PROVENANCE DOCUMENTATION maintains the shared instructions; contributors update the records affected by their change.
- For body work, use the checked-in [celestial skill](.agents/skills/celestial-skill/SKILL.md). Make the body README its source-and-evidence document: explain the datasets, processing, test results and known problems, with links to substantial method notes and original reports. Do not keep a duplicate SOURCE account. Keep installation and common usage in shared repo guides.
- Keep each report tied to the version it tested. When reusing an old result, explain why it still applies to the new version.
- Select local tests under the [PR check rules](docs/provenance/CONTRACT.md#pull-requests). Run affected checks, reuse valid passes and record unrelated failures once; do not launch every suite for an ordinary body addition.
- Keep `docs/` for maintained shared explanations and their illustrations. Put processing code in `tools/`, test fixtures in `tests/`, and body evidence beside the body. Keep scratch runs in ignored `output/`; do not commit PR completion reports.
- Before committing, inspect the staged diff, including added files and their sizes. Each added artifact must support a named claim, explanation or test. Follow the [PR rules](docs/provenance/CONTRACT.md#pull-requests) for the title and content, using the [PR template](.github/pull_request_template.md) as a starting point. Inspect every image on the published GitHub PR before handing it off.
