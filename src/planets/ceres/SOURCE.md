# Ceres sources

`source/manifest.json` pins acquisition URLs, byte counts, checksums, credits,
and consumers. Originals are acquired from their publishers, not other objects.

| Input | Source and use |
| --- | --- |
| Monochrome | [USGS Dawn FC global mosaic, 140 m/pixel](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_140m), sampled through WMS at 4096 × 2048 over 0–360° east, 90°N–90°S. Visible-light grayscale, not an unlit albedo map. |
| Enhanced color | [NASA PIA19977](https://science.nasa.gov/resource/hints-at-ceres-composition-from-color/), 3078 × 1537. False color from 920, 750, and 440 nm filters. Black south-polar regions have no coverage. |
| Sky | [ESO/S. Brunier panorama](https://www.eso.org/public/images/eso0932a/) and the checked HYG field snapshot, projected through the shared astrometric sky preparer. |
| Title | Pinned Inter variable font; shared title outline preparation. |
| Physical/orbit data | Vendored `@cssearth/astronomy` JPL body data, Kepler state vectors and IAU rotation. Mean radius 469.7 km; fixed geometry epoch 2026-09-04T00:00:00 TT. |
| Facts | [NASA Ceres facts](https://science.nasa.gov/dwarf-planets/ceres/facts/), summarized in `tools/prepare-content.mjs`: asteroid-belt location, Dawn observations, about nine hours per rotation, no moons. |

The maps share a global equirectangular grid. Their large craters align visually;
this is not a surveyed co-registration. Published shadows, seams, and polar gaps
are retained. Resampling does not add source detail or fill coverage.

Preparation creates 452 retained surface leaves, polar textures, a lighting
atlas, sky faces, and the shared heliocentric presentation. The mesh uses a
spherical mean radius; no resolved Ceres shape or elevation model is claimed.
The runtime only loads prepared assets and publishes shared view state.
