# Geographos

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Geographos is an elongated near-Earth asteroid reconstructed from Goldstone radar and optical light curves. The selected [NASA/JPL OBJ](https://echo.jpl.nasa.gov/asteroids/shapes/geographos.obj) is attributed to Hudson and Ostro (1999), Icarus 140, 369–378; Goldstone and NASA/JPL radar astronomy. The original mesh and paper are pinned with byte counts and SHA-256 hashes.

Shape uses the shared missing-imagery grid. It shows modeled geometry under prepared lighting, without optical reflectance, generic regolith, invented craters or composition.

Elevation is false-color source radius minus a 1.284042 km reference sphere, encoded from -0.59 to 1.4 km. It is a derived geometric scalar, not independent topography or gravitational height.

## Evidence

An independent nearest-triangle comparison uses 8,192 area-stratified points on each surface: source-to-display p95 16.070065 m/max 31.238113 m; display-to-source p95 16.182665 m/max 31.635163 m. These are sampled distances, not observational uncertainty or exhaustive Hausdorff bounds. Full-source NumPy plane/edge projections supply independent scalar anchors at shape extremes, the central indentation and ambiguous source sheets. Matching source/result snapshots cover front, back and poles; each is normalized to its own maximum radius, so they are geometry comparisons rather than browser pixel parity.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/geographos/source.test.mts).

## Known problems

The 1994 equatorial radar geometry leaves north–south ambiguity: local feature latitudes and thickness are model-dependent. This view retains the archived 1999 radar model; the reference radius is derived from this mesh volume and is not an independently measured physical mean radius. No resolved optical surface map is supplied.

The display prime meridian is arbitrary; accelerated rotation and lighting do not propagate a measured present-day attitude.

The JPL release has more vertices than the 512-vertex fit discussed in the paper. Its sampling density is not observation resolution. The paper gives a model-dependent volume upper bound near 8.8 km³; rounded archival geometry is not a new physical measurement. The separate PDS release is thicker and has different coordinates. These variants are not claimed identical. Later thermophysical research favors a thinner/lightcurve-based interpretation; this package intentionally identifies the archived radar reconstruction.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="geographos-sources"></a>
<a id="shape-and-physical-interpretation"></a>
<a id="views"></a>
<a id="preparation-checks"></a>
<a id="source-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Shape and physical interpretation**

The original source has 2048 vertices and 4092 faces, with extents 5.052589 × 2.028125 × 2.145141 km. Closed volume is 8.868010549 km³ and its derived volume-equivalent radius is 1.284041905 km. Vertices remain at original kilometer scale; no catalog diameter rescales them. The 1.284042 km display datum is Volume-equivalent radius computed from the unmodified JPL archive mesh. The source paper gives a model-volume upper bound; no catalog diameter is imposed on the vertices.

The [PDS radar model archive](https://sbn.psi.edu/pds/resource/rshape.html) documents kilometer coordinates centered on the modeled center of mass, principal axes, and positive Z as the spin direction. The paper supplies ecliptic J2000 pole (55°, -46°) and sidereal period 5.223327 h. The shared observed-pole recipe applies J2000 obliquity 23.439291111°.

**Views**

The existing closest-source-point transfer projects each display sample onto the full source mesh, preserving the source face, point and radius. Correspondences farther than 30 m are withheld as missing coverage. The flattened map withholds ambiguous radial cells; it does not define the triangle atlas’s scientific value. Cartographic relief and Sun lighting remain display treatments.

Two source face-centroid rays select a different surface sheet (up to 72.280338 m radius difference); the source-surface transfer avoids that false assignment. A uniform 8,192 direction census alone missed this localized ambiguity.

**Preparation checks**

The shared meshoptimizer 1.2.0 source-connectivity path outputs 800 native PolyCSS u triangles, 128 px raster cells, with ErrorAbsolute and RegularizeLight. Its authored stopping threshold is 30 m and its estimated error is 29.385834 m. Source and output are each one closed outward-wound component with Euler characteristic 2; zero opposite faces were removed. Estimated error is not a geometric bound.

Pinned JPL Horizons geometric heliocentric ICRF elements at JD 2461286.5 and vectors at that epoch and ±30 days support the fixed scene. The conic is a display approximation, not a perturbation ephemeris; the astronomy tests check the position independently.

**Source survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

</details>
