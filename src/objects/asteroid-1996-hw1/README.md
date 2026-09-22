# 1996 HW1

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

1996 HW1 is a contact-binary near-Earth asteroid reconstructed from Arecibo radar and optical lightcurves. The [original NASA/JPL mesh](https://echo.jpl.nasa.gov/asteroids/shapes/1996hw1.obj) and [study](https://echo.jpl.nasa.gov/asteroids/magri.etal.2011.1996hw1.pdf) are pinned by byte count and SHA-256.

Shape uses the normal missing-imagery grid on the original source geometry. No regolith texture, optical reflectance or artificial crater imagery is supplied. Shadows default off; prepared directional lighting is available through the common setting.

Elevation colors radius of the closest original source-surface point minus 1.01 km. The palette spans -0.57 to 0.95 km, enclosing the original mesh including triangle interiors. It is derived from the same radar model, not independent measured topography.

## Evidence

An independent nearest-triangle comparison used 8,192 area-stratified samples in each direction. Source-to-display p95/max: 12.305111/30.083278 m. Display-to-source p95/max: 12.459590/28.751850 m. These are sampled distances, not exhaustive Hausdorff bounds or observation uncertainties. Independent NumPy full-source plane projections and edge minima qualify source-scalar anchors. Source/result front, back and pole snapshots inspect geometry; they are not browser pixel-parity claims.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](../../../tests/objects/unit/asteroid-1996-hw1/source.test.mts).

## Known problems

The narrow neck and two lobes are constrained by radar and lightcurves, while weakly observed regions and facet-scale detail remain model-dependent. The published pole is uncertain by 5 degrees and the equivalent diameter by 8%. No resolved optical surface map is supplied.

Display phase is arbitrary; the animation is not a present-day attitude ephemeris.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="1996-hw1-sources"></a>
<a id="geometry-scale-and-rotation"></a>
<a id="supported-views"></a>
<a id="preparation-and-independent-checks"></a>
<a id="source-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Geometry, scale and rotation**

The source has 1392 vertices and 2780 faces, one closed outward-wound component and Euler characteristic 2. Extents are 3.777350 × 1.639145 × 1.492247 km; volume is 4.336113147 km³. The PDS a8567.tab and selected JPL OBJ have exactly identical vertex coordinates and face indices, although their whitespace differs. This establishes the PDS kilometer/center-of-mass/principal-axis contract for this specific geometry.

The reference radius is 1.01 km: Half the 2.02 km volume-equivalent diameter in Magri et al. (2011), Table 3, with 8% diameter uncertainty. Original vertices are not rescaled. It defines a geometric datum, not a gravitational equipotential. The published ecliptic J2000 pole is (281°, -31°), with period 8.76243 ± 0.00004 hours. The existing observed-pole recipe converts it to equatorial coordinates using J2000 obliquity 23.439291111°.

**Supported views**

The shared closest-source-point transfer withholds correspondence beyond 26 m. The flattened sample grid is not the scientific authority for retained triangle texels. Cartographic relief is a display treatment.

499 of 2780 source face-centroid rays and 185 of 8,192 distributed directions encounter radial ambiguity. The contact-binary neck makes a first radial intersection scientifically wrong on some outer surfaces; the closest-source-surface contract preserves those surfaces.

**Preparation and independent checks**

Existing meshoptimizer 1.2.0 source-connectivity simplification retains 800 native PolyCSS u raster faces in 128 px cells. It preserves a single closed component and Euler characteristic 2. The authored error threshold is 26 m; the simplifier estimate is 25.000891 m. This estimate is not a geometric bound.

JPL Horizons heliocentric geometric elements at JD 2461286.5 and independent ICRF vectors at that epoch and ±30 days are pinned in reference/. Shared astronomy integration owns the conic approximation and vector regression bounds.

**Source survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

</details>
