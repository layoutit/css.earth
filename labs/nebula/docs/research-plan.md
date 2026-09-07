# Research plan: coherent nebula structures in 3D

Status: automatic 2D benchmarks and isolated 3D controls implemented for Tarantula and Orion. Reusable tooling passes; current masks fail the production morphology gate. [Decision and results](coherent-depth.md). Updated 2026-09-08.

**Automatic approximation first; optional detailed refinement second.** The pipeline must discover structures without hand-authoring every cloud. Tarantula inside the LMC is the initial benchmark and later a candidate for registered high-resolution refinement. Its name and specific features must not enter reusable algorithms. Prove a coherent local volume before production integration; the Orion transfer diagnostic does not establish that acceptance.

The first implemented comparison is documented in [automatic structure benchmark](structure-benchmark.md). It compares an independent starlet prototype, the existing median kernel, and an imported run of official getsf when available. These are 2D morphology experiments; none recovers measured gas depth.

## What the current experiment established

| Verified baseline | Implication |
|---|---|
| Native 6737×6536 SMASH TIFF; 2048px lossless masters; 1024/512px delivery banks | Image detail can bypass the coarse RGB volume. Keep this preparation path. |
| 384×384×48 stellar grid spanning 12×12×10 kpc | Depth cells are about 208 pc; increasing texture resolution does not add local depth detail. |
| Photograph emission follows broad stellar depth, with a narrower component around the local mean depth | Photographed structures still spread through many depth layers; oblique views expose streaking. |
| Native 7px filtering retains more filaments than 19px filtering | Median filtering also removes intrinsic compact structure; surviving point sources are not classified members. |
| 64 slabs per axis, two samples per slab | Model smearing, integration aliasing and visible layer spacing must be diagnosed separately. |
| The imported simulation has no gas particles | Its stellar density guides placement, not the measured shape of Tarantula's gas or dust. |

Recipes: [current master](../models/lmc-highres.json), [particle model](../models/magellanic-particles.json). Existing transfer budgets are 2.60 MB/42.9 MB decoded at 1024px and 0.69 MB/10.3 MB decoded at 512px.

## Working hypothesis

Segment connected structures before assigning depth. A filament may cross adjacent slices, but its identity and neighborhood should persist in 3D. The following is a proposed model, not a claim of recovered physical geometry:

```text
                   ┌─→ Diffuse light ─→ Stellar volume ───────────┐
Registered image ──┤                                              ├─→ Offline CSS bake
                   └─→ Clouds + filaments ─→ Local 3D components ─┘
```

Wavelets identify scale, not distance. A single photograph cannot uniquely determine unseen structure. Treat the particle field as a weak placement prior; record alternative plausible depths instead of copying emission along the whole stellar column or averaging separated depth peaks into an empty region.

## Techniques to compare

| Candidate | Purpose | Limitation / decision |
|---|---|---|
| [getsf](https://irfu.cea.fr/Pisp/alexander.menshchikov/) | Automatically separate sources, filaments and background, with support maps and catalogues | Research comparator. Keep its restricted software local; do not vendor it or assume commercial-use permission. Its scientific input assumptions need explicit display-image adaptation. |
| Undecimated starlet wavelets | Separate diffuse light, intermediate clouds and compact features without moving their image coordinates | Independent initial implementation, not a reimplementation of DAWIS. Signed coefficients are analysis data, not positive emitting layers; reconstruct nonnegative components and retain a residual. |
| Connected components and filament skeletons | Group structures across scales and preserve connections | Start with masks checked against the source; distinguish real gaps from thresholding artifacts. |
| Curvelets + morphological component analysis | Separate elongated filaments from compact sources and smooth backgrounds | Compare only if starlets fragment important filaments; [astronomical examples](https://www.cosmostat.org/statistical-methods/mca/mca-experiments). |
| PSF-based point/extended-source fitting | Replace indiscriminate median filtering when usable instrumental images are available | [STARRED](https://arxiv.org/abs/2305.18526) separates point and extended channels; requires a defensible PSF/noise model. A display composite is not calibrated input. |
| Local ellipsoids, curved tubes or shell segments | Give each connected structure finite thickness and coherent orientation | Start with the simplest shape that reproduces the observed footprint; infer thickness with declared priors, not per-pixel random depth. |
| Regularized projection fitting | Adjust component brightness/geometry so their combined reference projection matches the image | Constrain positivity, compact support and continuity; a good front fit alone does not validate unknown side views. |

## Ordered experiments and gates

| Step | Work | Reviewable output / gate |
|---|---|---|
| 1. Freeze evidence | Select one native Tarantula crop with compact sources, filamentary emission and diffuse surroundings. Preserve original coordinates, source bytes and fixed cameras. Named landmarks may aid evaluation; extraction must not require manually drawn masks. | Baseline screenshots and crop; source-to-model transform; evidence manifest. No color or framing changes between comparisons. |
| 2. Verify registration | Check WCS, angular/physical scale, orientation and matched-star residuals before adding a detailed image. Keep display grade and filter differences explicit. | Source/target overlay, residual map and coverage mask. If registration is inadequate, continue with the SMASH crop rather than pasting a misaligned patch. |
| 3. Separate structures in 2D | Benchmark official getsf against independent starlet scales/connected regions and the current median control. Try curvelets/MCA only if the simpler decomposition fails. All regions and cross-scale associations are discovered automatically. | Source, diffuse, compact, filament-candidate and residual panels, plus a deterministic support catalogue. Components reconstruct the input without double-counting or clipping signed residuals into invented light. Exact reconstruction checks accounting; useful separation requires inspecting the actual components. |
| 4. Test depth ownership | Compare A: current stellar-column model; B: one localized Tarantula depth region; C: connected substructures with individual coherent depth support. Hold extraction and exposure fixed. | An isolated, genuinely 3D Tarantula subject. B diagnoses whether localization alone helps; C must beat B without becoming a flat card or random clumps. |
| 5. Test sampling independently | On the same field, increase integration samples before changing slab spacing. Compare analytic sampling or a finer local grid; increase local slab density only where warranted. | Separate plots for model error, integration error and layer-spacing artifacts. Thin features survive all axis banks; a sampling failure is not hidden by broadening the clouds. |
| 6. Fit and bake | Fit the reference projection with bounded depth/thickness priors; bake high-resolution masters, then derive delivery banks. | Fixed-camera front/oblique/side comparisons, reprojection residuals, slice inspection and measured payloads. |
| 7. Decide | Compare all retained candidates, their costs and unresolved scientific assumptions. | A short decision record: adopt, reject, or request specific missing data. LMC integration and other objects are separate follow-up work. |

An isolated subject can use its own physical bounds and fine sampling with the existing renderer. Whole-LMC integration must subsequently check whether the prepared format needs local/adaptive slice spacing; do not silently force a small cloud back into the coarse global grid.

## Automatic placement and optional refinements

- The next fitting experiment consumes detected supports and their cross-scale relationships, plus the stellar placement prior. It proposes bounded, coherent depth support for entire connected structures. The stellar simulation supplies broad placement evidence, not a correspondence between each observed nebula and a simulated gas cloud.
- Unknown regions receive the same automatic approximation; uncertainty and failed assignments remain explicit. Manual per-region depth, masks or shape parameters are optional data overrides, never required to process a new image.
- A named region such as Tarantula may later replace its base contribution with a registered image at higher angular resolution and better constrained local geometry. The base contribution must be removed once, preserving source position, scale and brightness across the handoff.
- Close-up detail needs prepared local resolution levels and a bounded resident set, beyond this 2D benchmark. The current fixed-bank renderer is not claimed to support that hierarchy yet; assess the prepared contract before production integration.

## Comparison protocol

- Keep two explicit targets: the 2D decomposition plus residual reconstructs the source photograph; the 3D nebula reproduces the agreed extended-emission target after declared point-source exclusions. Freeze that target across candidates and account for excluded light separately.
- Freeze camera pose, focal length, distance, viewport, exposure and image registration. Capture front, ±30°, ±60° and edge-on views around both axes, plus one continuous orbit at overview and close distance. Side views assess stability and plausibility, not agreement with unobserved photographs.
- First match the real source projection using its declared camera model; use the same perspective camera for lab comparisons. Track per-channel display-signal error, brightness totals and annotated feature footprints. Call these display measurements, not calibrated flux.
- For each selected structure, measure the depth interval containing 90% of its emission and inspect connectivity. Compare with its declared support/thickness prior; do not reward arbitrary flattening or hiding emission.
- Inspect component contributions and their sum. Removing the Tarantula component must remove its contribution from the model, not reveal a second copy left in the diffuse field.
- Compare the same sampled field at 2, 4, 8… integration samples until changes converge or the declared offline budget is reached. Evaluate denser local slabs separately. Do not change image resolution, exposure and depth model in the same comparison.
- Record texture bytes, decoded memory, retained DOM leaves, bake duration and rotation frame times. Start with the existing 1024px delivery bank's cost as the reference, not an unmeasured claim of equivalent performance.

## Definition of a successful prototype

| Gate | Required evidence |
|---|---|
| Structure survives rotation | Selected knots/filaments remain connected across the fixed views; no repeated silhouettes spanning unrelated galactic depth, obvious slice gaps, or disappearing thin features. |
| Reference image remains faithful | Preserve feature positions and color; initial engineering target: ≤5% change in each channel's integrated display signal over the fixed crop. Show spatial residuals so totals cannot conceal lost detail. |
| Real 3D remains | Finite depth and relative parallax remain visible; the whole region is not replaced by one camera-facing image. |
| Sampling is adequate | Increasing offline integration samples no longer materially changes the evaluated images; record the stopping tolerance before the sweep. |
| Cost is explicit | Report all five cost measures above against the baseline; justify any increase before proposing production integration. |
| Reproducible and honest | Source hashes, transformations, decomposition settings, component assignments, depth priors and bake settings reproduce the candidate. Separate measured inputs, simulation priors and authored choices. |

The 5% target is a proposed engineering tolerance, not a scientific uncertainty. Fix the evaluation masks and numerical tolerances before selecting a winner. User visual acceptance is required before promoting the result beyond the lab.

## Source and evidence checklist

| Source | Use | Status / constraint |
|---|---|---|
| [NOIRLab SMASH LMC](https://noirlab.edu/public/images/noirlab2030a/) | Wide-field reference and initial registered crop | Original TIFF already pinned; display composite, not gas density or calibrated photometry. |
| [ESO VST Tarantula](https://www.eso.org/public/images/eso1816a/) | Candidate higher-angular-resolution structure reference | Small JPEG and publisher WCS recorded in [source catalogue](../sources/index.json); full original acquisition and matched-star verification remain to do. H-alpha enhancement differs from SMASH colors. |
| [Garver et al. simulation](https://doi.org/10.5061/dryad.1vhhmgr82) and [paper](https://doi.org/10.1093/mnras/stag1287) | Coarse stellar placement prior | Pinned snapshot imported; no gas/dust reconstruction from these particles. |
| [Chu & Kennicutt: Tarantula kinematics](https://ntrs.nasa.gov/citations/19950037928) | Evidence for hierarchical shells and physically small structures | Reports structures on 1–100 pc scales; constrains model choices, not a ready-to-use XYZ texture. |
| [Tarantula core with MUSE](https://doi.eso.org/10.18727/0722-6691/5053) and [SAM-FP gas study](https://academic.oup.com/mnras/article/469/3/3424/3752450) | Investigate line emission, cavities and kinematic components | Literature leads; data access/coverage still need checking. A spectral cube's third axis is velocity or wavelength, not geometric depth. |
| [STARRED](https://arxiv.org/abs/2305.18526), [MCA examples](https://www.cosmostat.org/statistical-methods/mca/mca-experiments), [MuSCADeT](https://arxiv.org/abs/1603.00473) | Decomposition and point/extended or multiband separation methods | Read methods, assumptions and licenses before selecting an implementation; availability of a paper is not proof of suitability for this image. |

For each newly acquired input, record publisher, paper/data identifier, bands, WCS, dimensions, pixel convention, license, SHA256 and modifications. If access is blocked, report the exact paper/file and why it is needed; do not substitute unrelated imagery or infer depth from velocity without a physical model. Higher-resolution infrared images remain separate observational views unless an explicit multiband model is justified.

## Scope, artifacts and stopping rules

- Keep runtime PolyCSS and retained DOM. All decomposition, geometry, fitting, filtering and baking happen offline. No runtime canvas, WebGL, SVG scenes, filters, masks, gradients or blend modes.
- Keep reusable TypeScript algorithms under `src/`; object-specific inputs and parameters belong in data recipes. Keep small reproducible candidates under `models/`, source receipts/catalogues under `sources/`, and research/decision documents under `docs/`. Large originals and intermediate masters stay in the ignored local cache. No production route or publishing step.
- Before each experiment, record its hypothesis, fixed controls, success measure and maximum runs. Allow at most three fix/review rounds per experiment and two final cleanup rounds; carry results forward without restarting the counters.
- Stop at an impasse if improvement requires unavailable evidence, corrects one view by breaking another, or exceeds the agreed budget. State whether the owning problem is registration, decomposition, depth geometry, sampling or rendering; do not move the defect into a different stage.
- During iteration, run only affected lab/preparation checks. At an implementation's final gate, run the required repository checks and browser comparisons; report unrelated failures separately. Use an independent different-vendor review when available and record an unavailable review honestly.
- Source sheets, 2D comparisons and localized 3D controls are now available. The subsequent Orion transfer diagnostic used unchanged extraction settings after rejecting Tarantula's masks for production. SMC, whole-galaxy integration and detailed-image refinement remain separate work behind the morphology gate.

Running/rebuilding the existing baseline is documented in [workflows](workflows.md).
