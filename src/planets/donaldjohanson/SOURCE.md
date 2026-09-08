# Donaldjohanson sources

## Selection and coverage

The unchanged Lucy/DLR DSK lcy_donj_k548_iso20m_v10.bds contains 274000 vertices and 547996 triangular plates in kilometers. Mottola and Preusker built the source OBJ on 2025-06-04; the archived DSK was generated on 2025-06-24. Its PDS label, DSK comments, coordinate-system description and Marchi et al. (2026) paper are pinned beside the package.

- Original release: https://naif.jpl.nasa.gov/pub/naif/pds/pds4/lucy/lucy_spice/spice_kernels/dsk/lcy_donj_k548_iso20m_v10.bds
- Coordinate system: https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.mission:document-v2.0/Donaldjohanson_Coordinate_System_Description_v1.pdf
- Research: https://www2.boulder.swri.edu/~bottke/Reprints/Marchi_2026_Science.aec0503._DJ_Asteroid.pdf
- Mission data survey: https://pds-smallbodies.astro.umd.edu/data_sb/missions/lucy/index.shtml

Lucy stereo imaging constrains about 40% of the surface. The source authors completed the unseen side with a two-ellipsoid contact fit and symmetry, then refined it against observed contours. This reconstruction is preserved as released; it does not imply measured terrain on the unseen hemisphere. The model spans 8.821632 by 4.411234 by 3.096368 km and encloses 58.292109 cubic km, consistent with the paper's approximate 8.8 by 4.4 by 3.1 km and 58 cubic km. The 2.405325 km reference radius is computed from the released volume and does not rescale source coordinates.

The survey found resolved L’LORRI imagery and published textured visualizations, but no registered downloadable surface map paired with this mesh. Shape uses the shared missing-imagery grid. No photograph, reflectance, regolith or color model is fabricated.

## Frame and supported views

The source coordinate description explicitly limits its preliminary linear attitude model to the Lucy encounter at 2025-04-20T17:51:16 UTC because free precession is unmodeled. Marchi et al. (2026) report lightcurve periods of 252.6 ± 0.4 and 455.2 ± 0.9 hours. They are informational facts, not a propagated attitude. The package reuses the fixed illustrative display-orientation recipe used by Toutatis; directional lighting is illustrative. Horizons supplies the heliocentric orbital context at the shared epoch.

The original mesh has 729 face centroids whose radius differs from the nearest surface on their ray, by up to 400.124075 m. A separate 8192-direction scan found no second intersections, showing why that sparse scan alone cannot establish a single-valued radial field. Only Shape is exposed; a radial Elevation lens would omit local overlapping surfaces.

## Existing preparation path

CSPICE exports the original vertices and plate connectivity without resampling. The existing source-meshoptimizer path with RegularizeLight produces one closed outward-wound 800-face component, Euler characteristic 2, with no opposite-face cancellation. The selected 56 m simplifier tolerance yields a 55.827515 m estimate. Independent 8192-sample nearest-triangle comparisons in both directions have maxima 77.123801 m and 74.843535 m; these are sampled distances, not an exhaustive geometric bound or observational uncertainty. The reduced volume is 57.212292 cubic km. Original/reduced front, back and polar renders are retained for visual inspection.

The scene uses 800 native PolyCSS u raster leaves, 128 px cells and baked directional/flood lighting. Meshes, grids, atlases and lighting are prepared offline; runtime consumes retained prepared data.

## Reproduction

Build preparation tools with pnpm build:preparation. Restore the original DSK, article and shared inputs using node tools/objects/dist/operations.js acquire donaldjohanson. The checked gzip OBJ is reproducible with python tools/objects/acquisition/export-dsk.py src/planets/donaldjohanson/source/shape/lcy_donj_k548_iso20m_v10.bds src/planets/donaldjohanson/source/shape/lcy_donj_k548_iso20m_v10.obj.gz using spiceypy==7.0.0. Prepare with node tools/objects/dist/prepare-authored.js donaldjohanson --write. Runtime installation uses pnpm setup:assets --object=donaldjohanson independently of source preparation.

On the qualification host, Node fetch rejects the SWRI article certificate chain. The original DSK and other source inputs restore through the recorded plan. The article restored with curl using normal HTTPS certificate validation, and its bytes matched the manifest SHA-256. If affected, restore source/reference/donaldjohanson-2026.pdf using curl -fL with the recorded paper URL before acquisition. This is an external reference-download limitation, not a claim that the entire plan restores unattended.
