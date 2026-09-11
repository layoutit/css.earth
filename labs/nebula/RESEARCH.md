# Nebula research and current method

Updated 2026-09-11. Start with [NEXTSTEPS.md](NEXTSTEPS.md) to continue the work and [METHOD.md](METHOD.md) to reproduce the implemented pipeline.

## What exists today

- The LMC volume starts with stellar particles from the Garver et al. simulation, converted to a density field. It is simulated stellar mass, not an observed gas/dust density map.
- Image registration establishes sky alignment; the saved image-to-simulation fit remains an authored approximation. Both Alignment and Reconstruction use the same full density object and Earth-facing camera.
- Full native NOX starless images supply color. ESO VISTA, NASA/IPAC WISE and Horálek optical remain separate material candidates, never averaged as if they measured the same band.
- The baker repaints the exact 144 Alignment quads, preserving geometry and all alpha bytes. Local contrast, saturation, brightness and gamma modify RGB only.
- The 943 Bonanos catalogue stars retain measured sky coordinates and photometry. One common model supplies their unmeasured depths. Candidate images cannot reposition/select stars.
- XYZ slice banks are prepared offline and rendered as retained PolyCSS/CSS elements. Runtime consumes prepared assets.

**A small independent implementation of Wenger's 2013 image-to-volume method now runs on M2–9 in the lab.** It infers relative emission using axial symmetry; it does not change the LMC/SMC pipeline or recover measured gas density. See [the method and limitations](docs/planetary-nebulae.md) and [the reproducible experiment](models/m2-9/README.md). Earlier starlet/getsf and photo-conditioned depth experiments remain in [research history](docs/research/README.md).

## Name and novelty

The active planetary-nebula direction is an evidence-preserving **nebula compiler**: structure extraction, alternative depth hypotheses, observation fitting, then offline delivery. Its first [Helix structure inspector](docs/nebula-compiler.md) now runs using starlets and directional curvature, retaining the complete observed frame and explicit unassigned signal. This has not supplied new depths yet; the older Helix volumes still fail visual acceptance.

A descriptive name is **image-based volumetric visualization guided by a density model**. It combines established image registration, projective material mapping, volume rendering and catalogue visualization techniques. The CSS/DOM delivery, repeatable baking and integrated authoring workflow are potentially distinctive engineering; no research-novelty or world-first claim has been established.

## Reading list

| Reference | Why it matters | Status in our code |
|---|---|---|
| Wenger et al. (2012), *Visualization of Astronomical Nebulae via Distributed Multi-GPU Compressed Sensing Tomography*. [Author page](https://www.graphics.rwth-aachen.de/publication/03269/) · [DOI](https://doi.org/10.1109/TVCG.2012.281) · [Author PDF](https://graphics.tu-bs.de/upload/publications/wenger2012visualization.pdf) | Infers plausible volumes using approximate spherical/axial symmetry, regularization and image constraints. Useful when no simulation is available. | Not implemented. |
| Wenger et al. (2013), *Fast Image-Based Modeling of Astronomical Nebulae*. [DOI](https://doi.org/10.1111/cgf.12216) · [Author PDF](https://graphics.tu-bs.de/upload/publications/wenger2013fast.pdf) | Nonnegative FISTA reconstruction with axial group sparsity. | Small independent TypeScript M2–9 baseline implemented; visual acceptance pending. |
| Wenger et al. (2012), *Interactive Visualization and Simulation of Astronomical Nebulae*. [Open full text](https://arxiv.org/html/1204.6132v3) · [PDF](https://arxiv.org/pdf/1204.6132) · [DOI](https://doi.org/10.1109/MCSE.2012.52) | Explains why a single image needs geometry and light-transport assumptions; distinguishes emission nebulae from absorption/scattering cases and discusses spectra/kinematics. | Background reference, not our implementation. |
| Steffen et al., *SHAPE: A 3D Modeling Tool for Astrophysics*. [Paper](https://arxiv.org/abs/1003.2012) | Combines object-specific structure and observational constraints; relevant when spectra and expansion information exist. | Candidate source of models/workflow, not integrated. |
| *Differentiable Direct Volume Rendering*. [Research page](https://www.cs.cit.tum.de/en/cg/research/publications/2021/differentiable-direct-volume-rendering/) | A possible render-and-fit framework. It cannot supply missing depth information by itself. | Future option; not the current painter. |
| Edenhofer et al. (2023), 3D Galactic dust mapping. [Paper](https://arxiv.org/abs/2308.01295) | Distance/extinction-constrained nearby Milky Way dust; investigate coverage for an Orion experiment rather than using it for internal LMC geometry. | Not integrated. |
| Ikits et al., *Volume Rendering Techniques*, GPU Gems. [Chapter](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques) | Established slice-based rendering, sampling and compositing; useful for diagnosing our XYZ handoffs. | Related rendering family, adapted to CSS. |

The earlier PDF access failure is resolved: both author PDFs downloaded successfully on 2026-09-11. The 2013 algorithm/results/limitations and the 2012 imaging/optimization sections were checked directly. The new baseline implements the 2013 equations independently; it does not use the authors' restricted downloadable volumes. Exact sources and hashes are in [the planetary-nebula notes](docs/planetary-nebulae.md).

## Objects without an existing density model

An image plus defensible structural assumptions can be used to infer a **plausible 3D emitting volume**. It does not uniquely reveal physical density or distance along every ray. Absolute physical size still needs an external distance/scale constraint.

- Start with a shell-like or bipolar planetary nebula for which symmetry and approximately transparent emission are reasonable.
- State the assumed geometry, viewing inclination and emission/absorption model. Fit a volume whose rendered observer view agrees with the input image.
- Inspect multiple possible depths/inclinations, not just the best-looking front projection. Keep uncertainty and authored choices in provenance.
- Treat irregular regions such as Orion and Tarantula separately. Emission, absorption and scattering make single-image reconstruction more ambiguous. Seek distance/extinction, spectroscopy, velocity or published structural models first.
- Register stars from independent catalogues. A fitted nebula volume must not silently turn unmeasured stellar depths into observed positions.
- Adapt a resulting volume into the existing offline baking contract. Keep the reconstruction solver separate from color treatment and CSS delivery.

## Known limits and evidence

- Color mapping cannot create physically recovered filaments. The 1024px registered color plane and existing slice texture resolution limit visible detail.
- Photo coverage gaps retain explicit neutral material. Brightness/gamma apply to that material too; missing observation is never invented color.
- Side views still show banding, and XYZ bank handoff checks fail the visual agreement thresholds. See [slice stability](docs/slice-stability.md). Material sliders do not fix volume sampling.
- The 2026-09-10 material-controls change passed 153 lab tests and real browser checks for three sources, refresh, fixed stars, geometry and alpha. All six dedicated XYZ handoff comparisons still failed; do not call the result fully rotation-stable.
- Local receipts: `.local/nebula-lab/cloud-appearance-check/report.json` and `.local/nebula-lab/cloud-appearance-stability/report.json`. They are machine-local evidence; source recipes and this record are versioned.
