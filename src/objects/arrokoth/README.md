# Arrokoth

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| View | Source and meaning |
| --- | --- |
| LORRI, opening view | [Native calibrated CA06 photograph](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri-3-kem1-v6.0/data/20190101_040862/lor_0408626332_0x636_sci.lbl), 1 January 2019, about 33 m per native pixel. Original photographed illumination remains visible. |
| MVIC | [CA05 color cube](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_composition-v1.0/data/ca05_mvic_cube.lblx). Near-infrared, red and blue make enhanced color at 340 m per native pixel. The provider aligned the bands and matched their blur. |
| Modeled albedo | [Porter (2024), NASA PDS](https://doi.org/10.26007/97r3-1e19): fitted LORRI single-scattering albedo, including unconstrained model fill. |
| Shape model | The same Porter mesh with the unmapped-surface grid. |

All four views use the existing 1,000-triangle reduction of the released
40,960-face, two-lobed mesh. Shadows defaults off. The photographs cover
part of the encounter-facing surface; the grid marks unseen, grazing or rejected
coverage. The unseen northern shape remains a model estimate. Sources checked
2026-09-12.

The MVIC display keeps the archive-derived band values floating through the
shared footprint and surface transfer. One common 0–0.17 range assigns NIR, red
and blue to linear display channels, followed by the [shared IEC sRGB
transfer](../../../docs/color-preparation.md). The original PDS label now enters
the consumed source closure and validates band order, wavelengths and data-number
units. This fixes screen encoding; it does not reconstruct natural color.

## Evidence

The 2026-09-13 [color-encoding capture](evidence/color-encoding/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/color-encoding/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

[Displayed surface](evidence/color-encoding/color-dpr1.png) · [DPR 2](evidence/color-encoding/color-dpr2.png) · [Shadows](evidence/color-encoding/oblique-shadows-dpr1.png) · [Mobile](evidence/color-encoding/mobile.png). The native MVIC label and independent Astropy sample/camera checks still apply: the cube, camera and shape are unchanged; the final display encoding changed.

The [registration audit](evidence/photography/registration.json) binds its source
images, control file and source mesh by hash. It evaluates frozen cameras: it does
not fit them again. A separate LORRI exposure taken one second later is reserved
for validation and never paints the surface. Its held-out lit edges have **2.29 px
RMS** residual. This measures image-to-shape alignment, not absolute terrain
accuracy. The full report retains unmatched edges and maximum errors.

[Independent Astropy results](../../../tests/objects/fixtures/arrokoth/new-horizons-astropy.json)
cover all three FITS HDUs of both registration images and the four-band MVIC cube.
The reader tests compare native pixels, quality decisions and 50 TAN-SIP camera
projections across the detectors. Both million-pixel detector quality masks also
match Astropy's accepted-pixel counts.

The [browser capture record](evidence/photography/capture.json) binds the tested
package and preparation code to the inspected views. LORRI and MVIC switch
successfully at DPR 1 and 2; each retains 1,000 triangles with Shadows and Orbit
off. The reverse view shows the unmapped grid. The 390 px mobile view switches
datasets without horizontal overflow. A fresh remote install verifies all 41
runtime files, totaling 10.45 MB, against their size and SHA-256 pins.

Clean checks: native readers and color sampling, source/UV tests, source and
runtime closure, preparation and affected-test TypeScript, JavaScript ownership,
dataset switching, lens race, reacquisition, rejection/retry and destruction.

The full browser suite is not green: desktop breakpoint zoom preservation,
mobile wheel suppression and the wheel-distance check fail. The latter two also
fail on the unchanged Tempel 1 package; its wheel-distance mismatch is identical
to Arrokoth's. The source suite has 65 passes, one skipped unrestored reference
and one failure in the unchanged Moon factsheet's content pin. These findings
do not establish full-site or all-body readiness. No renderer changes were made.

<details>
<summary>Earlier albedo and shape evidence</summary>

2026-09-10: the previous default changed to Modeled albedo and faced the imaged southern
hemisphere. The [current view checks](evidence/spacecraft-default/validation.json)
bind the tested code and assets to the [opening view](evidence/spacecraft-default/default-dpr1.png).
All 35 runtime image hashes, the source UV attribution, and the 1,000-face
prepared terrain match the previous revision. No imagery upload is required.
The source and minimap tests pass, as does the tooling TypeScript check.
The DPR 1/2 interaction conformance cases pass. Their initial empty-sky failure
was a stale DOM-only test probe that clicked Haumea; the probe now checks the
actual retained hover target. The initial failure and corrected results are
retained in the report. No full-site build or all-body suite was run locally
for this presentation change.

2026-09-09: corrected acquisition instructions and recovered provenance from
existing pins. Source and prepared output identities are unchanged; no new
preparation or browser run. The [original prepared record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/src/planets/arrokoth/prepared/provenance.json) remains available.

The [three-body qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/qualification.json)
and [production browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/browser-validation.json)
retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity). All three routes passed at DPR 1 and 2;
those captures predate the combined population build.

The [PNG/FITS registration check](../../../tests/objects/fixtures/arrokoth/arrokoth-registration.json)
compares 24 decoded anchors. A [recorded albedo drag](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trans-neptunian/drag-report.json)
retained all 111,002 scene nodes and made no interaction requests. It covered one
local headless workload, mostly facing uniform source fill; [inspected images](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/README.md#delivered-browser-evidence)
show mapped southern detail separately.

</details>

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lorri` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |
| `mvic` | 1 | 1 | 3.00° | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The albedo release has no observation-coverage mask. Its broad uniform baseline
  is retained source fill, not evidence of measured global albedo.
- The paper and PDS XML disagree on pole and period metadata. The revised paper
  pole is used. The photographs have fitted encounter attitudes; the application's
  display phase is still illustrative.
- Unseen northern shape is modeled. Shared-edge triangle ties limit exact texture
  correspondence; no local terrain accuracy is inferred.
- LORRI retains detector noise and acquisition shadows. Its relative DN/s display
  is not a measured albedo map. No extra rendered shadow is enabled by default.
- MVIC is enhanced filter color. Its 3× archive resampling does not improve its
  340 m native resolution. The image-space registration approximates the small
  geometry changes during the TDI scan; it is not a new geometric backplane product.

[Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Native photographs, camera registration and reproduction</summary>

The native LORRI exposures are `lor_0408625591_0x630_sci` (CA05) and
`lor_0408626332_0x636_sci` (CA06). Each FITS file includes calibrated DN,
uncertainty and unsigned quality flags. Every nonzero flag, nonfinite value and
negative uncertainty is rejected. Absolute-calibration header keywords do not
convert the stored DN to I/F. A common linear grayscale stretch preserves the
photographed illumination.

The published pole is RA 319.37°, Dec −25.588°. Spin phase and two image-pointing
offsets were fitted against the lit source-mesh limb, with alternating edge samples
withheld. The original WCS scale, TAN-SIP distortion, observer range and Sun vector
remain unchanged. CA05 and CA06 phases differ by 4.56° over 741 seconds, close to
the approximately 4.65° implied by the published rotation period. The adjacent
CA06 exposure is predicted using the frozen pointing offset and propagated phase.

The MVIC product contains BLUE, RED, NIR and CH4 in that order. The
[provider overview](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_composition-v1.0/overview.pdf)
documents PSF matching and image registration. Its archive label calls the values
data numbers; this view makes no absolute reflectance claim. NIR / RED / BLUE
share one zero-based 0–0.17 display scale. No separate channel stretch or
single-filter photometric correction changes their ratios.

An image-space similarity registers MVIC to contemporaneous CA05 LORRI. Held-out
limb distances are 2.12 resampled pixels RMS, or 0.71 native MVIC pixels. The fitted
transform retains the LORRI SIP distortion. It does not reuse the older body-fixed
geometry fields in the cube label.

Photographs intersect the full original mesh before transfer to the existing
display triangles. Every bilinear contributor must belong to the same visible
patch. The source-distance limit is 250 m; contributor separation is 180 m for
LORRI and 600 m for MVIC. Both incidence and emission are limited to 70° for
LORRI and 65° for MVIC. Occluded and grazing coverage stays gridded. Latitude/longitude
previews withhold ambiguous centre rays; the actual triangle atlases transfer
through local 3D surface points, including the overlapping lobes.

```sh
node tools/objects/dist/operations.js acquire arrokoth
node tools/objects/arrokoth/prepare-photographic-cameras.mts
node tools/objects/arrokoth/qualify-photographs.mts
node tools/objects/dist/prepare-authored.js arrokoth --write
node --test tools/objects/terrestrial-layers/new-horizons-geo.test.mts
```

The Astropy fixture was captured with the repository's pinned Astropy 8.0.1 and
NumPy 2.5.3 environment (`node tools/oracles/setup.mts`) using
`fits.open` for each original HDU and `WCS.all_pix2world(pixels, 0)` for a 5×5
detector grid. It records exact input hashes. The native files are restored by
the acquisition recipe, not copied from rendered screenshots.

</details>

<details>
<summary>Released shape, albedo registration and source disagreements</summary>

## Shape and orientation

New Horizons explored this cold-classical Kuiper-belt contact binary in 2019.
The released mesh has 20,484 vertices and 40,960 faces in two overlapping closed
lobes. Preparation simplifies the full source connectivity to 1,000 native raster
triangles; it does not construct a joining neck or use centre-ray reconstruction.
Southern detail is constrained by flyby imagery; the unseen side is a source model
estimate.

The revised pole comes from the bundled Porter paper Table 2. Its PDS XML gives
an inconsistent earlier pole. The paper pole is used with an arbitrary reference
meridian. Shadows defaults off. Source recipes pin units and model axes;
geometry is prepared before runtime.

## Albedo

The Modeled albedo view is a fitted scalar model, stretched to grayscale over 0.03–0.08.
The release's uniform baseline is retained unchanged. No confidence mask is
invented from that fill. The default framing faces southern detail; rotating to
the northern side exposes the archive's unconstrained fill. This is a
spacecraft-derived model, not an observed global photograph.
Surface spectra and unresolved observations are not reconstructed surface textures.

The original per-corner OBJ UV indices define two south-polar projections. Each
simplified surface point transfers to a closest original source triangle within
the 250 m limit. Bilinear sampling stays in that UV domain. Either incident
triangle may win a shared-boundary tie, so exact texel correspondence is not
claimed there. Flat latitude/longitude previews withhold directions with multiple
source intersections; 3D transfer uses local surface points.

The PDS PNG and raw FITS arrays have opposite row order. Twenty-four independent
PNG anchors reproduce FITS values within 3e-6 albedo using the label's approximate
integer conversion. Lower-left OBJ V indexes raw FITS rows directly. The
[registration record](../../../tests/objects/fixtures/arrokoth/arrokoth-registration.json)
binds those checks to exact source hashes.

## Source survey

The released albedo FITS supplies no explicit observational coverage mask and its
broad uniform baseline is not resolved imagery. The default view states that
limitation next to the active dataset. Porter fitted 30 approach images, weighted
by their original resolution; the two source UV islands preserve those fitted
values on their corresponding lobes. The decoded release spans
0.031881675–0.079999998, entirely inside the existing 0.03–0.08 display range.
The lower approximate value discussed in the paper is not substituted for the
actual release.

The [2023 geophysics archive](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/)
also releases `CA06_STACK_NORMALREFLECTANCE`: nine LORRI images transformed into
the geometry of `lor_0408626332_0x636_sci`, with reference acquisition time
2019-01-01 05:26:54 UTC. Its [label](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/ca06_stack_normal_reflect.lbl)
describes signed I/F samples and anomalously bright limb artifacts. It remains
unresolved for this display: Porter 2024 revises the pole and recenters the body,
so the old image needs a controlled registration to this exact mesh.
The companion hemispherical-albedo raster differs only by a multiplicative
factor and would not add independent terrain detail. The archive's thermal
products are simulations on an older mesh, not measured temperature images.
The new photographic views use native LORRI exposures and the separate MVIC cube;
they do not promote this older normalized stack to a registered map.

The bundled paper and PDS XML disagree on the pole, and the XML calls a sub-day
period an orbital period. Buie et al. (2020) gives 15.9380 ±0.0005 h; the Porter
archive labels 0.6632553 days as an orbital period. The panel reports only about
15.9 hours. No precision spin rate is installed.

[Family source and preparation account](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/README.md).

</details>
