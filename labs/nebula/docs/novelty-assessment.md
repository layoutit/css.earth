# Helix compiler: novelty assessment

Assessed **12 September 2026**, against implementation **`68932f3e7044a4e8403bd5f0efd19eb5c53a04d3`**. This assesses the implemented Helix compiler, not the separate Wenger-based M2–9 experiment or planned future algorithms.

## Verdict

**We have built a working integration of established reconstruction and visualization ideas. A specific contribution remains possible, but a new reconstruction algorithm has not been demonstrated.** Published work already covers image-derived nebula volumes, geometry plus velocity fitting, image-painted volumes with reintroduced stars, and interactive exploration.

| Claim | Assessment | Confidence and reason |
| --- | --- | --- |
| “Nobody has reconstructed nebulae like this before.” | Contradicted in its broad meaning. | High: several direct astronomical precedents below. |
| “Nobody has produced this kind of rotatable visual result.” | Contradicted. | High: published reconstructions and science-informed fly-throughs exist. |
| “Our mathematical building blocks are new.” | Not supported. | High for the main families; the exact kernel and allocation recipe were not established as an advance. |
| “Our exact compiler is a distinctive implementation.” | Plausible, not established as first-of-kind. | The checked sources did not establish an exact match for the full implementation. Search incompleteness prevents an absence claim. |
| “We have recovered the real Helix in 3D.” | Not established. | Depth remains conditional, and independent observations do not validate the detailed emitted field. |
| “This could support a publication.” | Possible as an evaluated system or a narrower method contribution. | It needs a clear comparison and demonstrated benefit, not more feature combinations alone. |

**Recommendation:** develop and describe it as an **interactive compiler for plausible nebula visualization**. Treat improved reconstruction accuracy, efficiency and authoring effort as hypotheses to evaluate. Original software can be valuable without introducing a new scientific inversion method.

## What the current code actually does

The [compiler](../packages/lab/src/server/workflows/compiler/compile.ts), [projected fitter](../packages/reconstruction/src/methods/inference/fit.ts), [field](../../../packages/bake/src/volume/fields/emission.ts), [image target](../packages/lab/src/server/workflows/compiler/images.ts) and [joint scaffold fitter](../packages/reconstruction/src/methods/joint/fitter.ts) establish these boundaries:

| Stage | Implemented behavior | What it does not establish |
| --- | --- | --- |
| Observations | Register three ESO optical/near-infrared composites; preserve full footprints and native NOX diffuse/residual products. | Separate calibrated filter planes, stereo views, or confirmed stellar membership. |
| Coarse shape | Jointly fit projected ridge evidence and HCO+ centroids to ellipsoid/bipolar surface alternatives. | Arbitrary topology or a uniquely recovered physical shape. |
| Detailed emission | Fuse normalized display luminance into one scalar image; greedily add positive multiscale supports and refine their coefficients. | A joint fit of the final 3D field to separate images, spectra and velocity data. |
| Depth | Split supported emission equally over scaffold intersections; place unsupported emission in an assumed centered halo. | Measured near/far assignment for each filament or knot. |
| Materials and lights | Recolor shared geometry with registered image chromaticity; place compact residual lights at observed XY and modeled depth. | Independent wavelength-specific volumes or measured stellar distances. |
| Delivery | Bake XYZ textures; reuse the retained PolyCSS volume renderer and interactive lab shell. | A newly invented volume renderer or a physical radiation-transport solution. |

The distinction between **joint scaffold fitting** and **separate emission fitting** is essential. Wavelet/scale-space and ridge evidence help establish the scaffold, but no velocity, ridge-tangent or separate-band residual enters the final emission-coefficient objective. The output is a real sampleable 3D field; its depth is conditional on the chosen model.

### Why the image fit cannot validate depth

In simplified form, the final field is:

`E(x,y,z) = sum_i w_i B_i(x,y) h_i(z)`, where `w_i >= 0` and `integral h_i(z) dz = 1`.

Consequently, its observer projection is `sum_i w_i B_i(x,y)`. Many different depth functions give exactly that same image. Our Depth control deliberately exploits this property: it changes the modeled thickness while preserving the analytic projected emission.

That is useful for controlled visualization. It also means a low fitted-image error cannot select the correct depth. More photographs from approximately the same Earth sightline expose different tracers and structures, but do not supply the missing camera angles. This ambiguity is also explicit in [SHAPE §I–III](https://arxiv.org/html/1003.2012v1) and [Wenger 2013 §3–4](https://graphics.tu-bs.de/upload/publications/wenger2013fast.pdf).

## Closest astronomical precedents

These are method comparisons, not claims that our implementation copied their code or that their inferred models are uniquely true.

| Prior work | Relevant overlap | Actual distinction in our compiler |
| --- | --- | --- |
| **Nadeau et al., 2000 conference / 2001 journal, _Visualizing Stars and Emission Nebulas_.** [Conference full text](https://diglib.eg.org/server/api/core/bitstreams/3c6113da-fffe-4a9f-86b3-543569109611/content); [journal DOI](https://doi.org/10.1111/1467-8659.00472). §§2.2–3. | An observationally informed Orion surface becomes a volume. Stars and small objects are removed from the image, the image is projected through the volume, and stars return at estimated 3D positions with brightness-dependent appearance. It even discusses projection streaks. | Our registration, separation and residual-based emission fitting are automated; our sources are switchable materials and delivery uses prepared CSS planes. Painting a cloud and putting stars back is already established. |
| **Magnor et al., 2004/2005, constrained inverse volume rendering.** [2005 full text](https://graphics.tu-bs.de/upload/people/magnor/publications/tvcg05.pdf), §§IV–VII. | Automatically fits axisymmetric emission and orientation by comparing rendered volumes with photographs; produces alternative views. | We fit projected positive components under a coarse kinematic shape rather than this axisymmetric nonlinear reconstruction. Automatic photographic nebula reconstruction itself is old. |
| **Lintu et al., 2007, _3D Reconstruction of Emission and Absorption in Planetary Nebulae_.** [Publisher](https://diglib.eg.org/items/874dfdd5-865f-4879-a325-cf63a603e355), §§3–6. | Uses optical plus infrared or radio observations to estimate gas/dust distributions under axial symmetry, including emission, absorption and scattering. | Our composite is normalized display signal with interchangeable chromaticity, not a coupled gas/dust radiation model. “Several wavelengths reconstruct one nebula” is insufficient as a novelty claim. |
| **Wenger et al., 2009, _3D Reconstruction of Planetary Nebulae using Hybrid Models_.** [Full poster paper](https://graphics.tu-bs.de/upload/publications/wenger2009hybrid.pdf), §2. | Specifies nested shell geometry, fits volumetric emission against the observed image, then assigns surface emission/absorption and residual texture. Interactive rendering combines the results. | Our shell comes from a restricted automatic ridge/velocity fit; detailed emission uses positive finite supports. This is a particularly close precedent for the broad “shape first, fit image detail afterward” idea. Its short format supplies less evaluation than a full paper. |
| **Wenger et al., 2012/2013.** [2012 tomography](https://www.graphics.rwth-aachen.de/publication/03269/); [2013 full text](https://graphics.tu-bs.de/upload/publications/wenger2013fast.pdf), §§4–7. | Regularized image-to-volume reconstruction retains departures from symmetry and renders novel views. The 2013 algorithm uses nonnegative FISTA with group sparsity on a desktop. | Our final solver is a different sequential fitting/lifting design. The 2013 paper already addresses asymmetry, so “ours is not perfectly symmetric” is not enough. Its near-axis M57 failure is especially relevant to evaluating a ring-like target. |
| **Steffen et al., 2011, SHAPE.** [Full text](https://arxiv.org/html/1003.2012v1), §§IV–V. | Integrates geometry, emissivity, velocities, synthetic telescope observations, interactive refinement and automatic parameter optimization. Includes primitive/CSG composition and validation against simulations. | Our main flow automatically constructs a detailed display field and bakes it for web delivery. Interactive physical hypotheses, shape vocabularies and image-plus-velocity fitting are established. |
| **Agliozzo et al., 2016 online / 2017 journal, RHOCUBE.** [Full text](https://arxiv.org/html/1611.05259v2), §4 and appendices; [code](https://github.com/rnikutta/rhocube). | Fits parameterized 3D density distributions to projected radio brightness using Bayesian inference; provides shells, cones, tori and other families. Several distributions explain the same S61 observations. | Our high-detail residual supports and conditional lifting differ. RHOCUBE studies an LBV nebula, not a planetary nebula; it nevertheless anticipates the general shape-fitting machinery and treats uncertainty more explicitly. |
| **Monteiro et al., 2025, _The planetary nebula NGC 3132 revisited: high definition 3D photoionization model_.** [Full text](https://arxiv.org/html/2503.20640v1), modeling sections. | Uses resolved velocity information under homologous expansion to construct detailed structure and compares photoionization predictions with images, spectra and photometry. | It uses richer physical inputs and forward modeling than our outreach-image target. Detailed, complex nebula reconstructions combining imagery and velocities already exist. |

Two especially important corrections to our earlier excitement: **image-painted volumes with modeled stars predate us by decades**, and **hybrid shell-plus-image-detail reconstruction is not an unexplored idea**.

## Adjacent methods and visual precedents

| Family | Verified precedent | Consequence |
| --- | --- | --- |
| Positive multiscale image components | [Cornwell 2008, Multi-Scale CLEAN](https://arxiv.org/abs/0806.2228). | Emission represented as a sum of components at several scales is established. CLEAN solves radio-image deconvolution; our fitter does not implement its measurement operator. This is an algorithm-family analogy, not equivalence. |
| Finite-support volumetric kernels | [Condor et al., 2025, _Don’t Splat your Gaussians_](https://arcanous98.github.io/assets/data/papers/Gaussian_tracing_meta_TOG.pdf), §§4–7.2; [official code](https://github.com/facebookresearch/volumetric_primitives). | Kernel mixtures, analytic transport expressions and inverse fitting are established. Our separable squared-shifted-Gaussian kernel and normalized lifting differ, but changing a kernel formula does not demonstrate an advance. This is broader participating-media work, not a Helix solver. |
| Single-view plausible cloud volumes | [Okabe et al., 2015](https://makotookabe.com/FluidVolumeModeling/index.html); [Leonard et al., CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Leonard_Light_Transport-aware_Diffusion_Posterior_Sampling_for_Single-View_Reconstruction_of_3D_CVPR_2025_paper.html). | Appearance priors and learned volume priors already support convincing alternative views. Their terrestrial fluids/scattering, temporal or training assumptions differ from astronomical emission. They cannot establish missing nebular depth for us. |
| Multiwavelength nebula journeys | NASA/STScI [Orion, 2018](https://www.jpl.nasa.gov/news/nasa-space-telescopes-provide-a-3-d-journey-through-the-orion-nebula/) and [Pillars of Creation, 2024](https://science.nasa.gov/asset/hubble/the-pillars-of-creation-a-3d-multiwavelength-exploration/). | Detailed scientific-image-informed 3D journeys with optical/IR transitions exist. These are expert-produced visualizations, not evidence of the same automated compiler or a runtime performance comparison. |
| Texture slicing and CSS clouds | [GPU Gems, chapter 39](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques); [Sánchez, CSS 3D Clouds, April 2012](https://www.clicktorelease.com/blog/how-to-make-clouds-with-css-3d/). | Slice compositing is established; CSS-transformed cloud imagery also predates us. Sánchez uses sprite billboards, not our compiled sampled field. Neither proves an exact prior implementation of our XYZ banks, but “first CSS cloud” is untenable. |

Generic NeRF/3D Gaussian Splatting results are not interchangeable with this method. They often use different observations, scene priors and transport models. Our compiler is neither a NeRF nor a Gaussian-splat rasterizer.

**Helix itself already has 3D visualizations:** NASA released an [HST/ground-data model animation on 16 December 2004](https://science.nasa.gov/asset/hubble/helix-nebula-model-2/). Chandra also presents an [interactive Helix model](https://chandra.harvard.edu/deadstar/helix.html), explicitly described as an impression derived from Hubble optical filters. These are direct counterexamples to a broad visual-first claim, not evidence that our automatic method or image detail is identical.

## What our present evidence supports

The audited cached output is the [Helix checkpoint](../models/helix/README.md) with result identity `2e6d9eccd15ca15ccc053b1d564e2b0763522207c1c6ba79c42c86111796c9ce`.

| Evidence | Interpretation |
| --- | --- |
| Target RMSE **0.22271 → 0.03958** | Improvement over an empty field on the same target used for fitting. Neither a competitive baseline nor held-out 3D validation. |
| **173 projected bases → 287 volume components** | Detailed volumetric representation: 114 near, 114 far and 59 centered-halo components. These are model allocations, not detected 3D objects. |
| **137 components outside measured velocity footprints** | Much detailed emission lacks local velocity coverage. Coverage elsewhere does not uniquely validate its assigned depth either. |
| Scaffold ridge RMS **128″**; **56.9%** beyond the configured 80″ correspondence tolerance | The restricted coarse shape leaves substantial projected structure unexplained. A later good image fit does not repair this depth-model mismatch. |
| Matched HCO+ RMS **6.37 km/s training**, **12.78 km/s held out** | Some independent checking exists at the scaffold stage. Missing intersections are reported separately: 2 of 228 training and 1 of 51 held-out components. No superiority or physical acceptance follows without appropriate baselines and uncertainty. |
| About **26 seconds** with prepared source/evidence caches; roughly **12 MiB** scene textures | Useful one-machine engineering measurements. Not cold processing cost, a portable speed claim or a comparison against older papers' different hardware/settings. |
| Shared alpha across all lenses; completed interaction checks | Evidence of software behavior. It cannot verify astrophysical depth or prove a novel method. |

The analytic fit integrates additive emission. The delivery renderer uses a finite texture/alpha approximation. Therefore its actual screen projection and rotation behavior also need separate measurement. Existing oblique color streaks and stellar halos remain relevant; a solver residual alone does not characterize them.

## Where a defensible contribution could still emerge

These are **candidate research claims**, not achievements already demonstrated:

| Candidate | What is specific about our design | Evidence needed |
| --- | --- | --- |
| Efficient geometry-conditioned detail | Coarse morpho-kinematic shape plus positive projected components, normalized conditional depth and explicit unsupported halo. | Beat simple lifts and appropriate inverse-volume baselines at matched image fidelity, using independent shape/velocity tests. Isolate the benefit of the allocation rule. |
| Reproducible authoring system | Native source identities, registration, separation, evidence, fit, shared-volume materials and resumable compilation in one tool. | Show users can produce comparable outputs with less manual work; demonstrate repeatability and transfer beyond the configured Helix. Integration alone is not enough. |
| Constrained web delivery | Compile a common field into retained CSS banks while preserving geometry across materials. | Quantify fidelity, handoff artifacts, memory, download size and interaction cost against reference volume rendering and a simpler slice implementation. TypeScript or CSS alone is not the contribution. |

The safest current wording is: **“A reproducible interactive pipeline for plausible nebula volumes, combining coarse morpho-kinematic fitting, positive multiscale image fitting, conditional depth placement and shared-geometry PolyCSS materials.”**

Avoid “first,” “state of the art,” “physical density recovery,” “fully joint multimodal inversion,” “curvelet/volumelet reconstruction,” “measured star depths,” and “accurate from every direction.” None is supported by the current evidence.

## Smallest useful evaluation program

Run this as a bounded comparison before adding more machinery:

1. **Known-volume test.** Generate asymmetric shell/knots/halo examples with known depth, held-out viewing angles and realistic measurement noise. Use at least one geometry outside our primitive family. Avoid creating both truth and reconstruction with the same basis. Measure normalized 3D error, withheld views and morphology, alongside fitted-view error.
2. **Controlled baselines and ablations.** Compare a flat/centered lift, a shell-only model, our full method, and the existing Wenger baseline where its assumptions apply. Keep image target, sampling and display comparable. Remove velocities, replace the fitted scaffold with a wrong one, and omit individual images; measure what actually improves. A symmetry baseline's predictable failure on a face-on ring is not sufficient evidence of general superiority.
3. **Independent observations.** Preserve whole-pointing holdouts and compare velocity predictions at the corresponding tracer/beam. Ultimately forward-project the final emission and velocity fields, not only the parent shell. Additional optical line data must retain its different tracer physics; a wavelength cube is not automatically a spatial depth cube.
4. **Transfer and delivery.** Freeze defaults on Helix, then apply them to a second irregular planetary nebula. Record manual effort and changes. Measure actual screen images through rotation against a reference renderer at the same transfer settings. Separate source preparation, fitting and delivery time.

**Decision rule:** if we cannot outperform a simpler conditional lift beyond the fitted image, frame the result as an authoring/visualization system. If a particular constraint or representation improves independent outcomes consistently, formulate the method contribution around that measured improvement. If neither happens, retain it as useful app tooling without a research-novelty claim.

## Search and evidence limits

The assessment combined an audit of the actual implementation and saved receipts with primary literature and author/publisher software sources. Searches covered astronomical reconstruction, hybrid geometry/emission methods, multiband fusion, kinematic/photoionization models, sparse kernels, single-view cloud inversion, texture-sliced rendering and CSS clouds. Backward references exposed Nadeau 2000 and the particularly relevant Wenger 2009 hybrid method; newer searches checked work through 2026.

Full method passages were inspected for Nadeau, Magnor, Lintu, Wenger 2009/2013, SHAPE, RHOCUBE and NGC 3132. Condor's primary paper and official repository description were checked for kernel representation and inverse fitting. Okabe and Leonard are bounded comparisons based on their primary project/conference descriptions, not reproduced algorithms. NASA visualizations and Sánchez's published code establish visual/implementation precedents; no side-by-side runtime benchmark was conducted.

An independent Grok Expert research challenge ran on the remote workstation and completed with 22,596 report characters and 44 captured links. Its text and citation HTML were read after retrieval. It supplied search leads rather than authority: the maintained comparisons rely on the primary sources checked here. Broad rejection of novelty does not establish an exact algorithmic match, and the report's tentative absence claims were not promoted to facts.

This was a focused prior-art assessment, not a complete census of every paper, thesis, language, unpublished tool or repository. An exact full-pipeline predecessor was not established. That leaves the narrow combination unresolved; it does not supply positive evidence that it is new. Source freshness and publication year were checked separately from search-engine crawl dates.

The assessment introduces no new reconstruction result. Its code observations and metrics apply to the pinned revision and cached checkpoint above. Raw research leads, the source audit and downloaded papers remain in ignored `output/nebula-novelty/`; this document preserves the checked conclusions and primary references.
