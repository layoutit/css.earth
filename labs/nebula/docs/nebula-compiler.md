# Nebula compiler: first inspect the evidence

Updated 2026-09-11. **Implemented: the image-structure inspector for Helix. Not implemented: a new set of 3D hypotheses.** The prior Helix volumes remain failed comparison baselines. No volume has been generated from these new structure maps, and the clipped baseline has not been repaired by this stage.

## Intended contract

```text
registered observations
  -> separate stellar light, preserve native diffuse image
  -> image evidence: broad emission, ridges, compact candidates, remainder
  -> several constrained volume hypotheses
  -> compare predictions with observations and record assumptions
  -> accepted volume -> existing offline PolyCSS bake
```

The compiler should preserve an intermediate evidence model, then compare hypotheses rather than return one unexplained geometry. In transparent emission, front/back permutations can give the same projection. Image scales, colors and aligned ridge directions are not measurements of depth. Velocities, extinction and appropriate physical priors can provide extra constraints; more photographs from the same direction are not new viewing angles.

## Current implementation

- The full 4731 × 3129 HST/CTIO original and native NOX separation are the exact pinned inputs of the [Helix experiment](../models/helix/README.md). No second star removal, crop, black-level subtraction or ring mask is applied.
- Analysis resizes the full frame once to **768 × 508**. This is a quick working map, not a native-resolution scientific catalogue. Original RGB and the native separated image remain unchanged.
- Reuse the lab's undecimated B3-starlet decomposition at six spatial scales. The luminance proxy is weighted display RGB; it is not calibrated luminosity, column density or a measured emission line.
- Add local Hessian eigenvalue anisotropy for directional ridges. A thin curved ridge has one strongly negative curvature and a weaker transverse eigenvalue; a round peak has similar curvatures. Tangents and soft detection evidence are saved. This is **not a curvelet, Frangi, GETSF or DAWIS implementation**.
- Soft-threshold positive scale evidence. Broad and un-oriented coarse structure goes to diffuse; directional evidence goes to arcs; fine non-directional evidence goes to compact candidates. The remaining light stays in an explicit unassigned field.
- Each pixel has a conservative nonnegative partition, applied to all three original RGB channels. The four float RGB fields reconstruct the working input independently in every band. This proves accounting, not that the classification is correct.
- Save scale-plane region supports, centroids, covariance directions and overlapping cross-scale parents. A region can recur at several scales. The links do not establish physical connection or common depth.
- The browser loads prepared images only. Structure/Volume switches preserve the retained PolyCSS scene and camera; refresh and selection start no processing.

The combined view uses false colors (violet diffuse, cyan ridges, gold compact, red unassigned), enhanced detail weights and square-root brightness. Individual arc/knot/unassigned previews use ×4 display gain. These display choices never alter the saved RGB fields. Descriptions live in tooltips; use Source for the full starless input at the same framing.

## First result and limits

After one adjustment from hard significance gating to soft thresholding, the detector follows parts of the main ring and outer arcs without the earlier hard patch boundaries. It is still a rough candidate map: it does not yield a connected shell model or verified knots. Broad diffuse evidence dominates; do not treat its label as confirmed halo membership. NOX may remove real compact nebular emission along with stars.

The final map has **2,342 scale regions**, **5.87% unassigned display-luminance signal**, and a maximum RGB reconstruction error of **2.55e-8** (rounded upward). Every input pixel is accounted for, including image edges. Analysis and artifact writing took about **1.25 seconds**, excluding original acquisition and native separation. The photograph itself only contains part of the astronomical outer halo; preserving this field does not recover material beyond it.

Targeted checks cover per-channel reconstruction including an off-center edge feature, a curved ridge versus a round peak, and explicit retention of unassigned signal. The real browser check reads all six generated full-frame images and checks scene/camera retention and refresh without processing. Float artifacts carry source, recipe and implementation hashes. An attempted bounded Grok review returned only planning text and hit its turn limit; no independent review verdict was produced.

At this checkpoint, all 168 lab tests, the strict lab TypeScript check, the lab Vite build and both affected browser flows passed. Removing the unassigned-light allocation in an ignored compiled test copy makes two accounting tests fail. No production build or unrelated application suite was run.

## Reproduce from a clean checkout

From the repository root, with Node, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts prepare-emission labs/nebula/models/helix/model-prior.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-nebula-structures labs/nebula/models/helix/structure-map.json
node --experimental-strip-types labs/nebula/src/run.ts test structure-map structure-wavelets
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

The first prepare command restores the existing comparison volume needed by the current viewer; it does not create a new inferred geometry. The second generates the structure map. Open `/reconstruction?subject=helix-model-prior`. If the lab already runs, keep it alive and omit the server command. All generated images, float fields, graph output and native caches remain ignored under `.local/nebula-lab/`; track the recipe and TypeScript implementation only.

## Next experiment, after inspecting this map

First resolve the [source-footprint problem and wider candidates](../models/helix/README.md#wider-source-candidates). The complete downloaded Hubble frame is not the complete nebula. Source inspection must precede star separation, structure extraction and hypothesis fitting on a replacement; no new candidate has been processed yet.

1. Review the arcs and compact candidates against the input, especially the faint outer regions and possible NOX damage. The prototype allows at most two adjustments; one has been used. If candidate relationships remain unreliable, stop at image evidence and identify the extraction limitation.
2. Compare three coarse interpretations: a deformed shell, a barrel-like shell, and a bipolar structure, each with a separately represented outer component. Derive projected landmarks from accepted image evidence. Bound depth and orientation using published alternatives. Do not silently inflate rings or extrude the full rectangular image.
3. Fit band emission, feature positions and widths; retain all unexplained signal in a residual map. Penalize unsupported complexity and discontinuous structure using explicitly authored priors. Front agreement cannot validate the assumed depths or rank indistinguishable solutions by scientific accuracy.
4. Compare identical front/oblique/side camera poses at fixed exposure. Keep assumptions and uncertainty attached to each candidate. A known synthetic volume can test algorithmic recovery, but cannot validate Helix's true depth.
5. Once a small volume is accepted, reuse the existing baker and job infrastructure. Preserve explicit processing, progress, cancellation, recipes and source hashes. Do not build a new job framework first.

## Related work

- [GETSF, Men’shchikov](https://irfu.cea.fr/Pisp/alexander.menshchikov/): source/filament/background separation across scales and bands. Its method description was read; its code is not used for this Helix map.
- [Wenger et al., 2009, hybrid nebula models](https://graphics.tu-bs.de/upload/publications/wenger2009hybrid.pdf): geometry plus fitted volume emission. Identified from the indexed primary-paper text; the full PDF fetch failed in this follow-up. Not implemented here.
- [Wenger et al., 2013](https://doi.org/10.1111/cgf.12216): symmetry-constrained image-to-volume fitting. Already independently implemented for the prior controls; not a general solution to arbitrary depth.
- [SHAPE](https://arxiv.org/abs/1003.2012): comparison of authored morpho-kinematic models with observations.
- [Helix Herschel study](https://arxiv.org/abs/1411.4429): the published abstract describes clumpy material in a barrel-like structure. This is an alternative prior to investigate, not geometry inferred by our map.

The research opportunity is the reproducible coupling of structure evidence, alternative hypotheses, observational constraints and efficient delivery. No novelty or uniqueness claim is established.
