# Arrokoth

New Horizons explored this cold-classical Kuiper-belt contact binary in 2019. It is shown on the released two-lobed shape with a LORRI photograph, MVIC enhanced color, a modeled albedo map and the plain shape model.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| View | Source and meaning |
| --- | --- |
| LORRI, opening view | [Native calibrated CA06 photograph](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri-3-kem1-v6.0/data/20190101_040862/lor_0408626332_0x636_sci.lbl), 1 January 2019, about 33 m per native pixel. Original photographed illumination remains visible. |
| MVIC | [CA05 color cube](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_composition-v1.0/data/ca05_mvic_cube.lblx). Near-infrared, red and blue make enhanced color at 340 m per native pixel. The provider aligned the bands and matched their blur ([provider overview](https://pdssbn.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_composition-v1.0/overview.pdf)). |
| Modeled albedo | [Porter (2024), NASA PDS](https://doi.org/10.26007/97r3-1e19): fitted LORRI single-scattering albedo, including unconstrained model fill. |
| Shape model | The same Porter mesh with the unmapped-surface grid. |

The [2023 geophysics archive](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/) also releases `CA06_STACK_NORMALREFLECTANCE`, nine LORRI images in one geometry ([label](https://pdssbn.astro.umd.edu/holdings/nh-a-lorri_mvic-5-geophys-v1.0/data/albedo/ca06_stack_normal_reflect.lbl)). It is not used: Porter 2024 revises the pole and recenters the body, so the old image needs a controlled registration to this exact mesh.

[Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · [Credits](NOTICE.md)

## Processing

The released mesh has 20,484 vertices and 40,960 faces in two overlapping closed lobes. All four views use the same 1,000-triangle reduction, without a constructed joining neck. The revised pole, RA 319.37°, Dec −25.588°, comes from the Porter paper, Table 2, with an arbitrary reference meridian. Shadows defaults off.

**LORRI.** Every nonzero quality flag, nonfinite value and negative uncertainty is rejected. A common linear grayscale stretch preserves the photographed illumination. Spin phase and two image-pointing offsets were fitted against the lit source-mesh limb; the original WCS scale, TAN-SIP distortion, observer range and Sun vector remain unchanged.

**MVIC.** An image-space similarity registers MVIC to contemporaneous CA05 LORRI. NIR, red and blue share one 0–0.17 range on linear display channels, followed by the [shared IEC sRGB transfer](../../../docs/color-preparation.md). No separate channel stretch changes their ratios. This fixes screen encoding; it does not reconstruct natural color.

**Albedo.** The fitted scalar model is stretched to grayscale over 0.03–0.08; the release spans 0.031881675–0.079999998. The original per-corner OBJ UVs define two south-polar projections, and each display point transfers to the closest original triangle within 250 m.

Photographs intersect the full original mesh before transfer. Incidence and emission are limited to 70° for LORRI and 65° for MVIC; occluded and grazing coverage stays gridded.

```sh
node packages/bake/cli/object-operations.mts acquire arrokoth
node packages/bake/authoring/arrokoth/prepare-photographic-cameras.mts
node packages/bake/authoring/arrokoth/qualify-photographs.mts
node site/build/prepare/prepare-authored.ts arrokoth --write
node --test packages/bake/src/objects/layers/terrestrial/missions/new-horizons-geo.test.mts
```

## Evidence

- **LORRI registration.** The [registration audit](evidence/photography/registration.json) evaluates frozen cameras against a separate LORRI exposure taken one second later, which never paints the surface. Its held-out lit edges have **2.29 px RMS** residual. This measures image-to-shape alignment, not absolute terrain accuracy. CA05 and CA06 phases differ by 4.56° over 741 seconds, close to the approximately 4.65° implied by the published rotation period.
- **MVIC registration.** Held-out limb distances are 2.12 resampled pixels RMS, or 0.71 native MVIC pixels.
- **Readers.** [Independent Astropy results](../../../packages/bake/src/objects/layers/terrestrial/missions/fixtures/arrokoth/new-horizons-astropy.json) cover the FITS HDUs of both registration images and the MVIC cube, including 50 TAN-SIP camera projections.
- **Albedo.** The [PNG/FITS registration check](../../../packages/bake/src/objects/layers/terrestrial/missions/fixtures/arrokoth/arrokoth-registration.json) reproduces FITS values at 24 PNG anchors within 3e-6 albedo.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lorri` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |
| `mvic` | 1 | 1 | 3.00° | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The photographs cover part of the encounter-facing surface; the grid marks unseen, grazing or rejected coverage.
- The albedo release has no observation-coverage mask. Its broad uniform baseline is retained source fill, not evidence of measured global albedo; rotating to the northern side exposes it.
- The paper and PDS XML disagree on pole and period metadata. The revised paper pole is used. Buie et al. (2020) gives 15.9380 ±0.0005 h; the Porter archive labels 0.6632553 days as an orbital period. The panel reports only about 15.9 hours. The display phase is illustrative.
- Unseen northern shape is modeled. Shared-edge triangle ties limit exact texture correspondence; no local terrain accuracy is inferred.
- LORRI retains detector noise and acquisition shadows. Its relative DN/s display is not a measured albedo map.
- MVIC is enhanced filter color. Its 3× archive resampling does not improve its 340 m native resolution. The image-space registration approximates the small geometry changes during the TDI scan.
