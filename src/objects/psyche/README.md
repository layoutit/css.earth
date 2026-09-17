# Psyche

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/16_Psyche_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| Thermal inertia and dielectric constant | [Cambioni, de Kleer & Shepard (2022)](https://doi.org/10.1029/2021JE007091) maps, [Zenodo release](https://doi.org/10.5281/zenodo.6321315) |

Psyche is a main-belt asteroid whose observations suggest a mixture of metal and rock. Its flattened, irregular shape is reconstructed from ground-based observations; the grid conveys no surface composition.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 223 km, ecliptic J2000 pole (35°, -9°), sidereal period 4.195948 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/16_Psyche_mpcd.obj): 3234 vertices, 6464 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 110.635704 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 282.273 × 240.083 × 168.077 km; these are not best-fit ellipsoid axes.

### ALMA thermal maps

The Thermal inertia and Dielectric constant lenses show the maps Cambioni, de Kleer & Shepard (2022) fitted to ALMA 1.3 mm images of Psyche's thermal emission, taken on 2019 June 19 over about two-thirds of one rotation at about 30 km resolution ([de Kleer et al. 2021](https://doi.org/10.3847/PSJ/ac01ec)). Thermal inertia says how slowly the top centimetres heat and cool; the dielectric constant says how strongly the material responds to an electric field, which the authors read as the balance of metal and silicate. They are model fits, not photographs.

The [Zenodo release](https://doi.org/10.5281/zenodo.6321315) (CC BY 4.0) is kept unchanged in [source/thermal](source/thermal): one value per 5-degree node, 73 × 37, with NaN where the authors dropped a node (reduced chi-squared above 10, or three or fewer observations). 1,895 of 2,701 nodes are mapped, about 80% of the surface by area. Each lens draws one colour per node over the half-step around it, with no smoothing; dropped nodes show the missing-data grid.

| Quantity | Mapped range | Median uncertainty (10th to 90th percentile) |
| --- | --- | --- |
| Thermal inertia | 25 to 594 J m⁻² K⁻¹ s⁻½, 23 distinct values | 134 (46 to 175) |
| Dielectric constant | 7.5 to 55 | 1.9 (0.5 to 4.1) |

The maps are in the body frame of the Shepard et al. (2021) shape: longitude 0 on the major axis, east positive. The lenses ride the ADAM mesh, like the SPHERE photograph, and each mesh direction is carried into the map frame through the two published spin states at the ALMA midpoint, 2019-06-19 07:52 UTC ([alma-body-frame.json](source/thermal/alma-body-frame.json)). The map frame's state is Cambioni et al. (2022) equation 2 (pole ecliptic 36°, −8°; phase 341.56° at J2000, TDB; period 4.195948 h); the mesh's is LAM's parameter file, read in UTC as the photograph lens reads it. At that epoch the mesh prime meridian lies at map longitude −4.11° and the two poles differ by 1.63°.

## Evidence

ALMA map placement, run 2026-09-16 (this version), `node --test tests/objects/unit/psyche/alma-frame.test.mts`:

- **The map frame's spin state is the one the authors used.** Evaluated in TDB with JPL Horizons geometry ([vectors](source/reference/horizons-alma-2019-06-19.txt)), it reproduces all 22 sub-observer longitudes in de Kleer et al. (2021) Table 1 ([transcription](source/reference/de-kleer-2021-table1.json)): mean difference 0.04°, scatter 0.33° (the table rounds to whole degrees), largest 0.54°, latitude −13.83° against the table's −14°. Read in UTC the mean difference is 1.68°.
- **Shape alone agrees with the placement.** The release's altitude map (height above the best-fit ellipsoid of the Shepard shape) is compared with the same quantity computed from the ADAM mesh, over latitudes within 60°, while the map is turned about its pole. The best match is 1° from where the spin states put it (correlation 0.821; 0.819 at 0°). A mirrored longitude peaks at 0.455, a flipped latitude at 0.485 and both at 0.618.
- The `.npy` reader and nearest-node lookup match numpy 2.5.3 ([fixture](../../../tests/oracles/npy/psyche-alma.json), `tools/objects/terrestrial-layers/npy-lonlat-grid.oracle.test.mts`).

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1985.3 m error; the authored stopping threshold is 2100 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1043.4 m and maximum 2069.4 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 16 | 6 | 3.19° | 2.15° | 2.35° | its other 16 frames | 2 of 16 | — | 1 of 16 | tilted 5.00° by the silhouette | ×1.02 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`.
<!-- registration-report:end -->

## Known problems

- The ALMA maps are coarse and uncertain: one value per 5 degrees at about 30 km resolution, and a median thermal-inertia uncertainty of 134, 75% of the median value. Neighbouring colours often differ by less than their uncertainty.
- Cambioni et al. (2022) hatch 60° to 120° west in their frame as possibly affected by model artifacts: it was seen at high emission angles in under a third of the images and may hide unmapped topography. Those nodes are drawn like the rest; the lens notes say so.
- The maps were fitted on the Shepard et al. (2021) shape, not the ADAM mesh. Their overall sizes agree to about 2%: Shepard's equivalent ellipsoid is 274 × 234 × 171 km (their Table 5) and a least-squares ellipsoid through the ADAM vertices is 280 × 235 × 173 km (measured). A node is placed by its direction from the centre, so where the two shapes differ locally its value lands on slightly different ground.
- The LAM parameter file does not state its time scale. It is read in UTC, as for the photograph lens; read in TDB it would move the mesh prime meridian 1.65° in map longitude. The shape check leans only slightly toward UTC: its peak is 1° from the UTC placement and 3° from the TDB one, at correlations 0.821 and 0.822.

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 111.5 km reference sphere, with a -40 to 40 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Original ADAM comparison](https://observations.lam.fr/astero/3Dshape/16_Psyche_adam.obj): radius 111.887165 km. Excluded as a second lens: it is an alternative reconstruction of the same shape. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/16Psyche/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

- [Individual research](https://observations.lam.fr/astero/Papers/Viikinkoski2018.pdf): complementary interpretation and model/image comparisons. The later [Ferrais et al. (2020)](https://doi.org/10.1051/0004-6361/202038100) release includes updated shape and relative-albedo results.

- [DAMIT relative albedo](https://damit.cuni.cz/projects/damit/stored_files/open/105/albedo) and its [paired older ADAM shape](https://damit.cuni.cz/projects/damit/stored_files/open/108/shape.txt): available numeric data, 1352 per-facet values and a 678-vertex/1352-facet model. Unresolved for this presentation: correspondence and coverage on the selected 3234-vertex MPCD release have not been established. No albedo or composition lens is claimed. Paper figure maps are not substituted for the numeric source.

</details>

<a id="shape-elevation-and-lighting"></a>

<details>
<summary>Shape, elevation and lighting</summary>

The original connected surface is simplified with meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight, to 800 native PolyCSS u triangles. Each raster leaf is 128 × 128 px in a 2048 × 6400 atlas. Geometry and per-texel flood/directional lighting are prepared ahead of runtime.

No radial substitute, runtime triangulation, fabricated texture or additional renderer is used.

</details>

<a id="frame-and-ephemeris"></a>

<details>
<summary>Frame and ephemeris</summary>

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is preserved as evidence and is not read as an IAU W model.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package.

TDB is approximated as TT within 2 ms.

</details>

<a id="reproduction"></a>

<details>
<summary>Reproduction</summary>

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
