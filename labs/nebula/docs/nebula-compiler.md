# Nebula compiler: first inspect the evidence

Updated 2026-09-12. **Current stage: automatically fit projected geometric candidates to the three aligned ESO observations, then inspect their support.** New 3D hypotheses remain a later stage, after these image-space fits are useful. The prior Hubble-based Helix volumes remain failed comparison baselines; this step does not repair or replace them.

## Intended contract

```text
registered observations
  -> separate stellar light, preserve native diffuse image
  -> image evidence: broad emission, ridges, compact candidates, remainder
  -> automatic projected ellipse/arc candidates and shared-center groups
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

Scale regions overlap and recur; their count is not the count of physical structures. Their morphology labels describe image signal, not gas components. The geometric stage below proposes larger projected candidates automatically; region reviews do not train it or fit a surface. A review narrows the evidence worth modeling next. It does not certify a segmentation.

### What physics adds next

| Accepted projected evidence | Candidate 3D explanations | Additional constraint to seek |
| --- | --- | --- |
| Bright curved ridge or elliptical rim | Limb of a shell, barrel rim, toroidal waist, or a filament | Spatially resolved line velocities, inclination and continuity of adjacent ridges |
| Opposed elongated extensions | Bipolar lobes or separate projected structures | Common projected axis plus approaching/receding velocity components |
| Compact head with a radial tail | Clump with an illuminated or evaporating tail; also test stellar contamination | Resolved line/molecular emission and relation to the central radiation source |
| Faint extended arcs or halo | Earlier ejection, outer shell or interaction with surrounding material | Wider and deeper line imagery, kinematics and source coverage |

These are hypotheses to compare, not automated classifications. For planetary nebulae, interacting winds, ionization, evaporation and interaction with the surrounding medium motivate different constraints. A shape merely looking like a shell does not demonstrate that its formation is dynamically possible. A morpho-kinematic fit is also not a hydrodynamic simulation.

After projected detection is useful, the next bounded experiment should fit a few explicit shell/barrel/bipolar alternatives to accepted automatically detected landmarks and widths. Fit the measured projections, constrain velocity where data exist, and retain an unconstrained-depth designation elsewhere. Do not force optical and infrared RGB values to match, infer front/back from color alone, assume homologous expansion without justification, or silently discard an outer component that does not fit. Compare several plausible solutions when the data cannot distinguish them.

Primary references and what they actually support:

- [Meaburn et al. (2005)](https://arxiv.org/abs/astro-ph/0504295): the abstract describes spatially resolved spectra, a bipolar structure with a toroidal waist and several expansion components; it also discusses limits of a simple two-wind explanation. Its numerical velocities are model/context dependent, not universal defaults for our compiler.
- [O’Dell (2005)](https://arxiv.org/abs/astro-ph/0505539): the abstract explicitly retains alternative outer disk/lobe interpretations and calls for diagnostic velocity mapping. Image morphology alone leaves this ambiguity.
- [Van de Steene et al. (2015), section 3](https://www.aanda.org/articles/aa/full_html/2015/02/aa24189-14/aa24189-14.html): dust, molecular and ionized emission are compared within a fragmented barrel interpretation. In that model, projected circles need not be separate physical rings. The analysis restricts itself to the main nebula; it does not establish complete halo coverage.
- [SHAPE, Steffen et al. (2010)](https://arxiv.org/abs/1003.2012): the abstract describes interactive structural priors and comparison/optimization against observations. It is a useful model for our later hypothesis stage, not an image-to-unique-density guarantee.

## Automatic projected geometry

The first geometric milestone detects image-space shapes; the operator does not draw primitives first. The offline detector proposes elliptical curves, records the supported angular intervals, ranks alternatives and groups compatible centers. It extracts connected luminance-level boundaries after smoothing at several scales, derives their normals from image gradients, then fits deterministic five-point conic RANSAC proposals and refines them against each individual contour. A proposal cannot combine evidence from disconnected bright patches. Similar ellipses are deduplicated across levels and scales before ranking and shared-center grouping. This fits each registered source separately; it is not a joint cross-band fit. These intensity-level contours can describe the inner and outer edges of one bright rim; they are not automatically separate physical shells, tori or bipolar lobes. The same algorithm and recipe settings apply to all three ESO sources; there are no hand-entered Helix radii, centers or orientation defaults.

In the inspector, **solid arcs** denote image support and **dashed continuations** show the extrapolated rest of a candidate. Select a candidate to compare the fit with the same registered source and evidence layers. Ranking scores combine gradient strength, normal agreement, distance and angular coverage; they are relative fitting diagnostics, not calibrated probabilities. Shared-center groups suggest a relationship in projection, not proof of concentric 3D objects. Residual stars, partial coverage, unrelated curves and broad emission can mislead this first pass. An attractive ellipse is not validation of a physical model.

The 2026-09-12 automatic-geometry checkpoint produced 12 VISTA, 12 WFI and 9 wider-field hypotheses in 3.94 seconds total on the local machine. Actual browser overlays were inspected for all three sources: candidates follow parts of the main rim and inner brightness boundaries; some remain competing fits to the same rim, and the faint outer arcs are incomplete. No new 3D model is claimed. The first global-ridge experiment produced crossing false ellipses and was replaced by fitting each connected contour separately; a stars-only synthetic failure additionally motivated the contrast floor. Tests recover an offset, rotated, interrupted ellipse amid stars, reject that stars-only case, and recover/group nested ellipses from pixels. All 194 lab tests, strict lab TypeScript, the lab build and the three-source structure browser flow passed. The browser checks actual geometry registration, score/show-all/navigation controls, retained elements, pan over strokes and the existing region-review workflow without old volume requests or processing. Geometry JSON implementation hashes identify the tested detector; screenshots and browser evidence stay in the ignored local cache.

The [geometry recipe](../models/helix/observation-geometry.json) controls the deterministic sampling seed, proposal budget, minimum relative radius and maximum candidate count. The detector requires each sampled luminance level to be at least 0.012 above its background estimate on the display-RGB [0,1] scale, avoiding large contours caused by quantization or weak background fluctuations. This is an algorithmic contrast floor, not calibrated flux or a nebular boundary measurement. Detection settings are prepared configuration; the UI score slider only filters the completed hypotheses. Detection reads the existing structure map's **source.png**, which already comes from native NOX separation resized once; it does not use boosted false-color panels, run NOX again or change the source/structure pixels. Every map and source panel hash, source identity, registration and working raster dimension is verified before detection.

Each output is an immutable `geometry-{identity}.json` beside its exact source map. The identity includes recipe bytes, source/map/panel hashes, detector settings and TypeScript implementation hashes. Wall-clock timings appear only in the command log. Geometry attachments are excluded from the canonical input-catalogue hash so a replay can reproduce identical bytes. The catalogue gains references only after every source completes; previous map/image bytes and browser region-review identities remain unchanged. Generated outputs stay ignored. The stage performs no new volume inference or bake.

A useful checkpoint follows actual nebular arcs without requiring hand-drawn guides and makes unsupported continuations obvious. Some candidates may be false positives or alternative fits to the same rim; they should remain visible as uncertainty. Assess these overlays before adding 3D primitives, cross-band physical association or a density generator. Rotating an eventual hypothesis will not by itself establish its true depth.

## Shared extractor and historical Hubble benchmark

### Current ESO outputs

| Observation | Working raster | Scale-plane candidates | Unassigned display signal |
| --- | --- | --- | --- |
| VISTA infrared | 768 × 768 | 3,302 | 5.03% |
| WFI optical detail | 768 × 711 | 3,500 | 1.67% |
| Wider ESO field | 768 × 534 | 2,261 | 2.29% |

The first three-source preparation took **11.12 seconds**, including native-cache validation, resizing, extraction and output writing. Summing the written float RGB components reconstructs each working input channel with error below **6e-8**. Each image uses one prepared RGBA atlas of actual region supports (38–94 KB compressed); the browser filters retained sprites rather than analyzing pixels. No new NOX or volume jobs ran. Timing is machine dependent and does not include the earlier downloads or star separation.

The common angular frame and native-pixel transform are retained. Working-raster pixel edges are scaled back to native coordinates before sky registration. The complete source rectangles are preserved, including faint material and artifacts. The inspection resolution is deliberately bounded for this first review; unresolved fine knots require a later native-resolution pass if accepted evidence warrants it.

### Prepare current observations, structures and geometry from a clean checkout

From the repository root, with Node, pnpm and Python 3.9–3.12 installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts prepare-observations labs/nebula/models/helix/observations.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-observation-structures labs/nebula/models/helix/observation-structures.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-observation-geometry labs/nebula/models/helix/observation-geometry.json
node --experimental-strip-types labs/nebula/src/run.ts test observation-structure-source structure-inspection detect-shapes geometry-model
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

Open `/reconstruction?subject=helix-model-prior` and select **Structure map** to inspect prepared regions and geometric candidates. Keep an existing server alive; omit the final command when it is already running. This path does not need the old Hubble volume. The observation command downloads/verifies pinned originals and reuses completed matching NOX caches; the structure and geometry commands refuse missing or changed inputs instead of running NOX. A new structure extraction replaces the catalogue and therefore requires the geometry stage again; geometry by itself never regenerates those structures. Inspect Alignment before authorizing the structure command for any new object or source. The current three Helix sources have that authorization.

Prepared outputs and sources remain ignored under `.local/nebula-lab/observations/helix/`. Track the compact recipes, implementation and source records. A source/recipe/algorithm change creates a separate extraction identity; prior review decisions must not silently apply to changed evidence.

Two completed replays produced identical catalogue/map bytes and unchanged native-removal receipts. Runtime timing remains outside the stable map identity. Before geometry attachments were introduced, the verified catalogue SHA-256 was `b49074ce6a3b92b839f378b6efbce6fc945276be49a60ad4409383347c50b3b1`; its entries identify the corresponding unchanged maps and implementation hashes. Adding geometry references changes catalogue bytes, not those map identities. Targeted tests also fail when actual support, native-to-working registration scaling or the cache-only NOX guard is removed. These checks establish artifact/coordinate behavior, not scientifically correct segmentation.

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

The user authorized structure inspection of the [aligned wider observations](../models/helix/README.md#current-step-aligned-observations-and-native-star-removal) on 2026-09-11. The next acceptance gate is the usefulness of the automatically fitted projected curves alongside those candidates and filters, before fitting 3D hypotheses. The complete downloaded Hubble frame is not the complete nebula; the numerical benchmark above still describes that historical source.

1. Inspect automatically fitted arcs/ellipses over each image and existing structure evidence, especially faint outer regions and possible NOX damage. Assess supported intervals rather than accepting full extrapolated ellipses. If relationships remain unreliable after the bounded prototype adjustments, stop at projected evidence and identify the detector limitation.
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
