# Lucy targets

The five Trojan primaries in this change use the existing observation-body recipe: source-constrained radial tables, meshoptimizer, 480 native raster triangles, prepared lighting and the normal missing-data grid. Shadows and orbit lines start off.

| Body | Full approximation dimensions (km) | Meaning |
| --- | --- | --- |
| Polymele | 27 × 24.4 × 10.4 | Published occultation ellipsoid; the pole assumes a circular, equatorial satellite orbit. |
| Leucus | 60.8 × 39.1 × 27.8 | Ellipsoid summary of the published light-curve/occultation reconstruction; irregular outline unresolved. |
| Orus | 70.7 × 63 × 51.4 | Ellipsoid summary of the published light-curve/occultation reconstruction. |
| Eurybates | 77.5 × 71.3 × 61.8 | Authored ellipsoid matching the reconstruction's reported extents; neither its original irregular shape nor its convex volume is reproduced. |
| Patroclus | 127 × 117 × 98 | Published primary-component approximation, consistent with the existing Menoetius package. |

Each package retains its source survey, formulas, physical-unit interpretation and unqualified details in `SOURCE.md` and `source/measurements.json`. Ellipsoid dimensions do not imply resolved terrain or measured surface reflectance. The user can see the approximation status beside the active body. Display longitudes are arbitrary; Polymele does not adopt an uncertain catalog spin period. Patroclus uses the existing primary-specific JPL#82 heliocentric state at the common scene epoch.

## Source preparation

`inputs.json` records the body-specific numerical extraction. `author.mjs` reproduces the radius tables, grid context images, source pins and authored capability files using the accepted shared recipe at base commit `e97ee953`. It is a source-authoring script, not a new renderer. Run it before scene preparation; `--refresh-pins` refreshes source digests without replacing prepared descriptors.

`navigation.mjs` renders the five new markers through the existing source-owned marker functions. It carries forward the checked-in base atlas for unchanged bodies after verifying that their source recipes are unchanged. Both atlas densities are repacked losslessly and checked pixel by pixel, avoiding another lossy encode of existing markers. `navigation-evidence.json` pins the input and output atlases. The normal full-source navigation preparer remains available when the existing source inputs are installed.

## Dinkinesh source gate

Dinkinesh was investigated as the sixth target. It is not silently represented by a generic sphere or a reconstructed ridge. The following primary sources were checked on 2026-09-08:

- [Bierhaus et al. (2025), PSJ 6, 299](https://doi.org/10.3847/PSJ/ae1968), section 2.2: a revised stereo/limb model, maximum extents 910 × 870 × 716 m, volume-equivalent diameter 738 m. Its unseen region uses physically constrained shape adjustments. The paper cites a detailed shape publication as in preparation; it does not contain an original mesh download.
- [Levison et al. (2024)](https://doi.org/10.1038/s41586-024-07378-0): the earlier stereo model uses an analytical fill for the unseen region. Its 719 m diameter must not be mixed indiscriminately with the later model.
- [Lucy PDS mission index](https://pds-smallbodies.astro.umd.edu/data_sb/missions/lucy/index.shtml): instrument image/calibration collections were found. No original Dinkinesh shape product was located in this checked index.
- [Archived Lucy DSK collection](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/lucy/lucy_spice/spice_kernels/dsk/) and [operational DSK directory](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/dsk/): the checked listings contain Donaldjohanson's kernel, not Dinkinesh's.
- [Celestia Content](https://github.com/CelestiaProject/CelestiaContent) identifies its Dinkinesh model as a contributor model, without a traceable original scientific reconstruction. It is not selected as scientific geometry.

This is an unresolved acquisition gate, not a claim that no model exists. The next step is an original released Dinkinesh mesh with its frame and scale, then the same existing mesh preparation. Maximum extents alone do not reproduce its top shape, ridge or volume. The known 52.67 h unresolved light-curve period must not be substituted for Dinkinesh's approximately 3.74 h primary spin.
