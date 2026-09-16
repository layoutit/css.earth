# Kleopatra

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

The geometry is the original `216_Kleopatra_mpcd.obj` from the [LAM VLT/SPHERE asteroid survey release](https://observations.lam.fr/astero/3Dshape/). Cite Marchis, Jorda, Vernazza et al., [(216) Kleopatra, a low density critically rotating M-type asteroid](https://doi.org/10.1051/0004-6361/202140874), A&A 653 A57 (2021), and Vernazza et al., [VLT/SPHERE imaging survey: final results and synthesis](https://doi.org/10.1051/0004-6361/202141781), A&A 654 A56 (2021). Original inputs and authored preparation data are pinned in `source/manifest.json`.

The photographic lens uses a second mesh from the same release, `216_Kleopatra_adam.obj`. The survey's published pole and period describe that ADAM frame rather than the separately re-optimised MPCD one, so the photograph is registered to the mesh its own rotation parameters belong to while Shape keeps MPCD. Measured over seven frames spanning both apparitions, projecting through ADAM reproduces the observed limb position angle to 3.3 degrees; the same parameters through MPCD give 6.8 degrees.

**SPHERE photograph** casts five deconvolved VLT/SPHERE/ZIMPOL frames from July and August 2017 onto that mesh. The camera's pointing and orientation are derived, not fitted: the pole, period and phase epoch come from the release's own parameter record, the observing geometry from pinned JPL Horizons responses for Paranal, and the plate scale, exposure time and filter from each frame's own header. The rotation convention is [Ďurech, Sidorin and Kaasalainen (2010)](https://doi.org/10.1051/0004-6361/200912693) equation 1. One quantity in each frame is measured from the photograph rather than derived: the sky threshold, one stated fraction of that frame's own peak. The disc centre is fitted to the limb the mesh projects, the epoch is the midpoint of the stated exposure, and `source/preparation/observer-cameras.json` names every input, so `tools/objects/observer-cameras.mts` re-derives the recipe and `observer-cameras.test.mts` refuses one that drifts. Grayscale is photographed illumination and matched relative frame brightness; the deconvolution carries no radiometric calibration, so it is not measured albedo, color or composition.

The frames' own world-coordinate solution is used for one thing only, the plate scale, which its `CD` matrix states. Its reference pixel is 512,512 on a 256 by 256 array, inherited from an uncropped frame, so it locates nothing; the pointing comes from the ephemeris and the spin record instead.

**Shape** applies the shared neutral-gray material to the released geometry. It conveys the two lobes, their neck, and the model's broad relief. It is not a photograph, measured albedo, natural color or a map of metal abundance. The source was reconstructed with multiresolution photoclinometry by deformation (MPCD), starting with an ADAM model constrained by lightcurves, adaptive-optics images, occultations and radar. The MPCD solution gives greater weight to high-resolution VLT/SPHERE images. These ground-based observations do not measure small-scale terrain.

## Evidence

A separate nearest-surface diagnostic compares 8,192 deterministic area-stratified samples on each mesh against the other mesh's triangles using exact point-to-triangle distances with AABB pruning. Source-to-result mean/p95/p99/maximum sampled distances are **231.562/662.354/926.825/1272.402 m**; result-to-source values are **233.714/660.592/934.525/1307.387 m**. This accounts for concavity without projecting both surfaces onto one radial map. It is still sampled evidence, not an exhaustive Hausdorff bound.

Matched source/result preparation previews from six directions retain the two lobes and neck. They share the existing CPU context renderer and a neutral material. They demonstrate mesh shape correspondence, not native browser parity or observation-pixel parity. Fine features become more angular at the 800-face budget.

Every camera field in the recipe is recomputed from the pinned inputs and compared against it by
[zimpol-camera.test.mts](../../../tests/objects/unit/kleopatra/zimpol-camera.test.mts), so the derivation runs in the
test suite rather than being a claim about code the build never executes.

Three checks back the geometry, and it is worth stating what each one cannot see. Sub-solar points derived from the
pinned heliocentric vectors reproduce the solar phase angle Horizons reports directly, to better than 0.05 degrees on
every frame; that proves the ephemeris handling and is invariant under a longitude mirror. The rotation convention is
checked against the producer's own numbers, since DAMIT distributes model 101 both as an inversion record and as IAU
elements, and converting the first reproduces the second's pole to under half a degree and its rate to 1e-4 degrees
per day; that proves the pole and the rate, not the handedness. The handedness itself is asserted directly in
[observer-camera.test.mts](../../../tools/objects/terrestrial-layers/observer-camera.test.mts), because an earlier
revision of this lens shipped a body mirrored in longitude and every silhouette, disc-size and phase-angle check
passed on it unchanged.

[Source test definitions](../../../tests/objects/unit/kleopatra/source.test.mts).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 5 | 5 | 3.63° | 0.00° | 3.63° | its other 5 frames | 0 of 5 | — | 3 of 5, 0.00° |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset.
<!-- registration-report:end -->

## Known problems

Shadows defaults off. Existing preparation bakes diffuse directional lighting, available by switching Shadows on. There are no terrain-cast shadows. Pole orientation is source-supported, but absolute rotation phase is deliberately arbitrary, so the lit view is not a predicted observation at the displayed date.

**Elevation is deferred.** The full mesh includes nonradial concavity near the neck and lobes. A body-centered radius map gives only the nearest intersection and can assign the wrong radius to farther surfaces along the same ray. In the original 3,168-face source, 31 face centroids lie on a farther surface than the first radial intersection; the largest discrepancy is 27.5 km. Two of 8,192 equal-area test directions also have multiple source intersections. These diagnostics use the original mesh and demonstrate the radial representation's limitation, not simplification error. No radial replacement of geometry or misleading radial-height lens is published.

**The photograph covers one hemisphere and one apparition.** The 2018 apparition views the opposite hemisphere, but its frames sit about seventeen times fainter than the 2017 set after level matching, past this route's budget of sixteen, and several of its pairs share no samples with that set. Those two frames are pinned as registration evidence rather than combined into the lens. No registered global optical, geological or compositional map is established here.

The deconvolved products carry an inherited world-coordinate solution that does not describe them: their reference pixel is 512,512 on a 256 by 256 array, and no keyword records the deconvolution. The camera therefore comes from the ephemeris and the spin state, not from that solution.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="kleopatra-source-record"></a>
<a id="presentation-and-limitations"></a>
<a id="bounded-source-survey-2026-09-07"></a>
<a id="physical-frame-and-scale"></a>
<a id="mesh-preparation-and-qualification"></a>

<details>
<summary>Methods and source notes</summary>

**Bounded source survey (2026-09-07)**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Physical frame and scale**

The original OBJ coordinates are kilometers. Their Z axis follows the north spin pole; the long axis lies approximately along X, and Y completes the right-handed frame. Source vertices and connectivity are preserved. The origin is the released model center; no translation, recentering or axis substitution is introduced. Longitudes are east-positive in that frame.

For the physical reference radius, use the MPCD volume-equivalent diameter 118.2 ±0.8 km from Marchis et al. Table 2: **59.1 km**. The source's maximum coordinate extents are approximately **271.91 ×107.03 ×72.00 km**. They differ from the paper's characteristic `a,b,c` values, which are not all maximum coordinate extents; source scale is established by the matching volume as well. The 800-face result has volume 855,483.71 km³, 1.12% below the original.

The observed MPCD ecliptic J2000 pole is λ=74.1°, β=+21.6° with a 5.385282 h period. The authored rotation record converts this pole to equatorial J2000 with obliquity 23.439291111°. Positive Z and the east-positive body axes are retained; the prime-meridian display phase is explicitly arbitrary. No IAU phase solution is claimed. The fixed-epoch heliocentric fit has semimajor axis **2.795397676845876 AU** at JD **2461286.5**, using the astronomy package's JPL Horizons pins. It is a local two-body approximation, not a long-term precision ephemeris. A nominal GM of **0.1982 km³/s²** follows the 2.97×10¹⁸ kg mass from the companion satellite-dynamics study, rounded for display context.

**Mesh preparation and qualification**

The shared Wavefront reader loads the source mesh. `source-meshoptimizer` simplifies its original connectivity before material baking. It does not sample replacement radial geometry. Source and result are each one closed consistently wound component with Euler characteristic 2 and positive volume. The source has 1,586 vertices, 4,752 edges and 3,168 faces; the result has 402 vertices, 1,200 edges and 800 faces. No opposite coincident face pairs were removed.

Meshoptimizer 1.2.0 uses ErrorAbsolute and RegularizeLight with an authored 1,500 m allowance; the library estimate is 1,299.988 m. In 8,192 equal-area Fibonacci radial directions, both meshes have zero missed first intersections. Mean/p95/p99/maximum differences are **353.482/1078.816/1790.177/5236.900 m**. These samples compare first intersections only, and the largest difference is near an oblique neck/lobe direction. They neither measure all concave surface points nor give an exhaustive bound. The library's regularized estimate is likewise not an exhaustive surface distance bound or source measurement accuracy.

Each display face is a native PolyCSS `u` raster triangle with a 128 px cell. Existing preparation owns source sampling, atlases, normal interpolation, lighting, retained leaves, shape targeting and context imagery. Runtime consumes prepared state. The context image uses this exact reduced mesh at 90°E, 35°N with full-phase ambient 0.45 and diffuse 0.55. Geometry's display radius of 110 CSS units frames the long body; its physical reference radius remains 59.1 km.

Restore with `node tools/objects/dist/operations.js acquire kleopatra`; verify with `acquire kleopatra --verify-only`; prepare with `node tools/objects/dist/prepare-authored.js kleopatra --write`. The public LAM site returns a JavaScript cookie interstitial; the download operation carries that ordinary cookie explicitly. The original OBJ, complete Marchis research paper and Inter font are direct pinned downloads; other documentation, title and generated context are checked-in source pins. The 22 MB paper stays intact and ignored by the body-owned .gitignore. Runtime installation is separate through `runtime-assets.json`.

</details>
