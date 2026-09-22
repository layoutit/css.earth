# 103P/Hartley 2

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_mri-5-hartley2-shape-v1.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles.

- The EPOXI mosaic combines three MRI images and two mission-restored HRI images from the short 4 November 2010 encounter sequence.

- [Thomas et al. (2013)](https://ntrs.nasa.gov/api/citations/20140009994/downloads/20140009994.pdf), Figures 3 and 7, maps the waist and smooth large-lobe terrain in the same east-positive planetocentric frame as the PDS shape model. The three source landmarks retain its published panel centres or a plainly approximate regional point.

## Infrared views

**Color temperature** and **Infrared slope** use the [PDS version 3 calibrated HRI-IR spectra](https://pds-smallbodies.astro.umd.edu/holdings/dif-c-hrii-3_4-epoxi-hartley2-v3.0/dataset.shtml) from 4 November 2010. The first shows a fitted temperature, weighted toward warmer parts of a detector pixel. The second measures how reflected sunlight changes across 1.5–2.2 µm, in percent per 100 nm. It does not measure terrain steepness or identify minerals. Both are false-color, partial views with approximate placement on the 2012 shape.

The selected scan yields 162 accepted spatial pixels and 757 of the model’s 32,040 facets. These are **facet counts, not area percentages**. The retained values span 337.2–364.3 K and −0.077–4.490%/100 nm. Both views use the same missing-data mask and keep Shadows off by default. The grid marks rejected spectra, unsupported shape, and gaps; it is not filled from nearby values.

[Investigation ledger](investigations.json): tested alternatives and the evidence needed to revisit them. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Photometric trial, 2026-09-13:** a trial with the published Hapke parameters reduced accepted photographic area from 57.98% to 32.00%. Eight of ten overlap pairs improved, but much of the photographed terrain became grid. The original EPOXI mosaic remains in use. [Parameters, measurements and limitations](evidence/photometry/trial.json) record the diagnostic trial; the original paper's H-function approximation remains unverified.

- **Recipe update, 2026-09-13:** a full preparation after merging main's observation recipes (`2f2752abb` plus this infrared change) preserves all 46 delivered images byte-for-byte against `be628e35f`. Runtime values are unchanged, so the earlier browser captures still apply to the comet views. The photographic display fields, source pins and navigation receipts use the new shared recipe; source/package and numerical-frame checks pass.

- **Infrared browser checks, 2026-09-13:** [temperature](evidence/infrared/temperature.png) and [continuum slope](evidence/infrared/spectral-slope.png) in the running application, on base `0636327b` plus this infrared addition. Both datasets render with correct legends, grid gaps, and Shadows off. Selecting either dataset turns to its measured region. Dataset switching, rotation and zoom were exercised; the shared mobile information sheet was checked at 390 × 844. The desktop captures are 1280 × 720 and show new views, not a before/after pixel comparison.
- **Reproduction and closure:** both declared field tables and preparation records reproduce byte-for-byte through the acquisition operator from isolated native input copies. All 36 focused acquisition, spectrum, camera and facet tests, six affected body source/package checks, and four mesh/landmark checks passed. Preparation build and typecheck passed. This is focused validation, not an all-body suite result.

- **Infrared numerical checks, 2026-09-13:** [six native-row fixtures](../../../tests/objects/fixtures/comets/hrii-native-reference.json), calculated independently with Astropy BlackBody and SciPy optimization, agree with the TypeScript fitter within 0.05 K and 0.01 percentage points per 100 nm. Synthetic spectra also verify units, reflected-light subtraction, masking, and free thermal amplitude. These check decoding/fitting, not absolute temperature accuracy or global coverage.
- The [scan recipe](source/science/hrii/scan.json) pins the original exposures, solar spectrum, source mesh, context image and terrain controls. Its [reproduced preparation record](source/science/hrii/preparation.json) gives coverage, fit residuals and withheld-pixel counts. The native facet table is paired with this exact source shape before bounded transfer to the existing 1000-triangle display.

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

- The [constraint-grid qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/CONSTRAINT-GRIDS.md) records checks and captured views.

- The [shared qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/QUALIFICATION.md) records verification.

- The [landmark source record](source/features/landmarks.json) links each location to the published figure and records its coordinate precision.

- **Surface places, 2026-09-12:** preparation and the runtime parser accepted three locations; three focused unit tests passed. Browser inspection on base `53b262bd` with this addition covered the waist search, camera arrival and EPOXI dataset. The published catalog passed a fresh byte-count and SHA-256 check. Surface assets are unchanged.

- **Reader oracle, 2026-09-12:** `tools/oracles/fits/encounter.py` reads the pinned MRI product `mv10110413_6000001_001_r.fit` with astropy. `tools/objects/terrestrial-layers/encounter-fits.oracle.test.mts` requires the HDU names, the header identity, 48 sampled radiances and quality flags, and the counts of accepted, border, flagged and non-finite pixels to agree.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mri` | 5 | 0 | — | — | — | its other 5 frames | 4 of 5 | 0.50° | 0 of 5 | — | ×1.02 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Infrared placement is coarse. Terrain residuals test alignment relative to the existing photographic/body frame; they do not establish an independent absolute position. That frame inherits source shape and earlier photographic-anchor uncertainty. Temperature and slope pixels must not be used to locate small surface features.
- These are new fits to PDS version 3 spectra, not a reproduction of the 2013 paper’s published maps. That paper used earlier calibration and different meshes. Its quoted temperature errors cannot simply be assigned to these views. Calibration, unresolved temperature mixtures, scattered light and geometric uncertainty remain.

- The default Source constraints lens uses solid gray for stereo control, blue for limb silhouettes, and the shared gray grid for poorly constrained regions. The grid means poorly constrained by those methods, not necessarily wholly unobserved. Neither view claims observed albedo.

- EPOXI photographic coverage is about 56% of the displayed surface; the remaining grid has no accepted photograph/shape correspondence. Original shadows and restoration grain remain.

- The cartographic north direction follows the long axis at the 2010 encounter, not a spin pole. Hartley 2 tumbles; this display holds an arbitrary rotational phase and does not simulate that motion.

- The landmarks are mapped terrain, not official names or precise boundaries. Two are published figure-panel centres; the elongate smooth area is a representative point read from the map. The ±3° and ±12° placement estimates are ours, not published measurement errors.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="103phartley-2-source-and-interpretation"></a>

Kilometres convert to metres; east-positive longitude and north-positive latitude define the released right-handed frame. Original table, label and catalogue bytes are pinned in source/manifest.json.

103P/Hartley 2 is the elongated, two-lobed comet visited by EPOXI in 2010. 244 stereo control points on about half the nucleus.

All published geometry is retained before simplification. Flag 1 means stereo control (7431 vertices), flag 2 limb silhouette (4745), and flag 3 not well constrained (3846). Flag counts are vertex counts, not surface-area percentages. Weak regions are the original authors' estimates, not additional cssEarth terrain. The Shape model view uses the same grid for flag 3 and neutral gray for flags 1 and 2. Nearest 2-degree grid sampling prepares the categorical map; raster filtering softens visual category boundaries and is not a quantitative uncertainty interpolation.

The published equivalent-volume radius 0.58 km supplies scale only; it does not replace the mesh. No measured mass or GM is claimed (the astronomy registry uses its existing zero-for-unknown convention). JPL Horizons elements at JD 2461286.5 supply heliocentric placement; the conic omits perturbations and outgassing. Lighting uses that common epoch and the declared display orientation, not a reconstruction of encounter photographs. No dust, tails, jets or tumble simulation is included.

Meshoptimizer retains original source vertices and closed, consistently wound connectivity, reduced to 1000 triangles. Estimated simplification error 6.463547706604004 m is neither a measurement uncertainty nor a Hausdorff bound. Original-mesh normals and cast shadows are baked into fixed atlases; no geometry, maps or illumination are computed at runtime.

The source grid is selected by categorical flags before raster filtering and lighting. Both atlases per lens, their thumbnails, the constraint minimap, and the model-view context image/navigation marker use the same preparation. Geometry, native triangle leaves, camera and lighting recipes are unchanged.

The finest accepted detector sampling supplies each patch; MRI fills regions outside the HRI footprints. The same source-mesh, registration and visibility limits apply to all five images. See [the photographic source record](source/reference/encounter-photography.md).

</details>

<details>
<summary>HRI-IR scan preparation and placement</summary>

The [shared fitter](../../../tools/objects/terrestrial-layers/hrii-spectra.mts) follows the spectral separation in [Groussin et al. (2013), §§2.2–2.3, equations 1–4](https://doi.org/10.1016/j.icarus.2012.10.003). It fits a solar-normalized continuum anchored at 1.8 µm and a Planck spectrum with a free amplitude over 3.1–4.4 µm. We iterate the two fits to remove the thermal tail from the continuum. All nonzero detector flags, including partially saturated and interpolated samples, are rejected; incomplete or poorly fitted spectra remain missing. The archived Sunshine solar table supplies irradiance at 1 AU. No spectra or geometry are computed by the browser.

The 57 retained exposures preserve detector rows as the along-slit axis; detector columns are wavelengths. Reconstructed observer positions and boresights supply the time-dependent scan camera. The visible context image `hv10110413_5002068_001_d050` is tied to the existing source body frame with 13 fitting and 14 held-out terrain correspondences. Its held-out RMS is 17.2 m and maximum 49.0 m, suitable only for this coarse infrared placement.

Two slit offsets are then fitted to native 1.8 µm radiance. Four terrain patches and their 9×9-pixel neighborhoods are excluded from that fit. The dense fit uses 403 pixels, with correlation 0.814; withheld-image correlation is 0.648. Retained terrain locations give 1.350 native pixels RMS and 1.705 pixels maximum error. The search and every residual are recalculated during acquisition. Controls were identified by local normalized image correlation; their recorded coordinates are measured preparation inputs, not a claim that the mission supplied these pointing corrections.

The controls were selected during method development. “Held-out” means excluded from the numerical pointing fit, not an untouched blind validation set. The dataset opening view faces the mean direction of the accepted facet centers.

Only stereo-controlled facets qualify. Both incidence and emission must be below 75°, and a two-pixel neighborhood around each accepted spectrum must remain on supported nucleus geometry. Facet centers receive the nearest visible slit footprint, without averaging across spectra or missing facets. The CSV stores all source centroids plus temperature, slope, scan frame and detector row. Every centroid is checked against the original PDS mesh; the display transfer remains within its existing simplification budget.

The broader scan and source survey is retained in the development history. Other inbound and outbound scans remain candidates; the present views do not establish their registration or exclude coma contributions. Hartley’s Dryad copies use a different calibration from PDS V3, so the delivered data are restored directly from PDS. The Dryad thermal-model arrays are modeled temperatures and are not substituted for observations.

</details>
