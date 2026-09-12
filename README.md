# css.earth 🌎

A 3D CSS astrovisualization platform. [css.earth](https://css.earth) renders celestial bodies as real HTML and CSS 3D
geometry through [PolyCSS](https://github.com/LayoutitStudio/polycss), without
a WebGL or canvas scene renderer. It preprocesses planetary data into
browser-ready textures, charts, and retained scene plans, then lets you explore the universe.

Available at [css.earth](https://css.earth) 🪐

<img src="https://raw.githubusercontent.com/layoutit/cssEarth/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/css-earth.webp" alt="Saturn, Jupiter, and Mars rendered as retained HTML and CSS geometry in cssEarth" width="960">

## How to Build

Use Node.js 24 or Node.js 22.18+ and pnpm 10. Shared TypeScript entrypoints use
[native type stripping](https://nodejs.org/download/release/v22.18.0/docs/api/typescript.html#type-stripping),
and source preparation uses Node's native Zstandard support.

Install dependencies and download the prepared browser assets, then start the site:

```sh
pnpm install
pnpm setup:assets
pnpm dev
```

For Earth alone, use `pnpm setup:assets --object=earth` and open `/earth/`.
Setup resumes existing files and verifies them against the checked-in runtime
inventories. Running the prepared globe does not require source imagery,
preparation tools or the retained 25.4 GB geographic release. The current Earth
package does not enable city search, WorldCover paging or the noise lens.

To build all routes for production, run `pnpm setup:assets`, `pnpm build`, then
`pnpm preview`. To regenerate assets from source instead, run
`pnpm prepare:checkout`; that is the full preparation workflow described below.

## Checks

With Node 22.18+ or Node 24 and the pinned pnpm version, first run
`pnpm install --frozen-lockfile --ignore-scripts` in a fresh checkout. Then
`pnpm check:ci` runs the command steps from the GitHub workflow locally.
It verifies the dependency installation, prepares required
inputs, and stops at the first failed check. `pnpm check:ci --list` shows the
exact commands. It uses your current checkout; GitHub still verifies Ubuntu.

`pnpm typecheck` checks the shared packages, renderer, preparation, shell, tooling,
tests, executable fixtures and capture scripts. `pnpm check:typescript-ownership` rejects new
authored JavaScript and stale migration entries. See the
[TypeScript ownership policy](docs/architecture/typescript-ownership.md) for the
remaining backlog and justified JavaScript exceptions.

`pnpm test` runs package, renderer, platform, and shell behavior tests. It does
not reconstruct bodies or verify the full archive of scientific source files.

`pnpm test:browser` uses the existing server on **4210** for the shared body
and navigation checks at DPR 1 and DPR 2. It never starts a server or saves a
screenshot matrix. To check one body, use
`pnpm test:browser http://localhost:4210 mimas`.

Source acquisition verification (`pnpm acquire:planets -- --verify-only`),
preparation tests (`pnpm test:preparation`), prepared body data tests
(`pnpm test:planets`), and extended interaction conformance
(`pnpm test:browser:conformance`) are separate, explicit commands for changes
that need them. Source/preparation checks require their declared raw inputs.
For a camera or lens lifecycle change, focus conformance with
`pnpm test:browser:conformance http://localhost:4210 mimas`.
SEO and Earth delivery diagnostics also reuse an existing server; they never
launch a private Astro instance or rewrite the renderer.

## How It Works

cssEarth uses PolyCSS to turn planetary geometry into real HTML elements.
Faces, rings, shadows, and atmosphere layers are positioned with CSS
`matrix3d(...)` transforms and textured with prepared CSS backgrounds instead
of being drawn to a `<canvas>`.

The shared shell loads the selected body from an open-ended object registry and
mounts one retained scene and one camera. Each object package owns its
scientific sources, textures, geometry, lighting, optional control content, and
material presentation. One shared runtime owns mounting, readiness, controls,
selection transactions, image residency, playback, camera binding, and cleanup.
Registered body packages consume prepared JSON through the shared TypeScript
CSS renderer and generic object adapter. The shell owns
navigation, information panels, playback permission, and responsive behavior.

Registered bodies share the prepared world-navigation contract. Selecting a
body flies the shared physical camera to its prepared target. The next fixed
asset bank loads during flight;
the current detailed scene is released before the destination mounts. The
document and shell persist. Back restores the saved camera and playback state;
camera input interrupts flight at the last drawn view. Existing object routes
and compact `?v` links remain supported, including translated camera positions.
The [implementation map](.agents/skills/celestial-skill/references/implementation-map.md)
locates the current preparation, renderer and shell code. Earlier
[runtime ownership checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/generic-runtime-contract-proof.md) cover an
eleven-object version at the revisions recorded there.

## Build and Runtime

cssEarth separates source-backed preparation from browser playback. Node tools
turn checked OpenSpace, NASA, JPL, USGS, and other planet-owned inputs into
local images, generated scene modules, scientific charts, and prepared motion
banks. At runtime, the browser only loads and displays these prepared assets.

Body packages use authored JSON capabilities and parameters with shared
preparation families. Reusable geometry and pixel operations live in the objects
package; CSS compilation and file/image I/O stay in application adapters.
The recipe selects each body's supported capabilities.

```text
src/planets/<id>/
├── object.json                  Pinned capability recipe and transport digest
├── source/                      Authored JSON, scientific inputs and provenance
├── prepared/                    Baked JSON, committed for clean checkouts
│   ├── *.refs.json              Runtime, scene and sky with shared banks referenced
│   ├── runtime.json, scene.json, sky.json   Restored full files (Git-ignored)
│   └── object.json              Rebuilt runtime payload (Git-ignored)
├── runtime-assets.json          Reproducible asset inventory
├── README.md                    Sources, processing, evidence and known problems
└── NOTICE.md, LICENSE.*             Credits and licences
packages/objects/src/            Generic schema, geometry and pixel operations
src/preparation/                 Node image/file adapters
src/renderers/css/preparation/   CSS projection and retained presentation compiler
tests/objects/                   Object fixtures and browser/scientific regression tests
```

`pnpm install` builds packages and preparation tools, then assembles the small
transport JSON beside each object from its committed preparation output. It does not rebake textures.

Shared shell title, icon, overview-title and wordmark modules are Git-ignored.
`pnpm prepare:shell` regenerates them from committed vectors and recipes, restoring
the hash-pinned font if missing. Installation, development, builds, asset setup
and the root test command run this step automatically.

To regenerate one body after changing its authored inputs, run
`pnpm prepare:planets -- --object=<id>`. The selected recipe validates source
pins and regenerates its prepared outputs.

Large reacquirable source binaries and generated browser assets are generally
kept outside Git; retained source exceptions remain pinned and documented. Their URLs, sizes, hashes, provenance, preparation code, and runtime
inventories are committed. `pnpm setup:assets` downloads the prepared outputs from
immutable URLs on the project asset CDN. After changing prepared outputs,
maintainers publish their updated inventories with `pnpm publish:runtime-assets`
(or `--object=earth`) before pushing the code that references them.

`prepare:checkout` restores source bytes and generates `public/scenes/` locally.
This full-source command still restores Earth's retained 19,632-pack geographic
release (25.4 GB), although the current globe does not use it. Normal
`setup:assets` installs only prepared browser assets. The release's earlier
[reproduction record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/global-earth-coverage.md#reproduction-and-checks)
remains available as source history.

The vendored astronomy package (`packages/astronomy`, see its `SOURCE.md`) is
a preparation dependency only. It is consumed through its own build, which
`pnpm install` runs as `postinstall` (`pnpm build:astronomy` repeats it);
`pnpm prepare:planets` builds it first, and `pnpm prepare:solar-geometry`
regenerates the checked-in `src/platform/solar-geometry.mts` from it
bit-for-bit. The browser runtime never loads it.

Surface minimaps are separate prepared WebP images, at most 640 pixels wide
for the sidebar at DPR 2. Object preparation writes them under
`prepared/minimaps/`; `pnpm prepare:surface-minimaps` refreshes them from existing
normalized maps or raster sources. The sidebar never downloads the HD globe map
for its preview.

After preparation, verify the local source closure or regenerate the browser
assets with:

```sh
pnpm acquire:planets -- --verify-only
pnpm prepare:planets
```

Preparation uses the same object registry as the application. Independent object
chains run in parallel, with a conservative limit based on available CPU and
memory. Unchanged objects reuse prepared files only after their source, generator,
toolchain, and output hashes have been verified. Missing or changed output files
rebuild their object. A changed shared generator invalidates affected caches.

Use `pnpm prepare:planets:full` for a full rebuild, including reproducibility
checks. Use `pnpm prepare:planets --object=saturn` to prepare one existing object,
or `--concurrency=2` to limit parallel work. Per-object timings and cache results
are recorded in `.local/preparation/latest-run.json`. Saturn's preparation
generates its normal material masters once and verifies them before composing
the complete scene.

The [September 2026 preparation measurements](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/README.md#build-and-runtime)
cover the earlier eleven-object version. They are not build-time estimates for
the current registry.

The existing NASA description collection is prepared separately and committed
under `data/planets/`. Other objects may own their source snapshots and parsers;
this importer is not a condition of the object contract:

```sh
pnpm prepare:planet-info -- saturn
pnpm prepare:planet-info
```

The importer validates NASA's record identity and structured content schema.
It does not fall back to scraping rendered webpages. Pluto uses checked,
object-owned NASA and JPL sources, without adding another registry entry here.

## License and Data

cssEarth source code is [MIT licensed](LICENSE). Scientific data, imagery, and
prepared derivatives retain the terms and attribution of their respective
sources. See the planet-owned
[Mars](src/planets/mars/README.md) and
[Saturn](src/planets/saturn/README.md) source records for exact provenance,
presentation limits, and credits. NASA and other source credits do not imply
endorsement.

## Contributing scientific data and evidence

Start with [adding a body](src/planets/README.md), the
[provenance and documentation contract](docs/provenance/CONTRACT.md), and the
[repository-owned celestial skill](.agents/skills/celestial-skill/SKILL.md).
The [documentation index](docs/README.md) separates maintained guidance from
historical qualification records. Source integrity, scientific interpretation,
visual acceptance and clean installation are distinct claims.
