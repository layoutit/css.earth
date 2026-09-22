# 1998 ML14

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

(52760) 1998 ML14 is a roughly kilometer-wide near-Earth asteroid.

## Sources

Geometry is the unchanged [ml14.obj](https://echo.jpl.nasa.gov/asteroids/shapes/ml14.obj) from the [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html), interpreted using [Ostro et al. (2001)](https://echo.jpl.nasa.gov/asteroids/1998ML14/ostro.etal.2001.1998ml14.pdf). This is the historical reconstruction from 1998 Goldstone/Arecibo radar and optical observations. It is not presented as the later shape reconstruction announced from 2013 observations.

Shape uses the shared missing-imagery grid. Elevation is radius minus the documented reference sphere, derived from the same radar inverse model; it is not independent topography, optical albedo or height above a gravitational equipotential. Cartographic relief is a prepared display treatment. Shadows are off by default. Optional directional shading and the grid are existing shared rendering treatments, not measured surface appearance.

## Evidence

The source mesh is reduced from 1020 to 800 faces, with a 10 m stopping and scalar-transfer allowance. Meshoptimizer estimates 9.744678 m; this is not an exhaustive geometric bound. Independent 8192 area-stratified samples in each direction give source-to-display p95 1.585639 m / max 7.558584 m, and display-to-source p95 1.602507 m / max 7.569475 m. These are sampled geometric distances, not observational errors. All 1020 source face-centroid rays and 8192 sphere directions showed no repeated radial crossing. The Elevation palette spans -0.1 to 0.1 km relative to the 0.5 km sphere. Horizons provides no GM, so no assumed density is used to invent one.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](../../../tests/objects/unit/asteroid-1998-ml14/source.test.mts).

## Known problems

The 2001 radar reconstruction did not determine an inertial pole and fitted 14.83 ± 0.15 h. Later 2013 photometry found 14.28 ± 0.01 h; a 2016 abstract reports an updated shape/pole solution, whose numeric mesh was not acquired. The abstract download changed PDF trailer IDs and the original AAS route returned HTTP 403, so it is a surveyed reference rather than a reproducible pinned input.

The existing display-orientation schema assigns a fixed arbitrary frame, with no observed inertial pole and zero propagated spin. Positive X is displayed zero longitude. Optional directional shading is illustrative. No viewing longitude or date should be read as a reconstructed current rotational phase.

The adopted photometric period and uncertainty are retained in the tracked [numerical extract](source/reference/model-properties.json).

No calibrated registered optical mosaic, composition map or independent topographic raster was acquired. This is a bounded source disposition, not proof that no other data exist. No generic regolith texture is substituted. The updated numeric reconstruction remains an explicit future replacement candidate.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="1998-ml14-sources-and-preparation"></a>
<a id="model-identity-scale-and-orientation"></a>
<a id="source-survey-and-geometry-qualification"></a>
<a id="prepared-views-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

**Model identity, scale and orientation**

The source file contains 512 vertices and 1020 triangles in kilometers. The paper describes a 1022-sided polyhedron; the archived artifact has 1020 faces, and the package preserves that actual file. Cartesian X/Y/Z extents are 0.971845, 1.035823 and 0.974371 km. Closed volume is 0.511236151096 km³ and volume-equivalent radius is 0.496033470905 km. The reference sphere is 0.5 km, from the original model's 1.0 km equivalent diameter (±5%). It is a datum and does not rescale the mesh.

**Source survey and geometry qualification**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Prepared views and delivery**

The original source coordinates are preserved without axis rescaling. The existing meshoptimizer 1.2.0 source-connectivity path uses ErrorAbsolute and RegularizeLight. Both source and retained meshes are one closed outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster cells are 128 px, with 800 triangles in a 2048 × 6400 px atlas. Geometry, scalar transfer, normals, lighting and targeting state are prepared before runtime.

Elevation uses the shared closest full-source triangle sampler in three dimensions. The nearest source point supplies radius and normal. Competing equal-distance surfaces or out-of-allowance samples are withheld; atlas bleed is clamped to each retained triangle boundary. The equirectangular preview withholds ambiguous radial projections. Geometry error, transfer allowance and observational uncertainty are distinct.

Pinned JPL Horizons heliocentric geometric ICRF elements at JD2461286.5 and independent vectors at that epoch and ±30 days support the existing fixed-epoch orbital context. The conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms.

Front, back and both-pole source/reduced snapshots preserve the gross form and silhouette. These are preparation comparisons normalized to each mesh maximum radius, not browser pixel-parity evidence.

Independent whole-source planar/edge projection agrees with the product sampler on 830 probes: every retained face centroid, six source extrema, and decoded-atlas interior/bleed coordinates. The maximum radius-minus-datum difference is 2.22e-16 km. All 13,107,200 prepared atlas texels, including bleed, were accepted; no retained triangle interior was withheld. The maximum actual transfer distance is 8.181748 m. Decoded flood and directional RGB agree at 12 interior anchors within 3/255 per channel. Bleed RGB remains diagnostic because incident normals are nonunique at shared source edges/vertices and lossy WebP mixes atlas-boundary colors. Its closest coordinates and scalar values are checked separately; no exact boundary RGB oracle is claimed.

The original reconstruction did not determine an inertial spin pole and fitted a 14.83 ± 0.15 h period. [Warner (2014), Minor Planet Bulletin 41(2), 113–124](https://mpbulletin.org/issues/MPB_41-2.pdf), obtained 14.28 ± 0.01 h from 2013 December photometry. [Sharkey et al. (2016), DPS 48 abstract 326.02](https://openaccess.inaf.it/server/api/core/bitstreams/14120a46-c8d7-4429-a5e2-4e06af015fdc/content), reports that new radar observations conflict with the old model period, and describes an updated shape/pole solution. The numeric updated mesh and pole were not acquired in this bounded survey. The abstract book was read as a surveyed reference. Its INAF download regenerates the PDF trailer document ID on each request (all other bytes agreed in two downloads), and the original AAS release returned HTTP 403. It is therefore not a reproducible acquired input; no byte normalization or replacement source is invented. The newer photometric period is shown as information; neither period is propagated into a current attitude for the archived mesh.

</details>
