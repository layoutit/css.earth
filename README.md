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
scientific sources, textures, geometry, lighting, controls, and presentation
choices. The shell owns navigation, information panels, loading, lifecycle, and
responsive behavior.

## Build and Runtime

cssEarth separates source-backed preparation from browser playback. Node tools
turn checked OpenSpace, NASA, JPL, USGS, and other planet-owned inputs into
local images, generated scene modules, scientific charts, and prepared motion
banks. At runtime, the browser only loads and displays these prepared assets.

Large source binaries and generated browser assets are intentionally not
committed. Their URLs, sizes, hashes, provenance, preparation code, and runtime
inventories are committed. `prepare:checkout` restores the exact source bytes
and generates `public/scenes/` locally.

After preparation, verify the local source closure or regenerate the browser
assets with:

```sh
pnpm acquire:planets -- --verify-only
pnpm prepare:planets
```

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
