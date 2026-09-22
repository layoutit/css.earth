# 9P/Tempel 1

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_its_mri-5-tempel1-shape-v2.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles.

- 9P/Tempel 1 was visited by Deep Impact in 2005 and Stardust-NExT in 2011.

- The [PDS Tempel 1 shape-model release, version 2.0](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=DIF-C-HRIV%2FITS%2FMRI-5-TEMPEL1-SHAPE-V2.0) records the Deep Impact site at about 16° east, 28° south in its `TEMPEL1_2012_PLAN` frame.

## Surface places

The Deep Impact site and four smooth regions, S1–S4, are searchable places. S1–S4 are representative interiors read from the simple-cylindrical, east-longitude/latitude map in [Thomas et al. (2013), Fig. 2b](https://ntrs.nasa.gov/api/citations/20140010174/downloads/20140010174.pdf). The retained PDF hash is `33cc898a17b33c68a83bd451f901d11220ec3bb1fae4d17690787e8717849429`.

The paper is the cited source of the PDS V2 shape model and uses its pole and reference-crater prime meridian, so these coordinates are in the displayed `TEMPEL1_2012_PLAN` frame. They are manually selected map interiors, not named centres or boundaries. Fig. 2b samples about 0.42° per pixel. S1 and S2 fall on locally weak PDS shape cells (100–300 m radial uncertainty); S3 and S4 fall on stereo-controlled cells (under 60 m). Those shape bounds do not make the broad terrain-map placements precise surveys.

## Photographic views

**Deep Impact** combines eight archived ITS photographs from the 2005 approach. Three cropped close-ups add finer ridges and depressions within the existing view; source sampling reaches 3.1 m/pixel in a small patch. They improve detail over about 6.6 km² of the displayed surface. Total photographic coverage remains around 31%.

**Stardust-NExT** retains its separate six-image 2011 view. These are photographs with their original illumination, not albedo or change maps. The grid marks unsupported image/shape correspondence. Shadows defaults to Off.

Both use the original [NASA PDS imagery](https://pdssbn.astro.umd.edu/holdings/dii-c-its-3_4-9p-encounter-v3.0/dataset.shtml) and fixed 2012 source shape. The display stays at 1000 triangles. The [photography method note](source/reference/encounter-photography.md) explains camera registration, image quality, alternative sources, uncertainty and reproducible preparation.

## Infrared views

**Color temperature** and **Infrared slope** use the [PDS version 3 calibrated HRI-IR spectra](https://pds-smallbodies.astro.umd.edu/holdings/dif-c-hrii-3_4-9p-encounter-v3.0/dataset.shtml) from 4 July 2005. The first shows a fitted temperature, weighted toward warmer parts of a detector pixel. The second measures how reflected sunlight changes across 1.5–2.2 µm, in percent per 100 nm. It does not measure terrain steepness or identify minerals. Both are false-color, partial views with approximate placement on the 2012 shape.

The selected scan yields 221 accepted spatial pixels and 1,590 of the model’s 32,040 facets. These are **facet counts, not area percentages**. The retained values span 288.5–309.2 K and 3.461–4.943%/100 nm. Both views use the same missing-data mask and keep Shadows off by default. The grid marks rejected spectra, unsupported shape, and gaps; it is not filled from nearby values.

[Investigation ledger](investigations.json): tested alternatives and the evidence needed to revisit them. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Photometric trials, 2026-09-13:** trials with the published Hapke parameters reduced accepted photographic area from 32.58% to 24.48% for Deep Impact and from 56.43% to 34.28% for NExT. Overlap differences improved in only 11 of 28 and four of 15 pairs, respectively. Both original photograph mosaics remain in use. [Parameters, measurements and limitations](evidence/photometry/trial.json) record these diagnostic trials, including the unverified original H-function approximation and the filter mismatch.

- **Recipe update, 2026-09-13:** a full preparation after merging main's observation recipes (`2f2752abb` plus this infrared change) preserves all 49 delivered images byte-for-byte against `be628e35f`. Runtime values are unchanged, so the earlier browser captures still apply to the comet views. The photographic display fields, source pins and navigation receipts use the new shared recipe; source/package and numerical-frame checks pass.

- **Infrared browser checks, 2026-09-13:** [temperature](evidence/infrared/temperature.png) and [continuum slope](evidence/infrared/spectral-slope.png) in the running application, on base `0636327b` plus this infrared addition. Both datasets render with correct legends, grid gaps, and Shadows off. Selecting either dataset turns to its measured region. Dataset switching, rotation and zoom were exercised; the shared mobile information sheet was checked at 390 × 844. The desktop captures are 1280 × 720 and show new views, not a before/after pixel comparison.
- **Reproduction and closure:** both declared field tables and preparation records reproduce byte-for-byte through the acquisition operator from isolated native input copies. All 36 focused acquisition, spectrum, camera and facet tests, six affected body source/package checks, and four mesh/landmark checks passed. Preparation build and typecheck passed. This is focused validation, not an all-body suite result.

- **Infrared numerical checks, 2026-09-13:** [six native-row fixtures](../../../tests/objects/fixtures/comets/hrii-native-reference.json), calculated independently with Astropy BlackBody and SciPy optimization, agree with the TypeScript fitter within 0.05 K and 0.01 percentage points per 100 nm. Synthetic spectra also verify units, reflected-light subtraction, masking, and free thermal amplitude. These check decoding/fitting, not absolute temperature accuracy or global coverage.
- The [scan recipe](source/science/hrii/scan.json) pins the original exposures, solar spectrum, source mesh, context image and terrain controls. Its [reproduced preparation record](source/science/hrii/preparation.json) gives coverage, fit residuals and withheld-pixel counts. The native facet table is paired with this exact source shape before bounded transfer to the existing 1000-triangle display.

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. The 68 catalog and terrain checks passed at `2c24ca749`, after merging main's photographic updates. The [browser capture](evidence/terrain-places/whole-body-2c24ca749.jpg), taken in the in-app browser at 1280 × 720, shows S2 and the Deep Impact site without a selected place at whole-body framing on the NExT lens. Rotating at the same distance also revealed S1. The label change preserves coordinates, captions, mesh, imagery and screen-size admission.

- The [close-up comparison and browser record](evidence/closeups/README.md) show the eight-image result at the same camera and at DPR 1 and 2.

- The [constraint-grid qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/CONSTRAINT-GRIDS.md) records checks and captured views.

- The [shared qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/QUALIFICATION.md) records verification.

- **Surface place, 2026-09-12:** preparation and the runtime parser accepted the
  Deep Impact site; three focused unit tests passed. On base `53b262bd` with this
  addition, searching for the site and switching to the 2005 photographs showed
  its qualified caption. [Browser capture](evidence/surface-places.png).
  The published catalog passed a fresh byte-count and SHA-256 check.

- **S1–S4 terrain places, 2026-09-12:** three focused checks reproduce the map
  coordinates and validate all five catalog entries against the retained mesh.
  Browser searches selected all four new places; S1 was inspected with the
  constraint grid, and S2–S4 with the 2011 photographs. This uses base
  `ca704866` plus the terrain additions. Photographic and mesh asset pins are
  unchanged; their previous preparation is reused. A full source verification
  could not run because the original PDS shape table is unavailable locally
  and its archive is unreachable over HTTPS.

- **Reader oracle, 2026-09-12:** `tools/oracles/fits/encounter.py` reads the pinned ITS product `iv05070405_9000632_001_r.fit` with astropy. `tools/objects/terrestrial-layers/encounter-fits.oracle.test.mts` requires the HDU names, the header identity, 48 sampled radiances and quality flags, and the counts of accepted, border, flagged and non-finite pixels to agree.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `deep-impact` | 8 | 0 | — | — | — | its other 8 frames | 7 of 8 | 0.00° | 2 of 8 | — | ×1.02 | registered |
| `next` | 6 | 0 | — | — | — | its other 6 frames | 0 of 6 | — | 0 of 6 | — | ×1.06 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Close-up replay, 2026-09-13:** regenerating the first cropped ITS camera fails its existing registration budget with both main's matcher (`fc4dfc18`) and the radiance-unit fix (`8475dd92`). The regenerated control records are identical. The [replay comparison](evidence/registration/closeup-replay.json) preserves input identities and the failure; earlier successful reproduction reports do not establish a current pass. The shipped camera records and photographs remain unchanged.
- Infrared placement is coarse. Terrain residuals test alignment relative to the existing photographic/body frame; they do not establish an independent absolute position. That frame inherits source shape and earlier photographic-anchor uncertainty. Temperature and slope pixels must not be used to locate small surface features.
- These are new fits to PDS version 3 spectra, not a reproduction of the 2013 paper’s published maps. That paper used earlier calibration and different meshes. Its quoted temperature errors cannot simply be assigned to these views. Calibration, unresolved temperature mixtures, scattered light and geometric uncertainty remain.

- Close-up registration measures alignment with an earlier photograph. Absolute placement still inherits the limb anchor and coarse shape model’s uncertainty; this is not a precise survey of the impact site.

- The Deep Impact label is one approximate point, not a surveyed crater centre or boundary. Its 16° east, 28° south position follows the PDS 2012 shape model's east-positive, planetocentric frame; it is not transferred between the photographic views.

- S1–S4 are broad interpreted units. Their captions preserve the authors' qualified flow interpretation; no separate scarp point is claimed because the paper does not publish one in this frame.

- The default Source constraints lens uses solid gray for stereo control, blue for limb silhouettes, and the shared gray grid for poorly constrained regions. The grid means poorly constrained by those methods, not necessarily wholly unobserved. Neither view claims observed albedo.

- Flag counts are vertex counts, not surface-area percentages. Weak regions are the original authors' estimates, not additional cssEarth terrain.

- Rotational phase is arbitrary and held fixed; no encounter or current rotation reconstruction is claimed.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="9ptempel-1-source-and-interpretation"></a>

Kilometres convert to metres; east-positive longitude and north-positive latitude define the released right-handed frame. Original table, label and catalogue bytes are pinned in source/manifest.json.

Their images constrain the published nucleus model. 480 stereo control points on about 70% of the nucleus. The combined model pole is retained at RA 255°, Dec +64.5°.

All published geometry is retained before simplification. Flag 1 means stereo control (11104 vertices), flag 2 limb silhouette (1450), and flag 3 not well constrained (3468). The Shape model view uses the same grid for flag 3 and neutral gray for flags 1 and 2. Nearest 2-degree grid sampling prepares the categorical map; raster filtering softens visual category boundaries and is not a quantitative uncertainty interpolation.

The published equivalent-volume radius 2.83 km supplies scale only; it does not replace the mesh. No measured mass or GM is claimed (the astronomy registry uses its existing zero-for-unknown convention). JPL Horizons elements at JD 2461286.5 supply heliocentric placement; the conic omits perturbations and outgassing. Lighting uses that common epoch and the declared display orientation, not a reconstruction of encounter photographs. No dust, tails, jets or tumble simulation is included.

Meshoptimizer retains original source vertices and closed, consistently wound connectivity, reduced to 1000 triangles. Estimated simplification error 25.353675842285156 m is neither a measurement uncertainty nor a Hausdorff bound. Original-mesh normals and cast shadows are baked into fixed atlases; no geometry, maps or illumination are computed at runtime.

The source grid is selected by categorical flags before raster filtering and lighting. Both atlases per lens, their thumbnails, the constraint minimap, and the model-view context image/navigation marker use the same preparation. Geometry, native triangle leaves, camera and lighting recipes are unchanged.

</details>

<details>
<summary>HRI-IR scan preparation and placement</summary>

The [shared fitter](../../../tools/objects/terrestrial-layers/hrii-spectra.mts) follows the spectral separation in [Groussin et al. (2013), §§2.2–2.3, equations 1–4](https://doi.org/10.1016/j.icarus.2012.10.003). It fits a solar-normalized continuum anchored at 1.8 µm and a Planck spectrum with a free amplitude over 3.1–4.4 µm. We iterate the two fits to remove the thermal tail from the continuum. All nonzero detector flags, including partially saturated and interpolated samples, are rejected; incomplete or poorly fitted spectra remain missing. The archived Sunshine solar table supplies irradiance at 1 AU. No spectra or geometry are computed by the browser.

The 40 retained exposures preserve detector rows as the along-slit axis; detector columns are wavelengths. Reconstructed observer positions and boresights supply the time-dependent scan camera. The visible context image `hv05070405_9000844_001_r` is tied to the existing source body frame with 10 fitting and 17 held-out terrain correspondences. Its held-out RMS is 71.9 m and maximum 180.0 m, suitable only for this coarse infrared placement.

Two slit offsets are then fitted to native 1.8 µm radiance. Four terrain patches and their 9×9-pixel neighborhoods are excluded from that fit. The dense fit uses 2031 pixels, with correlation 0.989; withheld-image correlation is 0.998. Retained terrain locations give 1.223 native pixels RMS and 1.656 pixels maximum error. The search and every residual are recalculated during acquisition. Controls were identified by local normalized image correlation; their recorded coordinates are measured preparation inputs, not a claim that the mission supplied these pointing corrections.

The controls were selected during method development. “Held-out” means excluded from the numerical pointing fit, not an untouched blind validation set. The dataset opening view faces the mean direction of the accepted facet centers.

Only stereo-controlled facets qualify. Both incidence and emission must be below 75°, and a two-pixel neighborhood around each accepted spectrum must remain on supported nucleus geometry. Facet centers receive the nearest visible slit footprint, without averaging across spectra or missing facets. The CSV stores all source centroids plus temperature, slope, scan frame and detector row. Every centroid is checked against the original PDS mesh; the display transfer remains within its existing simplification budget.

The broader scan and source survey is retained in the development history. Other inbound and outbound scans remain candidates; the present views do not establish their registration or exclude coma contributions. Hartley’s Dryad copies use a different calibration from PDS V3, so the delivered data are restored directly from PDS. The Dryad thermal-model arrays are modeled temperatures and are not substituted for observations.

</details>
