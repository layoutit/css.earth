# Catalogue sources

This directory holds prepared point catalogues: `.gxct` packed-column files in
the format specified by `packages/catalog/FORMAT.md` and read by
`@cssearth/catalog`. Nothing here is edited by hand.

These are third-party datasets, not MIT-licensed software. Each catalogue has
its own terms and attribution requirements; they are spelled out in
`NOTICE.md` and the `LICENSE.*.md` files beside this one, and recorded per
catalogue in `manifest.json` under `assets.<key>`.

## What is here

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

`manifest.json` resolves each logical key to its versioned path and records
the entry each file was published under: source, terms URL, epoch, build date,
row count and columns. The superseded `deepsky/v1` file is kept; nothing
references it.

## What is deliberately excluded

- `catalogs/galaxies` (HyperLEDA/PGC 2003 VII/237, HyperLEDA HI radial
  velocities VII/238, and the McConnachie 2012 Local Group table J/AJ/144/4).
  Its published terms are "VizieR scientific-use terms; commercial
  redistribution of the pre-2021 AAS J/AJ/144/4 table requires permission".
  css.earth is a public site, so redistribution is deferred pending a
  licensing decision.

## Provenance

The catalogues were prepared on 2026-09-02 by Juan Cruz Fortunatti's catalogue
builders, one per catalogue, which are not part of this repository. Each
manifest entry names the sources, terms, epoch and build date its builder used;
reproducing a catalogue means building it again from those sources. cssEarth
carries no pipeline of its own for this data, by design: runtime and
preparation here consume prepared state, they do not derive it.

The package tests (`pnpm --filter @cssearth/catalog test`, from the repository
root) exercise the reader and writer; they do not audit every file or its
attribution. The [package guide](../../packages/catalog/README.md) describes
the separate cross-language parity gap.
