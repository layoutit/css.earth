# Despina

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- The Shape model uses the **90 × 74 × 64 km semi-axes** fitted to Voyager images by E. Karkoschka (2003), *Icarus* 162, 400–407, [DOI: 10.1016/S0019-1035(03)00002-2](https://doi.org/10.1016/S0019-1035(03)00002-2).

- The 74 km scene reference radius comes from NASA/NAIF PCK00011 BODY805 and the pinned JPL Horizons physical record.

## Evidence

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

## Known problems

- These are measured overall dimensions, not a detailed terrain mesh. The longest axis points towards Neptune under the synchronous-rotation approximation; the shortest points north.

- There is no qualified photographic surface coverage in this package. `material/neutral.png` consists entirely of RGB 160 no-data sentinel samples; `image-rgb-no-data` resolves validity before interpolation and the shared `prepare-missing-coverage.mjs` renders the standard cartographic grid. Grid lines are an indicator of unavailable surface observations, not measured features.

- PCK00011 gives only a spherical mean-radius entry for Despina; **it is not the source of the three ellipsoid axes**. The published axes carry measurement uncertainty, and the simple ellipsoid cannot represent local irregularities beyond the fitted dimensions.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="despina-sources-and-presentation"></a>

## Included: measured shape

Longitude is east-positive in the authored radius table. `source/measurements.json` records the exact ellipsoid equation and 10° sampling; `shape/ellipsoid.tab` includes matching seams and poles. Shared meshoptimizer preparation reduces the sampled ellipsoid to a target of 480 native raster triangles, with a 1.4 km meshoptimizer estimated-error setting. This is not an exhaustive surface-deviation bound. No craters are invented.

Body-fixed orientation and rotation use IAU_DESPINA through the shared astronomy owner.

The grid, thumbnail, minimap and companion portrait all use this interpretation. Flood curvature and directional Shadows remain available through shared lighting. The 512 × 256 material resolution serves the grid, not a claim of spatial detail.

## Candidate survey, 2026-09-07

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

GEOMED source URL pattern for these inspected images: `https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DATA/C11353XX/C1135301_GEOMED.IMG` (and matching `.LBL`; replace the five-digit directory and seven-digit image id for other frames). Original imagery is calibrated linear I/F, but no deconvolution, photometric recovery or shadow removal is asserted because these frames are not being turned into surface texels. Querying only intended target Despina misses these images; the moons were imaged in frames aimed at Neptune or its rings.

## Provenance and limits

NASA Science supplies the discovery and overview facts. JPL Horizons supplies the physical/orbit reference record; the shared prepared ephemerides own motion. The assumed synchronous rotation and ellipsoid do not recover an observed global terrain model.

Required source inputs are checked in or restored by `source/preparation/acquisition.json`; prepared runtime assets install separately.

</details>
