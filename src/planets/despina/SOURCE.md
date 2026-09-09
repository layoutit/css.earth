# Despina sources and presentation

## Included: measured shape

The Shape model uses the **90 × 74 × 64 km semi-axes** fitted to Voyager images
by E. Karkoschka (2003), *Icarus* 162, 400–407,
[DOI: 10.1016/S0019-1035(03)00002-2](https://doi.org/10.1016/S0019-1035(03)00002-2).
These are measured overall dimensions, not a detailed terrain mesh. The longest
axis points towards Neptune under the synchronous-rotation approximation; the
shortest points north. Longitude is east-positive in the authored radius table.
`source/measurements.json` records the exact ellipsoid equation and 10° sampling;
`shape/ellipsoid.tab` includes matching seams and poles. Shared meshoptimizer
preparation reduces the sampled ellipsoid to a target of 480 native raster
triangles, with a 1.4 km meshoptimizer estimated-error setting. This is not an
exhaustive surface-deviation bound. No craters are invented.

The 74 km scene reference radius comes from NASA/NAIF PCK00011 BODY805 and the
pinned JPL Horizons physical record. PCK00011 gives only a spherical mean-radius
entry for Despina; **it is not the source of the three ellipsoid axes**. Body-fixed
orientation and rotation use IAU_DESPINA through the shared astronomy owner.

There is no qualified photographic surface coverage in this package.
`material/neutral.png` consists entirely of RGB 160 no-data sentinel samples;
`image-rgb-no-data` resolves validity before interpolation and the shared
`prepare-missing-coverage.mjs` renders the standard cartographic grid. The grid,
thumbnail, minimap and companion portrait all use this interpretation. Grid lines
are an indicator of unavailable surface observations, not measured features.
Flood curvature and directional Shadows remain available through shared lighting.
The 512 × 256 material resolution serves the grid, not a claim of spatial detail.

## Candidate survey, 2026-09-07

| Candidate | Outcome |
| --- | --- |
| [PDS Voyager ISS calibrated GEOMED archive](https://pds-rings.seti.org/voyager/iss/), OPUS Despina surface-geometry search | Inspected the best geometry-ranked frames C1135325, C1135319, C1135255, C1134547 and C1134350. Finest listed original image scale is about 17.15 km/pixel, a disc only about 8–12 pixels across after GEOMED resampling. Points, blur, optical response and illumination dominate; not used as mapped terrain. The search is pinned in `survey/opus-candidates.json`. |
| Karkoschka (2003) additional Despina images C1129447, C1130353 and C1135301 | Downloaded and inspected original GEOMED image bytes and labels. First two are long-trail images against strong Neptune glare; C1135301 offers only a tiny disc. Useful shape evidence in the published analysis, but not a qualified registered texture. The inspected calibration labels are retained; originals remain downloadable at the paths below. |
| [PDS Stooke shape collection](https://sbn.psi.edu/pds/resource/stkshape.html) and [USGS mapping](https://www.usgs.gov/special-topics/planetary-geologic-mapping) | No Despina terrain mesh, registered mosaic or elevation product was identified in these releases. An ellipsoid is not an Elevation dataset. |
| [Keck near-infrared photometry](https://www.sciencedirect.com/science/article/am/pii/S0019103524000629), Hubble and [JWST NIRCam spectral study](https://doi.org/10.3847/PSJ/adf325) | Disk-integrated measurements are relevant to surface composition and brightness, but are not spatial texture maps. No fabricated color/composition lens is added. The source survey does not claim these observations do not exist. |

GEOMED source URL pattern for these inspected images:
`https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DATA/C11353XX/C1135301_GEOMED.IMG`
(and matching `.LBL`; replace the five-digit directory and seven-digit image id
for other frames). Original imagery is calibrated linear I/F, but no deconvolution,
photometric recovery or shadow removal is asserted because these frames are not
being turned into surface texels. Querying only intended target Despina misses
these images; the moons were imaged in frames aimed at Neptune or its rings.

## Provenance and limits

NASA Science supplies the discovery and overview facts. JPL Horizons supplies
the physical/orbit reference record; the shared prepared ephemerides own motion.
The assumed synchronous rotation and ellipsoid do not recover an observed global
terrain model. The published axes carry measurement uncertainty, and the simple
ellipsoid cannot represent local irregularities beyond the fitted dimensions.

Common sky and title inputs retain their own pins and attribution: ESO/S. Brunier
Milky Way panorama under CC BY 4.0; HYG catalog under its bundled license;
Inter font under SIL OFL 1.1. Required source inputs are checked in or restored by
`source/preparation/acquisition.json`; prepared runtime assets install separately.
