# Nebula compiler: first inspect the evidence

Updated 2026-09-12. **Current stage: inspect and review 2D structure candidates from the three aligned ESO observations.** New 3D hypotheses are the following stage, after human inspection. The prior Hubble-based Helix volumes remain failed comparison baselines; this step does not repair or replace them.

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

## Human review before depth

The current observations are ESO VISTA infrared, ESO WFI optical detail and the wider ESO field. Reuse their completed native NOX diffuse images and the star-verified registration from [the observation step](../models/helix/README.md#current-step-aligned-observations-and-native-star-removal). Do not rerun star removal, analyze the smaller alignment previews, crop to a ring or use the Hubble baseline accidentally.

The inspector lets the operator:

1. Choose an observation at a fixed common sky scale, then compare its starless source and prepared evidence layers.
2. Filter scale-plane candidates by morphology, spatial scale, area, contrast and elongation. These select existing candidates; moving controls never processes an image or invents depth.
3. Inspect each actual region support and mark **Keep / Unsure / Reject**. Keep means useful image evidence, not confirmed nebular membership or a physical object. Reviews belong to the exact source and extraction output, and survive refresh.
4. Recheck compact features against Original / Without stars / Residual in Alignment. Remaining stellar halos, removed real knots, compression and source artifacts can all contaminate candidates. Cross-band absence is not automatically rejection: different wavelengths trace different emission.
5. Inspect the unassigned field before advancing. Rejecting or filtering a candidate must not delete source light or hide the fact that evidence remains unexplained.

Scale regions overlap and recur; their count is not the count of physical structures. This first inspector does not yet merge fragments into complete arcs, train on review decisions or fit a surface. A review narrows the evidence worth modeling next. It does not certify a segmentation.

### What physics adds next

| Accepted projected evidence | Candidate 3D explanations | Additional constraint to seek |
| --- | --- | --- |
| Bright curved ridge or elliptical rim | Limb of a shell, barrel rim, toroidal waist, or a filament | Spatially resolved line velocities, inclination and continuity of adjacent ridges |
| Opposed elongated extensions | Bipolar lobes or separate projected structures | Common projected axis plus approaching/receding velocity components |
| Compact head with a radial tail | Clump with an illuminated or evaporating tail; also test stellar contamination | Resolved line/molecular emission and relation to the central radiation source |
| Faint extended arcs or halo | Earlier ejection, outer shell or interaction with surrounding material | Wider and deeper line imagery, kinematics and source coverage |

These are hypotheses to compare, not automated classifications. For planetary nebulae, interacting winds, ionization, evaporation and interaction with the surrounding medium motivate different constraints. A shape merely looking like a shell does not demonstrate that its formation is dynamically possible. A morpho-kinematic fit is also not a hydrodynamic simulation.

The next bounded experiment should fit a few explicit shell/barrel/bipolar alternatives to reviewed landmarks and widths. Fit the measured projections, constrain velocity where data exist, and retain an unconstrained-depth designation elsewhere. Do not force optical and infrared RGB values to match, infer front/back from color alone, assume homologous expansion without justification, or silently discard an outer component that does not fit. Compare several plausible solutions when the data cannot distinguish them.

Primary references and what they actually support:

- [Meaburn et al. (2005)](https://arxiv.org/abs/astro-ph/0504295): the abstract describes spatially resolved spectra, a bipolar structure with a toroidal waist and several expansion components; it also discusses limits of a simple two-wind explanation. Its numerical velocities are model/context dependent, not universal defaults for our compiler.
- [O’Dell (2005)](https://arxiv.org/abs/astro-ph/0505539): the abstract explicitly retains alternative outer disk/lobe interpretations and calls for diagnostic velocity mapping. Image morphology alone leaves this ambiguity.
- [Van de Steene et al. (2015), section 3](https://www.aanda.org/articles/aa/full_html/2015/02/aa24189-14/aa24189-14.html): dust, molecular and ionized emission are compared within a fragmented barrel interpretation. In that model, projected circles need not be separate physical rings. The analysis restricts itself to the main nebula; it does not establish complete halo coverage.
- [SHAPE, Steffen et al. (2010)](https://arxiv.org/abs/1003.2012): the abstract describes interactive structural priors and comparison/optimization against observations. It is a useful model for our later hypothesis stage, not an image-to-unique-density guarantee.

## Shared extractor and historical Hubble benchmark

### Current ESO outputs

| Observation | Working raster | Scale-plane candidates | Unassigned display signal |
| --- | --- | --- | --- |
| VISTA infrared | 768 × 768 | 3,302 | 5.03% |
| WFI optical detail | 768 × 711 | 3,500 | 1.67% |
| Wider ESO field | 768 × 534 | 2,261 | 2.29% |

The first three-source preparation took **11.12 seconds**, including native-cache validation, resizing, extraction and output writing. Summing the written float RGB components reconstructs each working input channel with error below **6e-8**. Each image uses one prepared RGBA atlas of actual region supports (38–94 KB compressed); the browser filters retained sprites rather than analyzing pixels. No new NOX or volume jobs ran. Timing is machine dependent and does not include the earlier downloads or star separation.

The common angular frame and native-pixel transform are retained. Working-raster pixel edges are scaled back to native coordinates before sky registration. The complete source rectangles are preserved, including faint material and artifacts. The inspection resolution is deliberately bounded for this first review; unresolved fine knots require a later native-resolution pass if accepted evidence warrants it.

### Prepare current observations and structures from a clean checkout

From the repository root, with Node, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/helix/observations.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-observation-structures labs/nebula/models/helix/observation-structures.json
node --experimental-strip-types labs/nebula/src/run.ts test observation-structure-source structure-inspection
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

Open `/reconstruction?subject=helix-model-prior` and select **Structure map**. Keep an existing server alive; omit the final command when it is already running. This path does not need the old Hubble volume. The observation command downloads/verifies pinned originals and reuses completed matching NOX caches; the structure command refuses missing or changed inputs instead of running NOX. Inspect Alignment before authorizing the structure command for any new object or source. The current three Helix sources have that authorization.

Prepared outputs and sources remain ignored under `.local/nebula-lab/observations/helix/`. Track the compact recipes, implementation and source records. A source/recipe/algorithm change creates a separate extraction identity; prior review decisions must not silently apply to changed evidence.

Two completed replays produced identical catalogue/map bytes and unchanged native-removal receipts. Runtime timing remains outside the stable map identity. The verified catalogue SHA-256 is `b49074ce6a3b92b839f378b6efbce6fc945276be49a60ad4409383347c50b3b1`; its entries identify the corresponding maps and implementation hashes. Targeted tests also fail when actual support, native-to-working registration scaling or the cache-only NOX guard is removed. These checks establish artifact/coordinate behavior, not scientifically correct segmentation.

The 2026-09-12 UI checkpoint passed all **184 lab tests**, strict lab TypeScript and the lab Vite build. Chrome 148 at 1600 × 1000 verified all 18 evidence panels, matching Alignment/Structures framing with a saved manual rotation/offset, source switching without camera changes, all filter controls, retained support nodes, drag-to-pan over highlights, and review restoration for each image after refresh. The test blocked old Hubble volume URLs and confirmed that structure inspection never requested them or started processing. The existing alignment/shared-view flow also passed. Browser review decisions are test fixtures, not scientific acceptance. No production application suite or production build ran.

### Historical method benchmark

The algorithm below is the reusable first-pass detector. The numerical results in the following historical section belong **only to the earlier cropped Hubble photograph**, not the new ESO observations.

- The full 4731 × 3129 HST/CTIO original and native NOX separation are the exact pinned inputs of the [Helix experiment](../models/helix/README.md). No second star removal, crop, black-level subtraction or ring mask is applied.
- Analysis resizes the full frame once to **768 × 508**. This is a quick working map, not a native-resolution scientific catalogue. Original RGB and the native separated image remain unchanged.
- Reuse the lab's undecimated B3-starlet decomposition at six spatial scales. The luminance proxy is weighted display RGB; it is not calibrated luminosity, column density or a measured emission line.
- Add local Hessian eigenvalue anisotropy for directional ridges. A thin curved ridge has one strongly negative curvature and a weaker transverse eigenvalue; a round peak has similar curvatures. Tangents and soft detection evidence are saved. This is **not a curvelet, Frangi, GETSF or DAWIS implementation**.
- Soft-threshold positive scale evidence. Broad and un-oriented coarse structure goes to diffuse; directional evidence goes to arcs; fine non-directional evidence goes to compact candidates. The remaining light stays in an explicit unassigned field.
- Each pixel has a conservative nonnegative partition, applied to all three original RGB channels. The four float RGB fields reconstruct the working input independently in every band. This proves accounting, not that the classification is correct.
- Save scale-plane region supports, centroids, covariance directions and overlapping cross-scale parents. A region can recur at several scales. The links do not establish physical connection or common depth.
- The browser loads prepared images only. Structure/Volume switches preserve the retained PolyCSS scene and camera; refresh and selection start no processing.

The combined view uses false colors (violet diffuse, cyan ridges, gold compact, red unassigned), enhanced detail weights and square-root brightness. Individual arc/knot/unassigned previews use ×4 display gain. These display choices never alter the saved RGB fields. Descriptions live in tooltips; use Source for the full starless input at the same framing.

## Historical Hubble result and limits

After one adjustment from hard significance gating to soft thresholding, the detector follows parts of the main ring and outer arcs without the earlier hard patch boundaries. It is still a rough candidate map: it does not yield a connected shell model or verified knots. Broad diffuse evidence dominates; do not treat its label as confirmed halo membership. NOX may remove real compact nebular emission along with stars.

The final map has **2,342 scale regions**, **5.87% unassigned display-luminance signal**, and a maximum RGB reconstruction error of **2.55e-8** (rounded upward). Every input pixel is accounted for, including image edges. Analysis and artifact writing took about **1.25 seconds**, excluding original acquisition and native separation. The photograph itself only contains part of the astronomical outer halo; preserving this field does not recover material beyond it.

Targeted checks cover per-channel reconstruction including an off-center edge feature, a curved ridge versus a round peak, and explicit retention of unassigned signal. The real browser check reads all six generated full-frame images and checks scene/camera retention and refresh without processing. Float artifacts carry source, recipe and implementation hashes. An attempted bounded Grok review returned only planning text and hit its turn limit; no independent review verdict was produced.

At this checkpoint, all 168 lab tests, the strict lab TypeScript check, the lab Vite build and both affected browser flows passed. Removing the unassigned-light allocation in an ignored compiled test copy makes two accounting tests fail. No production build or unrelated application suite was run.

## Reproduce the historical Hubble baseline from a clean checkout

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

The user authorized structure inspection of the [aligned wider observations](../models/helix/README.md#current-step-aligned-observations-and-native-star-removal) on 2026-09-11. The next acceptance gate is the usefulness of those candidates and filters, before hypothesis fitting. The complete downloaded Hubble frame is not the complete nebula; the numerical benchmark above still describes that historical source.

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
- [Helix Herschel study](https://arxiv.org/abs/1411.4429): section 3 was read for the barrel/projection interpretation described above. This remains an alternative prior to investigate, not geometry inferred by our map.

The research opportunity is the reproducible coupling of structure evidence, alternative hypotheses, observational constraints and efficient delivery. No novelty or uniqueness claim is established.
