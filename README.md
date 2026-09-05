# cssEarth 🪐

A 3D CSS planetary explorer. cssEarth renders planets as real HTML and CSS 3D
geometry through [PolyCSS](https://github.com/LayoutitStudio/polycss), without
a WebGL or canvas scene renderer. It preprocesses planetary data into
browser-ready textures, charts, and retained scene plans, then lets you orbit
and inspect one planet at a time.

Explore the live version: [css.earth](https://css.earth) 🪐

<img src="docs/css-earth.webp" alt="Saturn, Jupiter, and Mars rendered as retained HTML and CSS geometry in cssEarth" width="960">

## How to Build

Install the dependencies, restore the hash-pinned source inputs, prepare the
ignored browser assets, build the site, and serve it locally:

```sh
pnpm install
pnpm prepare:checkout
pnpm build
pnpm preview
```

## How It Works

cssEarth uses PolyCSS to turn planetary geometry into real HTML elements.
Faces, rings, moons, shadows, and atmosphere layers are positioned with CSS
`matrix3d(...)` transforms and textured with prepared CSS backgrounds instead
of being drawn to a `<canvas>`.

The shared shell loads the selected body from an open-ended object registry and
mounts one retained scene and one camera. Each object package owns its
scientific sources, textures, geometry, lighting, optional control content, and
material presentation. One shared runtime owns mounting, readiness, controls,
selection transactions, image residency, playback, camera binding, and cleanup.
All eleven clients bind the same factory. The shell owns navigation, information
panels, playback permission, and responsive behavior.
The [architecture](docs/shared-runtime-architecture-proposal.md) explains the
contract and the rendering differences that remain inside each package. The
[proof](docs/generic-runtime-contract-proof.md) uses the actual registered objects
in real Chrome at DPR 1 and 2.

## Build and Runtime

cssEarth separates source-backed preparation from browser playback. Node tools
turn checked OpenSpace, NASA, JPL, USGS, and other planet-owned inputs into
local images, generated scene modules, scientific charts, and prepared motion
banks. At runtime, the browser only loads and displays these prepared assets.

Large source binaries and generated browser assets are intentionally not
committed. Their URLs, sizes, hashes, provenance, preparation code, and runtime
inventories are committed. `prepare:checkout` restores the exact source bytes
and Earth's published geometry release, then generates `public/scenes/` locally.
The pinned worldwide release contains 19,632 packs (25.4 GB) outside Git and
`dist`. Acquisition resumes valid local packs and validates every replacement
before publishing it atomically to `.local/wmts-global/<version>/`.
See [Earth reproduction](docs/global-earth-coverage.md#reproduction-and-checks)
for acquisition and explicit geometry-authoring commands.

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
Earth's pinned geometry packs are included in its input verification.

Use `pnpm prepare:planets:full` for a full rebuild, including reproducibility
checks. Use `pnpm prepare:planets --object=saturn` to prepare one existing object,
or `--concurrency=2` to limit parallel work. Per-object timings and cache results
are recorded in `.local/preparation/latest-run.json`. Saturn's preparation
generates its normal material masters once and verifies them before composing
the complete scene.

Measured on the development Mac on 2026-09-05, the complete serial rebuild took
44m39s. Two forced builds with three workers took 18m24s and 19m28s and produced
identical outputs. The verified unchanged run took 44s with all eleven cache
entries reused; reading and hashing Earth's 25.4 GB input release took 38s of
that run. These are local measurements, not guaranteed build times.

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

Search includes the Sun, planets, Moon, and Pluto. The planet distance scale
remains a planet-only view derived from classification. To run every browser
gate against an isolated server, use `pnpm test:browser http://127.0.0.1:4211`.

## License and Data

cssEarth source code is [MIT licensed](LICENSE). Scientific data, imagery, and
prepared derivatives retain the terms and attribution of their respective
sources. See the planet-owned
[Mars](src/planets/mars/SOURCE.md) and
[Saturn](src/planets/saturn/SOURCE.md) source records for exact provenance,
presentation limits, and credits. NASA and other source credits do not imply
endorsement.
