# Catalogue sources

This directory is a vendored copy of galaxio's prepared point catalogues:
`.gxct` packed-column files in the format specified by
`packages/catalog/FORMAT.md` and read by `@cssearth/catalog`. Every catalogue
file is byte-identical to the upstream `data/catalogs/<name>` directory it was
copied from. Nothing here is edited by hand.

These are third-party datasets, not MIT-licensed software. Each catalogue has
its own terms and attribution requirements; they are spelled out in
`NOTICE.md` and the `LICENSE.*.md` files beside this one, and recorded per
catalogue in `upstream.json` under `catalogs.<name>.manifestEntry`.

## What is vendored

Eight of galaxio's ten catalogues, copied whole (every `v<N>` directory,
current and superseded) with the manifest entry each was published under:

| key | current file | rows | source | terms |
|---|---|---:|---|---|
| `catalogs/stars-hyg` | `stars-hyg/v1/stars-hyg.gxct` | 109 389 | HYG v4.4 (D. Nash / astronexus) | CC-BY-SA-4.0 |
| `catalogs/constellations-iau` | `constellations-iau/v1/constellations-iau.gxct` | 842 | Stellarium `modern_iau` sky culture; directions from HYG v4.4 | CC-BY-SA-4.0 |
| `catalogs/deepsky` | `deepsky/v2/deepsky.gxct` (v1 superseded, kept) | 13 963 | OpenNGC (Mattia Verga) | CC-BY-SA-4.0 |
| `catalogs/globulars` | `globulars/v1/globulars.gxct` | 157 | Harris (1996, 2010 edition) | free for use with attribution |
| `catalogs/nebulae-planetary` | `nebulae-planetary/v1/nebulae-planetary.gxct` | 593 | Gaia EDR3 matches to HASH planetary nebulae (Ali et al. 2022) | CDS VizieR terms of use |
| `catalogs/snr` | `snr/v1/snr.gxct` | 310 | Green's catalogue of Galactic supernova remnants, VizieR VII/297 | CDS VizieR terms of use |
| `catalogs/hii-regions` | `hii-regions/v1/hii-regions.gxct` | 8 399 | WISE Catalog of Galactic HII Regions (Anderson et al. 2014), VizieR J/ApJS/212/1 | CDS VizieR terms of use |
| `catalogs/exoplanets` | `exoplanets/v1/exoplanets.gxct` | 6 227 | NASA Exoplanet Archive, Planetary Systems table | Public Domain (U.S. Government work) |

`manifest.json` is the `catalogs/*` subset of galaxio's `data/manifest.json`
restricted to these eight entries, kept in galaxio's shape (`version`,
`assets`) so a consumer can resolve logical key → versioned path the way the
upstream engine does. Superseded versions (`deepsky/v1`) are carried because
the copy is directory-to-directory; nothing references them.

## What is deliberately excluded

- `catalogs/galaxies` (three versions, 23 MB; HyperLEDA/PGC 2003 VII/237,
  HyperLEDA HI radial velocities VII/238, and the McConnachie 2012 Local Group
  table J/AJ/144/4). Its published terms are "VizieR scientific-use terms;
  commercial redistribution of the pre-2021 AAS J/AJ/144/4 table requires
  permission". css.earth is a public site, so redistribution is deferred
  pending a licensing decision. It is not vendored until that is resolved.
  The upstream manifest entry is recorded in `upstream.json` under
  `excluded.galaxies` so the exclusion is auditable.
- `catalogs/nebula-imagery` (five versions, 48 KB). A 15-row placement index
  for galaxio's `textures/nebula-*` and `volumes/nebula-*` imagery assets,
  which are not vendored; without the imagery it places, the index is dead
  data. Its manifest entry is recorded under `excluded.nebula-imagery`.

## Provenance

galaxio does not commit its data: `data/` is gitignored and only
`data/manifest.example.json` is tracked. The catalogues are built by galaxio's
`pipeline/` (one builder per catalogue, named in `upstream.json` under
`catalogs.<name>.builder`) and published to its CDN. There is therefore no
upstream commit for the data itself. `upstream.json` records instead:

- `galaxioHeadCommit`: the galaxio checkout whose `data/catalogs` was copied,
  which is also the builder code that was checked out at the time;
- `upstreamManifest`: the SHA-256 and byte count of the `data/manifest.json`
  the entries were taken from;
- per catalogue: the manifest entry (source, terms URL, epoch, `built` date,
  row count, columns), the current file and its hash, and any superseded
  versions;
- per file: SHA-256 and byte count.

Reproducing a catalogue means running the named galaxio builder against the
sources its manifest entry cites; cssEarth carries no pipeline of its own for
this data, by design (runtime and preparation here consume prepared state,
they do not derive it).

## Sync and integrity

`node tools/ci/sync-upstream.mts` re-copies these catalogues together with
`packages/astronomy` and `packages/catalog` from `UPSTREAM_ROOT` (default: the
local galaxio checkout) in one idempotent run, and regenerates `upstream.json`
and `manifest.json`. `tools/sync-upstream.test.mjs` (run by
`pnpm test:platform`) asserts every file matches its recorded hash, no
unlisted file exists, every current file parses as a version-1 `.gxct` whose
row count and `meta` match its manifest entry, the excluded catalogues are
absent, and `NOTICE.md` states each vendored catalogue's terms, source, and
URL exactly as its manifest entry does.

No cssEarth consumer reads these files yet. Nothing in the build or the test
globs parses `.gxct`; Astro's `srcDir` is `site/` and `publicDir` is `public/`,
so `data/` is never bundled or served.
