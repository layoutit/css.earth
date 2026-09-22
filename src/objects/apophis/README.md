# Apophis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Apophis is a near-Earth asteroid with a preliminary radar reconstruction.

## Sources

The [NASA PDS release](https://sbn.psi.edu/pds/resource/apophis_shape.html), published 2026-02-20, supplies the original Model B from Brozović et al. (2018). Its bundle, mesh and spin-state labels identify the unchanged geometry, kilometer units, center-of-mass origin, principal axes and zero longitude along the long positive X axis. Labels and archived spin data are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.17 km sphere, from -0.05 to 0.06 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.606296 m and maximum 3.503535 m; display-to-source p95 1.615574 m and maximum 3.538426 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](../../../tests/objects/unit/apophis/source.test.mts).

## Known problems

The weak 2012–2013 radar data admit multiple shapes; the 2026 PDS release preserves the 2018 Model B rather than a new reconstruction. Apophis tumbles: the archived precession and rotation periods are 27.45 and 265.7 hours. This view uses a fixed illustrative frame, without propagating its tumbling attitude. No optical surface map is supplied.

The PDS spin label corrects two mistakes in the paper supplement: P2 is in hours, and the epoch is 2012-12-23 04:14:00 UTC. The archived epoch is preserved as evidence, without using it to invent a tumbling propagator.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="apophis-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 2000 vertices and 3996 triangles, Cartesian extents 0.409741 × 0.349074 × 0.318034 km, closed volume 0.019825779 km³ and volume-equivalent radius 0.167898654 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.17 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

Apophis is a short-axis-mode non-principal-axis rotator. The archive records an angular-momentum direction at ecliptic J2000 (246.8°, −59.3°), precession period 27.45 h and body-rotation period 265.7 h. These are not a fixed body pole and a single linear spin rate. The existing `cssearth-display-orientation@1` recipe uses a fixed illustrative frame with zero propagated spin, as for Toutatis. Lighting and the source-axis grid do not claim a present-day attitude.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 4 m stopping threshold. Its error estimate is 3.195057 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 3996 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
