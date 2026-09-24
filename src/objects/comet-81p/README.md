# 81P/Wild 2

## Sources

- Farnham, T., Duxbury, T. and Li, J.-Y. (2005), SHAPE MODELS OF COMET WILD 2, SDU-C-NAVCAM-5-WILD2-SHAPE-MODEL-V2.1, NASA PDS.

- The [full Cartesian plate model](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_cart_full.lbl) is selected: 8,761 vertices and 17,518 zero-indexed plates in meters.

- **Stardust photographs:** four calibrated NAVCAM frames, N2073, N2075, N2077 and N2079, from the 2 January 2004 encounter. The [photography method](source/reference/encounter-photography.md) explains camera registration, accepted coverage and original shadows.

- **Mayo, Left Foot and Right Foot:** mission-team names and terrain descriptions from [Brownlee et al. (2004), Fig. 2](https://doi.org/10.1126/science.1097899). NASA's [PIA06285 photograph and diagram](https://science.nasa.gov/photojournal/wild-2-close-look/) supply the image callouts. These are approximate places within depressions, with no surveyed centres or boundaries.

[Investigation ledger](investigations.json): tested alternatives and the evidence needed to revisit them. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Photometric trial, 2026-09-13:** a trial with the published Hapke parameters reduced accepted photographic area from 39.52% to 29.73%. Five of six overlap pairs improved, but the running application showed large new grid gaps in photographed depressions. The original photographs remain in use. [Parameters, measurements and limitations](evidence/photometry/trial.json) record the trial; the original paper's H-function approximation remains unverified.

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

- The radial projection preserves observed-versus-estimated classification at all 17,518 source plate centers; this finite check is not an exhaustive subpixel boundary proof.

- The previous 996-leaf open-surface qualification is historical; current source-fit, browser and drag evidence is recorded in [the completion record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/WILD2-COMPLETION.md).

- The named-feature diagram is registered to the photograph with three fit and three withheld interior controls. The photograph-to-N2073 match uses 35 fit and 36 withheld patches; withheld error is 0.76 native pixels RMS, 3.03 maximum. [Measured controls](source/features/control-measurements.json) and [recomputed placements](source/features/evidence/image-landmarks.json) retain both partitions and their residuals.

- Each place intersects an observed face of the full PDS mesh before attachment to the existing 992-triangle display. The labels add no new mesh, photograph or dataset.

- The [terrain-place browser record](evidence/terrain-places/browser.json) covers all three search flights at 1440 × 900 and 390 × 844 on main `e986b9280` plus this change. Inspected [desktop](evidence/terrain-places/desktop.png) and [mobile viewport](evidence/terrain-places/mobile.png) captures show qualified captions on the photographs. Both matching datasets retain the labels; Shadows stay Off and all 992 leaves survive selection. Sixteen focused tests, preparation build/typecheck, coordinate reproduction and both changed bodies' provenance pass. Aggregate source preparation is blocked by unchanged Earth, Moon and Mars recipe pins on that main revision; full browser conformance was not rerun.

- **Reader oracle, 2026-09-12:** `tools/oracles/fits/encounter.py` reads the pinned NAVCAM product `n2075we02_rr.fit` with astropy. `tools/objects/terrestrial-layers/encounter-fits.oracle.test.mts` requires the HDU names, the header identity, 48 sampled radiances and quality flags, and the counts of accepted, flagged and non-finite pixels to agree.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `navcam` | 4 | 0 | — | — | — | its other 4 frames | 0 of 4 | — | 4 of 4, 0.00° | — | ×1.02 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The archive completes the hidden/unilluminated side using a fitted triaxial ellipsoid; we use its published vertices and connections, without synthesizing terrain.

- The label explicitly gives the connecting plates no physical meaning beyond joining the segments. Neutral gray is a model material, not albedo or spacecraft imagery. Close-view facets and texture-cell artifacts are not observed geological detail.

- The [catalogue](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/catalog/dataset.cat) reports roughly half-nucleus observation coverage, 50 m horizontal resolution and 6 m vertical precision. Those values describe the observed source terrain, not the inferred side or this reduced display.

- Phase is arbitrary and fixed, not a current orientation.

- Image registration does not remove the camera model's uncertainty. Moving each anchor 15 native pixels in 16 directions changes the source intercept by up to 275 m for Mayo, 272 m for Left Foot and 353 m for Right Foot. This is a sampled sensitivity check, not a statistical error bound. The UI calls each location approximate.

- Hemenway and Rahe remain withheld because placement is more sensitive. Shoemaker Basin and Walker project onto the estimated side at their published callouts, so they receive no label.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="81pwild-2-sources"></a>

The original label is checked in beside the table's exact acquisition pin.

The source flags distinguish 6,432 observed vertices and 2,329 ellipsoid vertices. Of its plates, 12,364 join observed vertices, 4,338 belong to the ellipsoid, and 816 connect the two. Each of the 6,432 observed-only vertices has a distinct full-model counterpart within 11.22 mm (mean 3.49 mm), but the releases have different connectivity along their joins; it is not the earlier open mesh with an arbitrary cap attached.

The prepared material maps those original plate flags into a 512 × 256 equirectangular raster before filtering or lighting. Observed plates (flag 0) retain neutral gray; ellipsoid plates (1) and joining plates (2) receive cssEarth's shared gray coverage grid. The grid identifies missing observations on published estimated geometry. It does not imply a measured surface texture. Raster resolution, filtering and mesh reduction limit boundary precision. Both lighting atlases, the thumbnail, context image and navigation marker derive from the same material. This model lens has no minimap.

The full source is one closed, consistently outward-wound component with Euler characteristic 2. Reduction retains 992 triangles and original published positions, closed topology, and volume within 3% of the source full model. The simplifier's 55 m allowance produces a 54.33 m library error estimate, not a measured maximum or observational uncertainty.

The viewer labels the completed shape and explicitly identifies the estimated far side.

+Z follows the fitted ellipsoid's minor axis (RA 112°, declination −17°); +X follows the long axis/prime meridian. The source assumes this axis corresponds to the spin pole. Fixed-epoch solar shadows use the full source mesh, including estimated terrain; flood lights are illustrative.

Reference radius is the geometric mean of the catalogue's fitted ellipsoid semi-axes, cbrt(1.350 × 2.002 × 2.607) = 1.917106726261 km. This is an approximate navigation scale, not a measured global volume. No GM or uniform spin is invented.

## Source survey

The [Stardust mission archive](https://pdssbn.astro.umd.edu/data_sb/missions/stardust/index.shtml) provides raw and calibrated NAVCAM v3.0 imagery, dust measurements, SPICE and the v2.1 shape model. The photographic lens combines four frames on accepted observed terrain; it is neither global coverage nor an albedo map. The full Cartesian and planetocentric tables are equivalent source products, not separate views. The observed-only Cartesian table remains pinned for direct source-comparison tests.

The original tables are restorable from exact URL/hash pins. Context imagery is reproducibly prepared from the same completed, reduced mesh. Source labels and catalogue retain their original bytes.

</details>

<details>
<summary>Reproducing the named places</summary>

The two pinned NASA JPEGs are NASA-served presentation renditions, not native detector products. Manual diagram controls use interior ridges and depression rims. Image matching uses a fixed grid and checkerboard fit/holdout partition; weak and ambiguous patches are rejected by correlation before fitting. A reflected similarity accounts for the detector's upward-increasing rows. The resulting pixels pass through the existing N2073 source camera and the original PDS mesh.

The [image-registration recipe](source/features/image-registration.json) pins every consumed image, camera and shape input. Run `node tools/objects/surface-features/project-encounter-landmarks.mts comet-81p` to compare regenerated coordinates and residuals; add `--write` only when intentionally updating them. Feature preparation then checks that the unchanged display has a surface within 55 m of each source point. That display tolerance is separate from image-placement uncertainty.

Brownlee's dimensions describe each feature's extent: Mayo is roughly 1.2 km across; Left Foot's northern lobe is about 650 m wide and 140 m deep; Right Foot is roughly 1 km across, with a southeast cliff exceeding 150 m. These are not circular region boundaries. The labels use the shared point treatment.

</details>
