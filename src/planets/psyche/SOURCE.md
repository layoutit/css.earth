# Psyche sources and preparation

Psyche is a main-belt asteroid whose observations suggest a mixture of metal and rock. Its flattened, irregular shape is reconstructed from ground-based observations; the grid conveys no surface composition.

## Selected data

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 223 km, ecliptic J2000 pole (35°, -9°), sidereal period 4.195948 h. The original article is pinned and restorable.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/16_Psyche_mpcd.obj): 3234 vertices, 6464 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 110.635704 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 282.273 × 240.083 × 168.077 km; these are not best-fit ellipsoid axes.
- [Original ADAM comparison](https://observations.lam.fr/astero/3Dshape/16_Psyche_adam.obj): radius 111.887165 km. Excluded as a second lens: it is an alternative reconstruction of the same shape. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.
- [Released SPHERE images](https://observations.lam.fr/astero/Data/16Psyche/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.
- [Individual research](https://observations.lam.fr/astero/Papers/Viikinkoski2018.pdf): complementary interpretation and model/image comparisons. The later [Ferrais et al. (2020)](https://doi.org/10.1051/0004-6361/202038100) release includes updated shape and relative-albedo results.
- [DAMIT relative albedo](https://damit.cuni.cz/projects/damit/stored_files/open/105/albedo) and its [paired older ADAM shape](https://damit.cuni.cz/projects/damit/stored_files/open/108/shape.txt): available numeric data, 1352 per-facet values and a 678-vertex/1352-facet model. Unresolved for this presentation: correspondence and coverage on the selected 3234-vertex MPCD release have not been established. No albedo or composition lens is claimed. Paper figure maps are not substituted for the numeric source.

## Shape, elevation and lighting

Shape uses the shared no-imagery grid. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 111.5 km reference sphere, with a -40 to 40 km legend. This includes global shape, not height above a gravitational equipotential. Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

The original connected surface is simplified with meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight, to 800 native PolyCSS u triangles. Each raster leaf is 128 × 128 px in a 2048 × 6400 atlas. Geometry and per-texel flood/directional lighting are prepared ahead of runtime. No radial substitute, runtime triangulation, fabricated texture or additional renderer is used.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1985.3 m error; the authored stopping threshold is 2100 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1043.4 m and maximum 2069.4 m. Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

## Frame and ephemeris

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase. The release's unlabeled parameter file is preserved as evidence and is not read as an IAU W model.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package. TDB is approximated as TT within 2 ms.

## Reproduction

Source pins live in source/manifest.json; source/preparation/acquisition.json restores the ignored OBJ, original article, ESO sky panorama and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe. Run the authored object preparer to rebuild the display, and the existing runtime setup command to install published assets without original source data. Shared sky and title provenance remain in their source directories.
