# Ceres surface preparation

This package prepares Dawn surface maps for Ceres. It is not registered in
`OBJECTS` and adds no route or runtime controller. It can be merged independently
of the shared wide-view work.

```sh
pnpm install --frozen-lockfile
node src/planets/ceres/tools/acquire.mjs
node src/planets/ceres/tools/prepare.mjs
node --test src/planets/ceres/test/surfaces.test.mjs
```

Acquisition downloads **10,783,718 bytes** for the two maps, checks their pinned
size and SHA-256, and reuses matching local files. Changed or corrupt sources fail
without being overwritten. `acquire.mjs --verify-only` checks local files without
network access. The original images and generated outputs are ignored by Git.
No other object's assets or global geometry download is needed.

## Sources

| Surface | Published product | Qualification |
| --- | --- | --- |
| Monochrome (`normal`) | [USGS Dawn FC global mosaic, 140 m/pixel](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_140m), sampled through its WMS at 4096 × 2048 | Visible-light grayscale imagery; not a natural-color composite or an unlit albedo map. |
| Enhanced color (`enhanced`) | [NASA PIA19977](https://science.nasa.gov/resource/hints-at-ceres-composition-from-color/), downloaded at 3078 × 1537 | False color from the 920, 750, and 440 nm filters; the red channel includes infrared. |

`source/manifest.json` records the exact acquisition URLs, dimensions, credit,
and checksums. `source/wms-capabilities.xml` retains the USGS layer description.
The WMS request explicitly covers 0–360° east and 90°N–90°S. The NASA image is
interpreted on that same global grid: Occator and the large craters line up
visually. This is a visual alignment check, not surveyed co-registration.

Both maps retain their published shadows, seams, and dark polar gaps. Nothing
fills missing coverage or invents surface color. Resizing the enhanced image to
4096 × 2048 does not increase its source resolution.

## Output for integration

`public/scenes/ceres/` contains six lossless WebP files: for each surface, a
4096 × 2048 equirectangular map, a 4160 × 3072 packed surface, and a 96 × 48
thumbnail. `src/planets/ceres/.prepared/surfaces.json` describes their dimensions,
URLs, source identities, and packing layout. It is generated, not another object
registry or a new runtime contract.

The packed surfaces use `packProjectiveSurfaceRaster`, exactly as Mercury does:
16 latitude bands, 32-pixel gutters, reversed rows within each band, and wrapped
longitude gutters. Only the canonical high-density surface is generated; its
selection must remain independent of device DPR when mounted.

## Remaining shared integration

At main commit `0528af69`, `preparePlanetarySystem` requires its observer in the
eight-planet orbit list. Ceres already has orbital and rotation data in
`@cssearth/astronomy`, but cannot yet be the observer through that preparation
path. Mercury's complete scene cannot simply be renamed to Ceres.

After JC generalizes that path, use these maps to prepare Ceres geometry, poles,
and lighting through the shared presentation/runtime contract; add its shell
content and registry entry; then publish its complete runtime asset inventory.
Full object/browser validation, including real Chrome at DPR 1 and 2, belongs to
that integration. This PR's source and pixel checks prove surface preparation
only, not a working Ceres scene.
