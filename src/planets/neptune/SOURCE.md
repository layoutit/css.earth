# Neptune source record

The Neptune adapter is built from committed, checked source bytes. Runtime code
does not fetch or interpret any source material.

## Planet surface and observation lenses

The visible-detail globe is the 2025 Hubble OPAL Cycle 32 colour global map
assembled by the OPAL team from WFC3/UVIS F467M, F547M, and F657N exposures.
The OPAL readme declares that the TIFF is arbitrarily scaled and contrast
enhanced, so
the normal lens does not publish those display values as literal true colour.
Preparation matches the mean and channel variation of a checked equatorial OPAL
sample to the unobscured central region of the 2024 Irwin et al. true-colour
Neptune reconstruction distributed by the Royal Astronomical Society. The
calibration reference is committed under `source/color/` with CC BY 4.0
attribution. The methane lens uses the matching FQ619N global map and the
near-infrared lens uses F845M. Their checked FITS and TIFF products, plus the
OPAL readme, are in `source/opal/`. Preparation converts them to fixed runtime
rasters; the browser does not parse FITS, TIFF, or the calibration reference.

The OPAL global maps contain no observed samples north of approximately +30
degrees latitude for this observing geometry. Preparation extends the checked
+30-degree boundary row toward that row's longitudinal mean at the pole. This
source-derived coverage treatment supplies no new storm or cloud detail. It is
recorded in the prepared scene and happens only during preparation.

Each lens is mapped across 452 retained projective PolyCSS surface leaves:
448 ordinary face leaves and four prepared polar leaves. A projective `<s>`
material leaf in the same retained PolyCSS scene supplies only a transparent
prepared directional-light and atmospheric-limb overlay. Sharing the scene
lets moons, rings, the atmosphere, and the body depth-sort as one 3D system.
Its per-lens limb chromaticity is derived from the brightest quintile of the
checked prepared source and normalized during preparation. It contains no
full-color planet surface or source texture detail. The 452 retained face
leaves remain the visible surface owner. No ordinary image element or
planet-sized background `<div>` is generated or mounted.

Preparation also emits 256 fixed material views for each lens as 16 local row
shards. Runtime chooses a prepared address and publishes it to the retained
material leaf. It only selects and decodes canonical high-density lens and
material assets; it performs no source projection, lighting, filtering, or
raster work.

## Shape, satellites, and rings

The OpenSpace Neptune asset files are pinned to commit
`56e29b54b8592084ff1fef47c2e08de0b22ce516`. They establish the 24,764 km
equatorial and 24,314 km polar radii and identify the authoritative SPICE
kernel lineage. JPL Solar System Dynamics discovery, mean-elements, and
physical-parameter tables supply the prepared 16-moon catalog. The PDS Rings
Node Neptune table supplies the prepared ring radii and widths.

The eight detailed-moon orbit guides are prepared into local SVG image assets
and mounted as retained `<s>` leaves using the same generic orbit-guide
mechanism as Saturn. The remaining eight cataloged moons keep their prepared
orbit and body transforms without adding decorative guide geometry.

Moon dots use a Neptune-owned lossless bitmap atlas generated during scene
preparation. Each frame uses the committed JPL physical radius to select its
presentation diameter, with the former fixed base, inset-shadow, and glow
colors rasterized ahead of runtime. Runtime mounts the canonical DPR 2 atlas,
independent of device DPR, and only assigns the prepared atlas address and
frame position. The DPR 1 atlas remains checked in for a later payload pass.

## Atmosphere, facts, and sky

The two panel charts are prepared from the committed NASA GSFC Planetary
Spectrum Generator configuration and raw I/F response. The panel prose and
facts are prepared from the committed NASA Science `Neptune: Facts` snapshot.
The background is prepared from a checked HYG Stellar Database v4.1 subset;
its orientation is explicitly illustrative because the scene does not claim an
absolute observer epoch or inertial camera orientation.

`source/manifest.json` binds every retained source and document by byte count,
SHA-256, origin, credit, licence, acquisition route, and consumer. Run
`node src/planets/neptune/tools/acquire.mjs --verify-only` to verify it.
