# Didymos sources and interpretation

## Selected shape

Daly, T., Barnouin, O., Ernst, C., Nair, H., Espiritu, R., and Waller, D. (2023), *DART Shapemodel Archive Bundle*, NASA PDS, DOI [10.26007/96fn-p578](https://doi.org/10.26007/96fn-p578). The Didymos v003 collection has DOI [10.26007/bm57-x327](https://doi.org/10.26007/bm57-x327). [Browse the released collection](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_didymos_model_v003/).

The checked acquisition plan restores the unmodified `didymos_g_9309mm_spc_obj_0000n00000_v003.obj`: 24,578 vertices, 49,152 triangles, 9.309 m mean spacing. This is the final Didymos model released by DART, derived from DRACO and LICIACube LUKE images using stereophotoclinometry. The archive also releases 4.657, 2.329 and 1.165 m versions. The selected released resolution is finer than the collection's stated approximately 14 m Cartesian accuracy uncertainty and provides adequate detail before the 800-face display simplification; mean spacing is not measurement accuracy. The source volume is 0.2033564365122846 km³ and source XYZ bounds are approximately −387.43…430.81 m, −361.11…440.34 m, and −337.93…266.55 m.

The source is closed but not equally observed everywhere. The SIS says smooth areas lack image coverage and sigma zero can mean one or no contributing images. It reports approximately 3.3% volume uncertainty for this collection. We retain these source constraints, not invented craters or an ellipsoid replacement.

## Coordinates, scale and lighting

OBJ positions are kilometers in the released body-fixed frame; east-positive longitude, planetocentric latitude, and +Z toward the spin pole. The original coordinates and origin are retained without recentering, axis stretching or radial re-meshing. The mean/reference radius used for physical display scale is 365 m from the shape-coordinate document; it is not the source maximum radius.

The shape-specific coordinate document, `didymos_coordinate_system_description_v1.pdf`, Table 2, gives ICRF pole RA 66.83°, Dec −73.0° and spin 3823°/day (2.26000523 h). That document has copy-editing errors in its title, some Dimorphos labels and its ellipsoid c value; our selection uses the clearly stated Didymos shape ID, its pole and period, and the actual mesh scale. The later mission PCK15 gives a revised pole and 355.15 m volume-equivalent radius from a different orbit/physical solution. It is retained as comparison evidence and is not used to silently rotate or rescale the selected mesh. The pole is source-bound; current prime-meridian phase is not claimed. The authored observed-pole contract selects an explicit arbitrary display phase. Prepared Sun lighting uses that display orientation and the application's fixed heliocentric epoch, not a current surface-phase ephemeris.

## Views and preparation

- **Shape** uses the shared no-imagery grid over the released terrain. It is a scientific shape model without observed surface imagery, not a photograph or measured surface albedo. Shadows default off; prepared directional lighting remains available through the control.
- **Elevation** is source radius minus a 365 m reference sphere, in meters (−120 to +90 m display scale), with prepared cartographic relief. It includes whole-body flattening and the equatorial ridge; it is not height above a gravitational equipotential.

The existing source-meshoptimizer recipe preserves original connectivity before simplifying with meshoptimizer 1.2.0 `ErrorAbsolute` and `RegularizeLight`, target 800 faces, 8 m allowed library error estimate. Its 800 faces form a closed single genus-zero surface. The estimate is 6.285758 m; this is not an exhaustive physical-error bound. A separate 2,592-direction ray comparison (5° latitude/longitude spacing, half-cell offsets) measures mean 1.64899 m, 95th percentile 3.96109 m and maximum 7.01284 m radial error from the selected source model. The simplified volume is 0.200421741 km³, about 1.44% below the selected source volume. These are display approximation errors, distinct from source uncertainty.

Each triangle uses the shared native PolyCSS `u` primitive with 128 px raster sizing. Shared preparation owns normals, per-texel atlas sampling, lighting and navigation context; runtime retains the prepared DOM. Source maps preserve detail independently of mesh reduction. The existing shared orthographic snapshot owner generates the 512 px context image from this geometry and the shared grid at longitude 0°, latitude 35°, with full-phase ambient 0.45 and diffuse 0.55.

## Bounded source survey (2026-09-07)

| Candidate | Disposition and reason |
| --- | --- |
| [DART final Didymos v003 OBJ series](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_didymos_model_v003/) | Included. Direct original mesh, source labels and SIS; the 9.309 m release is adequate for the selected display budget. Higher nominal-resolution versions share the source accuracy/coverage limitations. |
| [Didymos relative-albedo facet tables](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_didymos_model_v003/didymos_g_9309mm_spc_alb_0000n00000_v003.xml) | Deferred useful dataset, not absent. The sampled 49,152-row FITS binary table contains relative reflectance 0.77720–1.35861 and uncertainty 0–0.21540, with many unobserved/singly observed regions encoded as 1 and sigma 0. Current FITS observation support expects byte image grids, not facet attributes. A future view needs source-facet registration and validated coverage; rendering it as an ordinary equirectangular image would be incorrect. |
| [Derived topography, slope, gravity and tilt products](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/document/dart_shapemodel_sis.pdf) | Deferred. These are scientifically distinct, but gravity/topography depend on uniform-density assumptions and the rotation model, and share the facet-table decoding requirement. The current Elevation lens explicitly uses a reference sphere instead. |
| [DRACO calibrated image archive](https://pdssbn.astro.umd.edu/data_sb/missions/dart/index.shtml) and LUKE inputs linked by the shape archive | Excluded as a runtime photographic lens in this package. Calibrated camera images have partial coverage and acquisition lighting and are not a global registered map. The shape-coordinate PDF retains useful actual-image references. No unsupported RGB composition or terrain fill is authored. |
| [NAIF DART global DSK](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/dart/dart_spice/spice_kernels/dsk/) | Excluded duplicate geometry transport. The directly released OBJ already supplies the original indexed shape at an appropriate resolution without a DSK conversion dependency. |
| [Mission PCK15](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/dart/dart_spice/spice_kernels/pck/didymos_system_15.tpc) | Pinned comparison reference; not substituted for the shape-specific pole or radius. It also documents the distinction between Dimorphos's pre-impact rotation and the post-impact dynamic frame. |

All required source inputs are restored through `source/preparation/acquisition.json` and hash-verified through `source/manifest.json`. The unchanged source documentation, font and sky licensing evidence, authored recipes and generated context pins are part of the same closure. Runtime inventories are generated after preparation and published by the shared delivery owner.

## Context brightness

The small resolved context marker may use the system-wide visible geometric albedo 0.15±0.02 reported by Sunshine et al., LPSC 2023 abstract 1659, [archived at NASA NTRS](https://ntrs.nasa.gov/api/citations/20230000704/downloads/Sunshine_LPSC.pdf). This is a global brightness parameter for shared observer-vantage context presentation. It does not supply surface pixels, imply uniform measured albedo, or turn Shape into a reflectance image. The original abstract is pinned in `source/reference/Sunshine_LPSC.pdf`.

## Dynamical mass and heliocentric centre

The current DART s547 Horizons primary-body record (`920065803`), updated 2026-06-24 and pinned as `reference/horizons-primary-physical.txt`, supplies GM = 3.51278×10⁻⁸ km³/s² for shared binary-orbit context. This newer dynamical mass is independent of the older encounter-mesh radius and pole. The comparison PCK15 GM is not the adopted dynamical mass.

The heliocentric element query `65803;` targets the latest ground-based Didymos-system barycentre. The application uses that as a primary-centre approximation and adds the fitted primary-relative Dimorphos trajectory. The omitted primary wobble is approximately 10 m (the secondary-to-total GM ratio times approximately 1.15 km separation); it is small compared with the roughly 131 km sampled ±30-day heliocentric conic residual. It is not an exact primary-centre heliocentric ephemeris.
