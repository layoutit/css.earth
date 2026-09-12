# Joint image and molecular-velocity fit

Open `/reconstruction?subject=helix-model-prior&inspection=joint`. This experiment fits two coarse molecular-wall hypotheses to registered image ridges and published HCO+ velocities, then prepares both as rotatable neutral PolyCSS volumes. It does not reconstruct the complete Helix or replace the earlier tuned shape cloud.

## Use the comparison

- **Shell / Lobes** selects an already prepared candidate. The golden line is that candidate's projected central surface; its soft 3D emission has an authored thickness around this surface.
- **Ridge threshold / Minimum length** controls the connected image evidence. **Image weight / Velocity weight** changes the joint objective. They refit automatically and retain the old model and camera until the replacement is decoded.
- **Source image / Ridges / Pointings** changes inspection only. The photograph stays registered in the Earth projection; **Orbit** rotates the hypothesis on the right. **Earth view** restores their common angular scale and orientation.
- Filled pointings trained the fit; dashed pointings were withheld. Green through red shows the largest absolute component mismatch at each pointing. Hover for every measured/predicted component. A missing intersection is an explicit modeling failure, not a measured residual.
- **Train / Held out** reports RMS for matched velocity components only, alongside missing counts. Missing training intersections still incur a penalty in the objective. Neither the fit score nor a low RMS establishes physical correctness.

The view inherits the source weights, sensitivity and saved image transforms used in Combined. Its own controls and durable job pointer survive refresh. Selecting a source, candidate or camera does not fit again. Opening this experimental view prepares a missing result using the already approved image evidence; it never repeats star separation.

## Observations and registration

Image inputs are the same three registered ESO working rasters described in the [multimodal workflow](multimodal-workflow.md). Their full footprints remain in the fused grid. The joint comparison displays a centered 1430″ square; this display window does not crop the source catalogue or density data. The initial wall fit uses ridges 120–650″ from the configured center. This annulus is an engineering selection, not measured separation of molecular and ionized material. The complete ridge graph remains in the receipt; excluded points are counted.

The new velocity input is [Zeigler, Zack, Woolf & Ziurys (2013), ApJ 778, 16](https://doi.org/10.1088/0004-637X/778/1/16), Table 1 and §§2–3, restored from the [CDS catalogue](https://doi.org/10.26093/cds/vizier.17780016). The [source recipe](../models/helix/kinematics-hco.json) preserves column definitions, exact download identities, credits and interpretation.

| Pinned table | Meaning |
| --- | --- |
| 327 rows, 218 distinct pointings | Actual table contents; the paper's 219 pointings/168 detections disagree with the table and remain unresolved. |
| 279 detected components at 170 pointings | Repeated offsets are separate fitted velocity components, not separate sightlines. |
| 48 intensity upper limits | Retained in the catalogue; they supply no measured velocity and are not fitted. No central `(0,0)` row is present. |
| 70″ beam, 35″ or 70″ spacing | Half-beam spacing does not double independent spatial resolution. |
| Published LSR velocities | Kept unchanged. Fitted FWHM and 1.68 km/s spectral resolution are not centroid uncertainties; none are published per component. |

The table's offset origin is J2000 **22:29:38.6 −20:50:18**, not the different coordinate in the CDS object-lookup metadata. Convert positive-east offsets to negative x in the lab's west/north/away frame, then translate this actual origin to the registered image center. The small-angle anchor translation is appropriate to this coarse beam comparison; it is not a precision FK5–ICRS transformation. Source offsets do not receive another cosine factor.

The systemic prior is −23.98 ± 2 km/s LSR, obtained from the earlier −27.1 ± 2 km/s heliocentric value using the paper's explicit **LSR = heliocentric + 3.12 km/s** relation. This conversion affects the model prior only. The existing inner [O III] core slit remains an independent inspection; it is not assigned to this molecular wall.

## Model and objective

The ridge graph skeletonizes thresholded multiband ridge support. It records connected branches, source scores, tangents and coverage; it does not bridge gaps. Minimum length filters whole components, retaining junction branches. These are pixel-center skeletons, not subpixel ridge maxima, measured widths or verified physical filaments. Residual stellar halos can contribute.

Both shape families are centered, axisymmetric, star-shaped surfaces. The ellipsoid has an adjustable polar/equatorial ratio. The bipolar family multiplies its radial profile by a fixed waisting term `1 − 0.45(1 − μ²)²`, where μ is the axial direction cosine. This is an authored alternative, not a published hydrodynamical Helix model. The fit varies radius, depth ratio, inclination, position angle, expansion scale and systemic velocity in a bounded grid plus two local refinements.

The projection comes from the same surface function used to bake emission: analytic ellipsoid projection and a numerically refined bipolar envelope, each sampled at 72 image angles. Homologous expansion predicts `vLSR = vsys + expansion * z / equatorialRadius`; positive z recedes. All resolved surface crossings remain eligible, including four-crossing waisted rays. Five sightlines at the beam center and ±one Gaussian sigma on each sky axis approximate its footprint. They are **not** beam-weighted, instrument-broadened synthetic spectra.

The objective combines symmetric ridge/silhouette proximity with nearest-surface velocity error, using robust Huber losses. Velocity component losses are averaged within each pointing before averaging pointings. The configured 40″ image scale, 5 km/s velocity scale, 45 km/s missing-intersection penalty and systemic-prior weight are engineering choices, not measured statistical errors. Unmatched predictions are not constrained by a calibrated detection model; the approximation can favor flexible surfaces.

Every component from pointings in two opposite 45° sky sectors is withheld from velocity optimization and candidate ranking. Held-out values cannot change the fitted parameters. Images in those sectors still train morphology, and neighboring beam footprints overlap: this is a velocity holdout, not a fully independent spatial test or a posterior probability.

The neutral display integrates finite soft-shell emission with fixed fractional width 0.055 and cutoff 0.18 around the central surface. All XYZ banks come from that same 3D field: 48 slabs per axis, 256-pixel images, two depth samples per slab. No photograph-ray normalization, source-image painting, calibrated flux or physical gas density enters this display.

## Reproduction and evidence

Use the complete [Helix preparation sequence](../models/helix/README.md#current-step-aligned-observations-and-native-star-removal). It restores observations, starless working evidence and the pinned CDS table before fitting. `prepare-joint-fit` also accepts `--fit-only` to compare hypotheses without baking. Its command defaults use the checked-in source registration and unit source weights; browser inspection adjustments are included only in browser requests.

Only TypeScript, recipes and method records are committed. Generated graph, source panels, fit parameters, all component residuals, method receipt and XYZ textures live under `.local/nebula-lab/joint-fit/`. Cache identities include source/recipe pins, transforms, actual fit evidence, graph identity, settings and implementation. Asset hashes are verified on replay.

The default `molecular-wall-joint-fit@1` run on 2026-09-12 produced receipt `9f9aa4a4ce7d9f5f0aa48b8842419850a15205d530f1fb7ca0653e836f0d65ec`: 1808 selected ridge points, 4608 evaluated models, and both XYZ banks in 4.85 seconds using existing verified inputs. Its method receipt pins the exact implementation and evidence, independently of subsequent documentation edits.

| Candidate | Image RMS | Matched train / withheld velocity RMS | Missing train / withheld components |
| --- | --- | --- | --- |
| Shell | 128.0″ | 6.37 / 12.78 km/s | 2 / 1 |
| Waisted lobes | 134.2″ | 6.45 / 14.41 km/s | 2 / 11 |

The complete affected lab suite passed **278 tests**, including real registered evidence and ridge tests; strict source/changed-test TypeScript and the lab build passed. The joint-fit browser check passed at 1600×1000 and 1000×800, with Earth/oblique views, retained rotation during candidate replacement/refitting, display-only switches, and completed/running-job refresh. The existing Combined/core-slit browser flow also passed. These results cover the code pinned by the receipt; unrelated production suites were not run.

**Current limitation:** both single-component families miss substantial image structure and some withheld molecular pointings. Smooth attractive surfaces are not evidence that the Helix has been recovered. Oblique inspection also exposes slab bands in the coarse lobe preview; this bank is for hypothesis inspection, not final visual delivery. Front and oblique inspection tests rendering/registration; independent sphere/ellipsoid geometry, velocity signs, withheld-data isolation and missing-ray penalties test implementation. Neither substitutes for scientific model validation.

The next bounded experiment should fit several coherent components or a constrained swept wall against the same evidence, retaining these failed baselines and the unchanged velocity holdout. Keep ionized core, molecular wall and faint halo separate. A calibrated forward spectrum and a defensible likelihood require original spectra or justified centroid errors and a tracer-specific emissivity model; higher texture resolution cannot supply those constraints.
