# 9P/Tempel 1

9P/Tempel 1 was visited by Deep Impact in 2005 and Stardust-NExT in 2011. It is shown on the published nucleus shape with a source-constraints map, photographs from both missions and two infrared views.

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_its_mri-5-tempel1-shape-v2.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles. The [PDS Tempel 1 shape-model release, version 2.0](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=DIF-C-HRIV%2FITS%2FMRI-5-TEMPEL1-SHAPE-V2.0) records the Deep Impact site at about 16° east, 28° south in its `TEMPEL1_2012_PLAN` frame.
- Photographs are the original [NASA PDS imagery](https://pdssbn.astro.umd.edu/holdings/dii-c-its-3_4-9p-encounter-v3.0/dataset.shtml).
- Infrared views use the [PDS version 3 calibrated HRI-IR spectra](https://pds-smallbodies.astro.umd.edu/holdings/dif-c-hrii-3_4-9p-encounter-v3.0/dataset.shtml) from 4 July 2005.
- Smooth regions S1–S4 are read from the map in [Thomas et al. (2013), Fig. 2b](https://ntrs.nasa.gov/api/citations/20140010174/downloads/20140010174.pdf).

[Investigation ledger](investigations.json): tested alternatives and the evidence needed to revisit them.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Views

**Source constraints** uses solid gray for stereo control, blue for limb silhouettes, and the shared gray grid for poorly constrained regions. The published model has 480 stereo control points on about 70% of the nucleus. Flag 1 means stereo control (11104 vertices), flag 2 limb silhouette (1450), and flag 3 not well constrained (3468).

**Deep Impact** (the default) combines eight archived ITS photographs from the 2005 approach. Three cropped close-ups add finer ridges and depressions, reaching 3.1 m/pixel in a small patch over about 6.6 km². Total photographic coverage remains around 31%. **Stardust-NExT** is a separate six-image 2011 view. These are photographs with their original illumination, not albedo or change maps. The grid marks unsupported image/shape correspondence. The [photography method note](source/reference/encounter-photography.md) explains camera registration, image quality, alternatives and uncertainty.

**Color temperature** shows a fitted temperature, weighted toward warmer parts of a detector pixel. **Infrared slope** measures how reflected sunlight changes across 1.5–2.2 µm, in percent per 100 nm; it does not measure terrain steepness or identify minerals. Both are false-color, partial views. The selected scan yields 221 accepted spatial pixels and 1,590 of the model’s 32,040 facets (facet counts, not area percentages). Values span 288.5–309.2 K and 3.461–4.943%/100 nm.

The Deep Impact site and S1–S4 are searchable places. S1–S4 are manually selected map interiors in the displayed frame, not named centres or boundaries.

## Processing

The mesh keeps the published geometry and pole (RA 255°, Dec +64.5°) and is reduced by meshoptimizer to 1000 triangles. The equivalent-volume radius 2.83 km supplies scale only. JPL Horizons elements at JD 2461286.5 supply heliocentric placement; the conic omits perturbations and outgassing. No dust, tails, jets or tumble simulation is included.

The [shared fitter](../../../packages/bake/src/objects/layers/terrestrial/missions/hrii-spectra.ts) follows [Groussin et al. (2013), §§2.2–2.3, equations 1–4](https://doi.org/10.1016/j.icarus.2012.10.003): a solar-normalized continuum anchored at 1.8 µm and a Planck spectrum over 3.1–4.4 µm. All nonzero detector flags are rejected. A visible context image ties the scan to the body frame with a held-out RMS of 71.9 m, suitable only for coarse placement. Only stereo-controlled facets with incidence and emission below 75° qualify. The [scan recipe](source/science/hrii/scan.json) and [preparation record](source/science/hrii/preparation.json) give coverage, fit residuals and withheld pixels.

## Evidence

- **Photometric trials:** the published Hapke parameters reduced accepted photographic area from 32.58% to 24.48% for Deep Impact and from 56.43% to 34.28% for NExT, so both original mosaics remain in use.
- **Infrared fits:** [six native-row fixtures](../../../packages/bake/src/objects/layers/terrestrial/missions/fixtures/comets/hrii-native-reference.json), calculated independently with Astropy and SciPy, agree with the TypeScript fitter within 0.05 K and 0.01 percentage points per 100 nm. These check the fitting, not absolute temperature accuracy.
- **Infrared placement:** the slit fit to native 1.8 µm radiance has correlation 0.989; retained terrain locations give 1.223 native pixels RMS.
- **Reader oracle:** [`encounter.py`](../../../packages/bake/src/objects/layers/terrestrial/missions/encounter.py) reads an ITS product with astropy, and [`encounter-fits.oracle.test.mts`](../../../packages/bake/src/objects/layers/terrestrial/missions/encounter-fits.oracle.test.mts) requires the readings to agree.
- **Labels:** the [whole-body discovery check](../../../packages/renderer/src/node/labels/surface-feature-discovery.test.mts) covers the broad surface places.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deep-impact` | 8 | 0 | — | — | — | its other 8 frames | 7 of 8 | 0.00° | 2 of 8 | — | ×1.02 | registered |
| `next` | 6 | 0 | — | — | — | its other 6 frames | 0 of 6 | — | 0 of 6 | — | ×1.06 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Regenerating the first cropped ITS camera fails its existing registration budget. The shipped camera records and photographs remain unchanged, but earlier successful reproductions do not establish a current pass.
- Close-up registration measures alignment with an earlier photograph. Absolute placement inherits the limb anchor and coarse shape model’s uncertainty; this is not a precise survey of the impact site.
- Infrared placement is coarse. Temperature and slope pixels must not be used to locate small surface features. The terrain controls were selected during method development, so they are not a blind validation set.
- The infrared views are new fits to PDS version 3 spectra, not a reproduction of the 2013 paper’s maps, which used earlier calibration and different meshes. Calibration, unresolved temperature mixtures, scattered light and geometric uncertainty remain. Other scans are not registered and coma contributions are not excluded.
- The Deep Impact label is one approximate point, not a surveyed crater centre or boundary. S1–S4 are broad interpreted units; S1 and S2 fall on weak shape cells (100–300 m radial uncertainty).
- The constraint grid means poorly constrained by stereo or limb methods, not necessarily unobserved. No view claims observed albedo.
- Rotational phase is arbitrary and held fixed; no encounter or current rotation reconstruction is claimed. No measured mass or GM is claimed.
