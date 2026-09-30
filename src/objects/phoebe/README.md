# Phoebe

Phoebe is shown on the 2023 SPC shape from Cassini's 2004 encounter, with its
modeled relative albedo as the default view, radial height, two coverage
diagnostics, one Cassini ISS photograph, and regional Cassini VIMS infrared and
water-ice maps.

## Sources

| Views | Source and quantity |
| --- | --- |
| Relative albedo and Radial height | [Weirich et al. 2023](https://doi.org/10.26033/3k3c-5713), PDS bundle `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps::1.0`, from Cassini's 2004 encounter. The default albedo is modeled relative brightness; Radial height is Q512 radius minus a 106.5 km sphere. |
| Maplet resolution and Image count | The same SPC release: best contributing maplet spacing per 1° cell and all 0–87 image counts, including 3,278 zero-image cells. These are coverage diagnostics, not error estimates or confidence probabilities. |
| ISS photograph | Cassini narrow-angle clear-filter frame `N1465662798_2`, 11 June 2004, CISSCAL-calibrated I/F from the PDS Ring-Moon Systems Node, with its camera from Cassini SPICE kernels (`04161_04164ra.bc`, `041014R_SCPSE_01066_04199.bsp`, `pck00011`). |
| Infrared and Ice absorption | [Nantes Cassini VIMS archive](https://vims.univ-nantes.fr/), 11 June 2004, observation IR 1465671822_1. False-color infrared channels and continuum-relative near-2.02 µm absorption use 41 accepted native pixels. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/PHOEBE/target) Phoebe centre-point export, public domain. Labels appear at the closest zoom only. |
| Feature notes | 1 caption note is the lead summary of its English Wikipedia article (CC BY-SA 4.0), pinned in `source/features/notes.json`; the caption credits Wikipedia. |

Source selections, recorded trials and open questions are in the
[investigation ledger](investigations.json). NASA Photojournal figure PIA06403
did not qualify as a map view: its grids carry no coordinate labels.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The official OBJ has 99,846 vertices and 196,608 triangles. Meshoptimizer 1.2.0
reduces it to 2,000 closed, consistently wound triangles, keeping source
positions. The native Q512 cubes are 2222 × 1111 pixels at 301.26023555494 m.
Numeric sampling and support masks use nearest source pixels. The Radial height
scale is −15 to +15 km.

The ISS camera is refined to the lit limb by a 0.0095° rotation (21 pixels).
Brightness is disk-normalized with an empirical Lommel-Seeliger law; it is not
measured albedo. The frame is at 86° phase, so only the sunlit half of the disc
is used and the dataset covers 14.6% of the surface.

Infrared assigns native VIMS channels near 2.02, 1.59 and 1.28 µm to red, green
and blue. Ice absorption is `1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)`.
Saturated, special and missing values are excluded per band, and gaps are not
interpolated. The [recipe](source/cassini-ice/prepare.json) pins the
wavelengths, masks and arithmetic.

Named features are cast through the prepared hit mesh so every anchor sits on
the shape model. Craters and faculae trace a rim circle, other types their
published extent box.

## Evidence

![N1465662798_2 with Phoebe's outline from the kernel camera (red) and after limb refinement (green)](evidence/iss-limb-refinement.png)

![Map previews: relative albedo (top) and the ISS photograph dataset (bottom)](evidence/iss-map-comparison.png)

- **Display mesh:** four barycentric samples per face give a maximum distance of 1,423.5 m, p95 603.6 m and RMS 308.6 m to the full source mesh. The [2023 geometry check](source/validation/2023-geometry-qualification.json) records the earlier comparison.
- **ISS camera:** before refinement the kernel camera put the limb 4 to 26 pixels from the photographed one in eight approach frames, about 7 to 10 km on Phoebe, consistent with a target position offset rather than pointing.
- **VIMS registration:** a two-angle fit has seven untouched limb checks with a maximum residual of 0.704 fast sample. The [body registration record](source/cassini-ice/evidence/registration.md) and [preparation receipt](source/cassini-ice/preparation-receipt.json) hold the checks.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `iss` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 1 of 1 | turn declined: the relief reference is not decisive over 3 frames | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **SPC albedo and height:** finite Q512 values include unsupported interpolation. Display requires at least five images and maplet spacing no worse than 1500 m/vertex. This conservative policy is not a published truth mask. Relative albedo is not natural color, geometric albedo or composition.
- **Display mesh:** the 2,000-face display does not satisfy the earlier 1,195 m sampled criterion, and it shows coarse lighting facets.
- **VIMS coverage and placement:** both views cover about 1.84% of reference-sphere solid angle. Registration is coarse, with several-kilometer placement uncertainty, and has not been rerun against the current 2,000-face display. IR 1465670650_1 is withheld for systematic holdout bias.
- **VIMS interpretation:** neither view measures ice abundance. No photometric correction or level matching is applied. Native gaps remain missing, and packing can soften infrared mask edges.
- **Named features:** outlines are not published nomenclature boundaries.
- The retained rotation phase has no new qualification. The SBIB regional RGB candidate has no qualified registration to the revised shape and center.
- Display atlases use half dimensions, which reduces display detail, not the source observations.
