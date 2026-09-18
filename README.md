# css.earth 🌎

A 3D CSS astrovisualization platform. [css.earth](https://css.earth) renders celestial bodies as real HTML and CSS 3D geometry through [PolyCSS](https://github.com/LayoutitStudio/polycss), without a WebGL or canvas scene renderer. It preprocesses planetary data into browser-ready textures, charts, and retained scene plans, then lets you explore the universe.

Explore the live version: [css.earth](https://css.earth) 🔭

<img src=".github/assets/planets-contact-sheet.webp" alt="The eight planets, Mercury to Neptune, each rendered as DOM and CSS markup" width="960">

## What It Covers

css.earth has one route per object, and every object uses the same camera, so you can fly from a comet to Saturn to another galaxy without leaving the page.

- **The Solar System:** the Sun, the eight planets, 5 dwarf planets, about 100 moons, more than 300 asteroids, 32 comets and 17 other trans-Neptunian objects, all on their orbits. Where a mission photographed a body, its surface comes from that mission's images; the rest are shown as shape models.
- **Stars and exoplanets:** stars whose surfaces have been imaged, such as Betelgeuse and R Doradus, and planetary systems beyond the Sun, such as WASP-43, HD 189733 and TRAPPIST-1.
- **Interstellar visitors:** 'Oumuamua, Borisov and 3I/ATLAS.
- **Nebulae:** the Orion Nebula, the Crab, the Lagoon and the Helix, built as 3D volumes, plus the Pleiades cluster.
- **Galaxies:** the Milky Way, the Large Magellanic Cloud, Andromeda, Triangulum, the Local Group and the nearby universe.

Many objects have several dataset views, such as thermal, ultraviolet, radar or topography, each credited to its source.

<img src=".github/assets/solar-system.webp" alt="The inner Solar System out to Saturn, with orbits and labels, rendered as DOM and CSS markup" width="960">

<img src=".github/assets/milky-way-lmc.webp" alt="The Milky Way beside the Large Magellanic Cloud, rendered as DOM and CSS markup" width="960">

## How to Run

Use Node.js 24 (or 22.18+) and pnpm 10. Install dependencies, download the prepared assets once, and start the dev server:

```sh
pnpm install
pnpm setup:assets
pnpm dev
```

`pnpm install` builds the shared packages, the renderer and the preparation tools. `pnpm setup:assets` downloads the prepared browser images and each object's baked scene files, which Git does not track. `pnpm dev` serves the site on port 4210.

To work on one object, use `pnpm setup:assets --object=mars` and open `/mars/`. For a production build, run `pnpm build`, then `pnpm preview`.

Re-preparing an object from its original sources needs more: `pnpm prepare:checkout` restores the pinned source downloads, and some conversions call Python 3 with `numpy`. You do not need that to work on the shell, the renderer or the docs.

## How It Works

css.earth is built on the [PolyCSS](https://github.com/LayoutitStudio/polycss) 3D DOM rendering engine. Every body is a mesh of real HTML elements: faces are placed with CSS `matrix3d(...)` transforms and painted from prepared texture atlases. The page never draws the scene on a `<canvas>`, and it uses no CSS filters, masks or blend modes.

Each object is a data package under [`src/objects/<id>/`](src/objects/README.md). The package holds the pinned source inputs, the recipe that turns them into a scene, and a README that explains the datasets, the processing, the test results and the known problems. One `OBJECTS` registry and one shared camera serve every object, from Earth to a comet to a nebula, and only one object scene is mounted at a time.

Many objects offer more than one dataset view. Saturn, for example, has thermal and ultraviolet views beside its visible-light surface, and asteroids can show a spacecraft or telescope photograph cast onto their shape model.

## Build and Runtime

css.earth splits the work between a Node preparation step and a small browser runtime.

Preparation reads the original products: PDS and FITS images, shape models, SPICE kernels, star catalogues, interferometric and radio data, and published fact sheets. It checks each input against its pinned hash, then writes the textures, geometry, lighting, orbits, labels and page text for each object. The outputs are reproducible from the checked-in inputs, and each one records the sources it came from.

The browser does not derive geometry, textures or charts. It loads the prepared state for the selected object, mounts it into a retained DOM, and moves the camera. Earth is the one object that pages its prepared imagery in and out as you zoom towards city level.

## URL API

Every object has its own route, such as `/earth/`, `/saturn/` or `/comet-67p/`. A few query parameters open a specific view:

```text
https://css.earth/saturn/?dataset=ultraviolet     a dataset view
https://css.earth/sun/?overview=system            the Solar System overview
https://css.earth/sun/?overview=milky-way         the Milky Way
https://css.earth/sun/?focus=m42                  a nebula or galaxy, such as Orion
```

The share button writes a `v=` token that records the exact camera, zoom and time, so a link reopens the same view. Use it to reproduce bugs, compare screenshots and share a moment.

## Documentation

- [Adding a body](src/objects/README.md): package layout and the preparation steps.
- [Provenance and documentation contract](docs/provenance/CONTRACT.md): how sources, credits and evidence are recorded.
- [Documentation index](docs/README.md): surface preparation, interferometric imaging, eclipse mapping, navigation, performance and more.
- [Contributing](CONTRIBUTING.md): setup, which checks to run and where things live.
- [Celestial skill](.agents/skills/celestial-skill/SKILL.md): the workflow agents follow for body work.

## Publishing prepared assets (maintainers)

Prepared runtime files are served from an R2 bucket, content-addressed as `runtime-assets/<sha256>/<filename>`. Two small inventories are tracked in Git instead of the baked bytes: `runtime-assets.json` for the public browser textures, and `prepared-assets.json` for a body's `prepared/runtime.json` and `prepared/scene.json`, or a context or nebula object's whole `prepared/` output.

After baking, publish and commit the refreshed inventory:

```sh
node tools/publish-runtime-assets.mts --object=<id>
```

Omit `--object` to publish everything under `src/objects/`. The publisher is incremental: it checks every key first, uploads only the missing ones, then checks every key again, retries anything the bulk upload dropped, and byte-verifies every JSON key plus a sample of the rest. A publish that reports success has confirmed the files are live. JSON keys upload as `application/json`; everything else as `application/octet-stream`.

`node tools/check-assets-published.mts [--object=<id> ...]` checks both inventories without uploading. It retries a miss before reporting it: longest (about two minutes, two at a time) for a network error, which it reports by its socket code. With `--added-since=<git ref>` it checks only the keys the branch's inventories add; `--added-since-last-green` compares with the last green `main` run. Only a real 404 fails it; other answers and unverified (network) keys are warnings, and `--report-only` (a push to `main`) never fails. A nightly workflow checks every key.

A second cache, `source-cache/<sha256>/<filename>`, mirrors pinned publisher inputs from fragile upstreams, such as a facility volume preview or a USGS Gazetteer export, so a build never depends on a third party's uptime. `node tools/publish-source-cache.mts --object=<id>` publishes every pin it can find for that object; run `node tools/restore-source-inputs.mts --object=<id>` first. `--file=<path> --sha256=<hex> --bytes=<n>` publishes one file directly. It verifies after publishing in the same way. The three pinned VizieR galaxy-field catalogues (`src/objects/nearby-universe/source/catalogue.json`) are mirrored the same way with `--file=...`; `pnpm prepare:galaxy-field` tries that mirror first and only queries VizieR live on a miss, so an ordinary clean build never depends on VizieR's uptime.

Both scripts need an authenticated `wrangler`. Neither ever deletes a key.

`node tools/prune-runtime-assets.mts --dry-run` reports, and never deletes, the `runtime-assets/<sha256>/...` keys that are live in R2 but referenced by no current inventory. It never lists or reports on `scenes/` or `source-cache/`. It needs a separate read-only R2 API token, because `wrangler` cannot list a bucket's objects; the comment at the top of that file explains how to get and set one.

## License and Data

css.earth source code is [MIT licensed](LICENSE). Scientific data, imagery and prepared derivatives keep the terms and attribution of their sources. Each object's README lists its exact provenance, presentation limits and credits, for example [Mars](src/objects/mars/README.md) and [Saturn](src/objects/saturn/README.md). NASA and other source credits do not imply endorsement.
