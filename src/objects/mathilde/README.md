# Mathilde

Mathilde is shown with the Stooke shape model, a Monochrome photomosaic, Elevation from Thomas radii, and two native NEAR close-up photographs from 27 June 1997.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Visible shape | [Stooke 5° visualization model](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/253mathilde.xml): 2016 model migrated to PDS4 in 2025. Smoothed unseen areas and modified shadowed crater floors are aesthetic modeling. |
| Elevation | [Thomas 3° radii](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathilde.xml), minus 26.4 km; false-color scale −11 to +10 km. The [legacy label](https://sbnarchive.psi.edu/pds3/near/NEAR_A_5_COLLECTED_MODELS_V1_0/data/msi/253mathilde.lbl) identifies 26.5 km as missing, never measured height. |
| Monochrome | [Stooke/Pfau photomosaic](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/253mathilde/matcyl1.jpg), partial NEAR MSI observations from 27 June 1997. Processed visualization, not calibrated albedo or natural color. |
| NEAR close-ups | Two native calibrated broadband MSI photographs, MET 42826360 and 42826370, from 27 June 1997. [PDS image metadata](https://sbnarchive.psi.edu/pds4/near/near.msi_v1.0/data_calibrated/mathilde/1997/178/iof/m0042826360f0_2p_iof.xml), paired raw detector frames and [Thomas reconstructed image geometry](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/data/253mathimg.xml). Partial observations with original illumination, not recovered albedo. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MATHILDE/target) Mathilde centre-point export, snapshot 2026-09-11, public domain. Labels appear at the closest zoom only, and a selected feature stays labelled. |

Four labelled names carry a caption note from the lead of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption beside the IAU naming year. The JPL Horizons physical header, pinned in `source/reference/horizons-physical.txt`, reports radius 26.4 km, GM 0.00689 km³/s² and period 417.7 hours. The [map guide](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) describes the photomosaic's display processing and excludes photometric analysis.

## Processing

**Shape.** The Stooke grid is read as a closed mesh of 5,040 triangles and simplified with meshoptimizer 1.2.0 to 750 faces that keep source vertices. meshoptimizer estimates the largest displacement at 596.7 m, under the recipe's 600 m limit. This measures fit to the published visualization model, not observational truth. Every dataset draws on this one mesh; until 5 October 2026 the NEAR close-ups drew on it and the other two datasets on a second 800-face mesh cut from the same grid, whose ray-checked fit (mean 153.987 m, maximum 1,245.038 m) no longer describes what is shown.

**Elevation** encodes Thomas radius minus the 26.4 km JPL reference sphere, in kilometers. It is radial height including broad shape, not gravitational elevation. Exactly 3,688 rows carry the 26.5 km placeholder. It is rejected in source units before interpolation, and any footprint touching it is withheld. The current PDS4 label omits this caveat, so the legacy label is kept. Relief uses no vertical exaggeration.

**Monochrome.** The Stooke JPEG is 3,600 × 1,800 pixels, 10 per degree, and has no numeric missing-data mask. Preparation marks only north-edge-connected pixels in the narrow interval [75,81] as exterior fill. There is no photographic fill or invented backside imagery. The map is north-up with east longitude increasing from 0 at left to 360 at right; the pinned Thomas `253mathm.fit` plot with printed axes establishes that sense.

**NEAR close-ups.** The [NEAR camera recipe](source/preparation/near-msi.json) uses the reconstructed geometry of `253mathimg.tab`, with the 166.85 mm focal length and 16 × 27 µm pixels of [Murchie et al. (1999), section 4.1](https://doi.org/10.1006/icar.1999.6118). The table-to-detector convention is an inference, checked by native projection and withheld limb residuals. `node packages/bake/authoring/near-msi/prepare-cameras.mts` reproduces the camera inputs, and `node packages/bake/authoring/near-msi/capture-registration.mts` reproduces the source projection. The shared adapter refines pointing with the limb fitter, checks ray visibility on the Stooke mesh, and transfers samples to its 750-face simplification. Missing telemetry, saturated and invalid values are rejected; finite negative I/F stays. The second frame takes a relative display gain of 0.9142 from 735 matched samples. Selection follows frame order, never brightness. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling.

**Orientation and lighting.** Thomas chose an arbitrary prime meridian because the spin pole was not solved. `source/preparation/rotation.json` has no measured spin rate and makes no phase claim. The Shadows control adds illustrative directional lighting, not a timed Mathilde Sun solution.

## Evidence

The two 537 × 244 NEAR frames qualify over an estimated **14.2% of the display mesh’s area**, sampled at 16 points per triangle. Camera corrections are 0.039° and 0.068°. Disjoint limb holdouts retain 31/32 and 74/76 controls, with RMS residuals of 1.24 and 1.69 native pixels. These validate silhouette alignment, not interior terrain accuracy. The prepared report (`prepared/surfaces.json`) records cameras, masking, overlap gains and area sampling.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `near-msi` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- NEAR close-ups have substantial gaps, including areas photographed too obliquely or not supported by the image-to-shape checks. Native shadows, noise, readout smear and scattered light remain. Original photograph shadows remain when Shadows is off.
- PDS warns that the archive quality index is not fully understood: `20000000` stays unresolved, not a good-quality verdict. There is no per-pixel quality plane.
- Stooke aesthetically modified shadowed crater floors and unseen areas, so limb alignment cannot prove interior crater registration. The visible Stooke shape differs from the Thomas radii used for Elevation. Neither product establishes global measured terrain.
- The photomosaic keeps photograph shading, deep shadows, blurred patches and compositing seams. Its exterior test is uncertain, so ambiguous pixels can remain.
- Feature outlines trace a rim circle for craters and an extent box for other types; they are not published nomenclature boundaries.
- Pole, phase and added directional lighting are illustrative.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
