# 81P/Wild 2

Comet 81P/Wild 2 is shown on its full published shape model, with Stardust photographs on the observed terrain and three named places from the mission team. The side Stardust did not see is an estimated ellipsoid and is marked as such.

## Sources

- Farnham, T., Duxbury, T. and Li, J.-Y. (2005), SHAPE MODELS OF COMET WILD 2, SDU-C-NAVCAM-5-WILD2-SHAPE-MODEL-V2.1, NASA PDS. The [full Cartesian plate model](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_cart_full.lbl) is selected: 8,761 vertices and 17,518 zero-indexed plates in meters.
- **Stardust photographs:** four calibrated NAVCAM frames, N2073, N2075, N2077 and N2079, from the 2 January 2004 encounter, from the [Stardust mission archive](https://pdssbn.astro.umd.edu/data_sb/missions/stardust/index.shtml). The [photography method](source/reference/encounter-photography.md) explains camera registration, accepted coverage and original shadows.
- **Mayo, Left Foot and Right Foot:** mission-team names and terrain descriptions from [Brownlee et al. (2004), Fig. 2](https://doi.org/10.1126/science.1097899). NASA's [PIA06285 photograph and diagram](https://science.nasa.gov/photojournal/wild-2-close-look/) supply the image callouts.

The [investigation ledger](investigations.json) records tested alternatives and the evidence needed to revisit them.

## Processing

The source flags 6,432 observed vertices and 2,329 ellipsoid vertices. Preparation maps the plate flags into a 512 × 256 raster: observed plates keep neutral gray, and ellipsoid and joining plates get the shared gray coverage grid. The mesh is reduced to 992 triangles that keep original positions, closed topology and volume within 3% of the source.

+Z follows the fitted ellipsoid's minor axis (RA 112°, declination −17°), which the source assumes is the spin pole. The reference radius is cbrt(1.350 × 2.002 × 2.607) = 1.917106726261 km, an approximate navigation scale. Solar shadows use the full source mesh; flood lights are illustrative.

The named places are registered from the NASA diagram to the photograph and then through the N2073 camera onto the original PDS mesh ([recipe](source/features/image-registration.json)). Run `node packages/bake/cli/project-encounter-landmarks.mts comet-81p` to compare regenerated coordinates and residuals; add `--write` only when intentionally updating them. Brownlee describes Mayo as roughly 1.2 km across, Left Foot's northern lobe as about 650 m wide and 140 m deep, and Right Foot as roughly 1 km across with a southeast cliff over 150 m.

## Evidence

- The diagram-to-photograph fit uses three fit and three withheld controls. The photograph-to-N2073 match uses 35 fit and 36 withheld patches, with withheld error 0.76 native pixels RMS and 3.03 maximum ([controls](source/features/control-measurements.json), [placements](source/features/evidence/image-landmarks.json)).
- The radial projection keeps the observed-versus-estimated class at all 17,518 plate centres.
- A reader oracle ([`encounter.py`](../../../packages/bake/src/objects/layers/terrestrial/missions/encounter.py), [test](../../../packages/bake/src/objects/layers/terrestrial/missions/encounter-fits.oracle.test.mts)) reads the NAVCAM product `n2075we02_rr.fit` with astropy and must agree on headers, 48 sampled radiances, quality flags and pixel counts.
- A trial with the published Hapke parameters cut accepted photographic area from 39.52% to 29.73% and opened large gaps in photographed depressions, so the original photographs stay in use.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `navcam` | 4 | 0 | — | — | — | its other 4 frames | 0 of 4 | — | 4 of 4, 0.00° | — | ×1.02 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The archive completes the hidden side with a fitted triaxial ellipsoid; we use its published vertices without synthesizing terrain. The connecting plates have no physical meaning beyond joining the segments.
- Neutral gray is a model material, not albedo. Close-view facets and texture-cell artifacts are not geological detail.
- The [catalogue](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/catalog/dataset.cat) reports roughly half-nucleus coverage, 50 m horizontal resolution and 6 m vertical precision for the observed terrain, not the inferred side or this display.
- The photographs cover four frames on observed terrain; they are neither global coverage nor an albedo map.
- Phase is arbitrary and fixed.
- Moving each place anchor 15 native pixels in 16 directions shifts it by up to 275 m for Mayo, 272 m for Left Foot and 353 m for Right Foot. The UI calls each location approximate; they have no surveyed centres or boundaries.
- Hemenway and Rahe are withheld because placement is more sensitive. Shoemaker Basin and Walker project onto the estimated side, so they get no label.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
