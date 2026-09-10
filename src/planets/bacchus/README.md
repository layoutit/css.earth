# Bacchus

## Sources

Bacchus is a small near-Earth asteroid with a prominent central indentation in its radar-derived shape. The selected [NASA/JPL OBJ](https://echo.jpl.nasa.gov/asteroids/shapes/bacchus.obj) is attributed to Benner et al. (1999), Icarus 139, 309–327; Goldstone and NASA/JPL radar astronomy. The original mesh and paper are pinned with byte counts and SHA-256 hashes.

Shape uses the shared missing-imagery grid. It shows modeled geometry under prepared lighting, without optical reflectance, generic regolith, invented craters or composition.

Elevation is false-color source radius minus a 0.315 km reference sphere, encoded from -0.13 to 0.25 km. It is a derived geometric scalar, not independent topography or gravitational height.

## Evidence

An independent nearest-triangle comparison uses 8,192 area-stratified points on each surface: source-to-display p95 0.000000 m/max 0.000000 m; display-to-source p95 0.000000 m/max 0.000000 m. These are sampled distances, not observational uncertainty or exhaustive Hausdorff bounds. Full-source NumPy plane/edge projections supply independent scalar anchors at shape extremes, the central indentation. Matching source/result snapshots cover front, back and poles; each is normalized to its own maximum radius, so they are geometry comparisons rather than browser pixel parity.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](../../../tests/objects/unit/bacchus/source.test.mjs).

## Known problems

This is the paper’s conservative single-lobe working model, not a uniquely resolved shape. Radar data cover about half a rotation, and the degree of bifurcation remains uncertain. The pole is uncertain by tens of degrees; the sidereal period is 15.0 ± 0.2 hours. No resolved optical surface map is supplied.

The display prime meridian is arbitrary; accelerated rotation and lighting do not propagate a measured present-day attitude.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="bacchus-sources"></a>
<a id="shape-and-physical-interpretation"></a>
<a id="views"></a>
<a id="preparation-checks"></a>
<a id="source-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Shape and physical interpretation**

The original source has 256 vertices and 508 faces, with extents 1.105818 × 0.529568 × 0.503943 km. Closed volume is 0.131252082 km³ and its derived volume-equivalent radius is 0.315262656 km. Vertices remain at original kilometer scale; no catalog diameter rescales them. The 0.315 km display datum is Half the 0.63 km equivalent diameter of the conservative single-lobe working model; diameter uncertainty is +0.13/-0.06 km. Original vertices are not rescaled.

The model’s 508 triangles are retained without subdivision or reduction. The paper gives an effective diameter of 0.63 (+0.13/−0.06) km. Its radio scattering constraints do not identify a unique regolith texture or composition.

The [PDS radar model archive](https://sbn.psi.edu/pds/resource/rshape.html) documents kilometer coordinates centered on the modeled center of mass, principal axes, and positive Z as the spin direction. The paper supplies ecliptic J2000 pole (24°, -26°) and sidereal period 15 h. The shared observed-pole recipe applies J2000 obliquity 23.439291111°.

**Views**

The existing closest-source-point transfer projects each display sample onto the full source mesh, preserving the source face, point and radius. Correspondences farther than 1 m are withheld as missing coverage. The flattened map withholds ambiguous radial cells; it does not define the triangle atlas’s scientific value. Cartographic relief and Sun lighting remain display treatments.

No second intersection was found among 508 source face-centroids and 8,192 distributed directions. The same source-surface transfer still binds the scientific scalar directly to the rendered source surface.

**Preparation checks**

The shared meshoptimizer 1.2.0 source-connectivity path outputs 508 native PolyCSS u triangles, 128 px raster cells, with ErrorAbsolute and RegularizeLight. Its authored stopping threshold is 1 m and its estimated error is 0.000000 m. Source and output are each one closed outward-wound component with Euler characteristic 2; zero opposite faces were removed. Estimated error is not a geometric bound.

Pinned JPL Horizons geometric heliocentric ICRF elements at JD 2461286.5 and vectors at that epoch and ±30 days support the fixed scene. The conic is a display approximation, not a perturbation ephemeris; the astronomy tests check the position independently.

**Source survey**

- [Original low-density single-lobe radar mesh](https://echo.jpl.nasa.gov/asteroids/shapes/bacchus.obj): **included**. All 256 vertices / 508 faces retained, with dimensions matching the adopted1999 paper solution. No unnecessary subdivision.
- [Higher-density PDS representation2048vertices/4092faces](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar.shape-models/data/2063bacchus.tab): **excluded**. The first 256 vertices equal the selected JPL source, but extra vertices change extents slightly. The paper’s 256 parameter model and coarse radar resolution do not justify treating subdivision as measured surface detail. PDS label supports km/principal-axis frame.
- [Alternative two-lobe fit, optical lightcurves and radar albedo](https://echo.jpl.nasa.gov/asteroids/benner.etal.1999.bacchus.pdf): **included as qualification**. The authors adopt the conservative single-lobe working model. Two-lobe topology and surface composition are not uniquely established; no invented texture.
- [Spitzer thermal-infrared observations in 2006, 2015, 2017](https://pds-smallbodies.astro.umd.edu/data_other/sptz_02_INNER/a2063.shtml): **excluded from surface lens**. Disk-integrated observations do not provide registered resolved terrain, photographic texture, or a spatial temperature map.

The lower palette boundary includes the source triangle-interior minimum (−0.1217848004 km relative radius), computed by independent full-mesh projection of the origin; vertex-only extrema would miss that minimum.

The delivered Elevation atlas records 0 withheld interior texels of 3,783,647 (0.0000%). The maximum accepted projection distance is 0.000000 m. Independent decoded-atlas checks include 21 final WebP pixel anchors: maximum channel error 2/255 against the source scalar and cartographic-relief recipe. This bound describes those sampled pixels, not every atlas pixel.

</details>
