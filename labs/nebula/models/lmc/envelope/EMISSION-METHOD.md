# Two-scale envelope LMC emission experiment

This is a new inferred-emission model for the LMC. It does not repaint the unchanged stellar-density
volume. Model `lmc-clouds-emission-envelope` and its three datasets are promoted to the application by
[`app-datasets.json`](app-datasets.json); [the object's README](../../../../../src/objects/lmc-volume/README.md)
is the delivered account, and the `alignment-density-material-v1` datasets it replaced remain a historical
reference.

The method is the SMC's, unchanged. [The SMC method note](../../smc/constrained/EMISSION-METHOD.md)
owns the derivation, the roles of the inputs, the bounded acceptance rules and the rejected earlier
approaches; this note records only what is specific to the LMC.

## What is pinned

| Input | Pin |
| --- | --- |
| Primary registered, star-removed image | Horálek NOIRLab wide field, reconstruction `lmc-clouds-horalek-widefield` (`iotw2547a.jpg`, NOX star removal) |
| Depth prior | `labs/nebula/models/lmc/full-density/source/volume.json`, the Garver et al. (2026) stellar simulation, through the baseline request |
| Registration gate | `labs/nebula/models/lmc/candidates/source/alignment-report.json`; all three images pass unchanged |
| Dataset images | the same three registered baselines the application ships: `lmc-clouds-vista-infrared` VISTA, `lmc-clouds-horalek-widefield` Horálek, `lmc-clouds-wise-wide-infrared` AllWISE |

Horálek is the primary because it is the brightest and most structured of the three registered images;
VISTA is faint and low-contrast at this scale, and the AllWISE frame spans 24° with the galaxy in a
small central part of it. Star removal is reused from those baselines and never repeated.

## Settings that differ from the SMC

- `depth.minimumSigmaZ` 416 and `maximumSigmaZ` 4160 arcseconds. The SMC's 330/3300 were 0.1–1.0 kpc at
  its 62.44 kpc distance; these are the same 0.1–1.0 kpc at the LMC's 49.59 kpc.
- No `exclusions`. The SMC recipe masked a foreground globular cluster in its frame; this field has none,
  and the fit residual shows no unmodelled compact foreground source.
- No `priorCloud` override. The SMC's ellipsoid variant swapped the envelope's density for a
  VMC-constrained ellipsoid that scored better against red clumps. The LMC has no depth-tracer intake in
  this repository, so the envelope keeps the simulation the baseline request already pins.
- Everything else is the SMC's two-scale recipe verbatim: 384-pixel fit, 128 slabs on the longest axis,
  four samples per slab, `exposureGain` 2.5, `fullChromaAlphaByte` 24, envelope
  `scalePixels` 10 / `fraction` 0.85 / `floor` 0.03 / `depthTrim` 0.005.

## Result, 2026-09-18

Recipe `emission-envelope.json`; model `lmc-clouds-emission-envelope`.

- 469 finite components from 480 iterations. None failed to find prior support, so no component keeps the
  authored fallback depth.
- Front-projection RMSE 0.13232 before the fit, 0.03417 after. Total front-projection relative squared
  error 0.019678; detail-only relative squared error 0.066678.
- The envelope carries 74.44% of the image light with 4.42% excess over it; 43,112 grid pixels sit on the
  3% floor, out of 133,248 in the 384 × 347 fit grid and 67,891 covered ones.
- Depth is trimmed to the image-weighted 0.5–99.5% simulation mass: −13,771…+16,341 arcseconds, that is
  −3.31…+3.93 kpc along the line of sight. Smallest fitted σ_z 0.147 kpc.
- Slabs 123 × 128 × 50 at 0.305 kpc over −14.57…22.78 × −17.42…21.64 × −8.77…6.29 kpc. 301 baked quads;
  all 301 material textures reproduce the newly fitted neutral alpha exactly, and the recolouring reports
  1,411,300 positive-alpha texels with none outside the image and none black.

## Datasets

`finite-datasets.json` bakes the application's three images onto this one geometry, with no exclusions:

| Dataset | Result |
| --- | --- |
| `vista-infrared` | `lmc-clouds-emission-envelope-vista-infrared` |
| `horalek-widefield` | `lmc-clouds-emission-envelope-horalek-widefield` |
| `wise-wide-infrared` | `lmc-clouds-emission-envelope-wise-wide-infrared` |

`.local/nebula-lab/finite-datasets-lmc-clouds-emission-envelope.json` indexes them. Each recolours the same neutral alpha with
its own component and envelope chromaticity; the geometry never changes between them.

## Inspection against the shipped repaint

Captures and the machine record are under ignored `output/lmc-improvement/shape/`
(`inspect-material-poses.ts`, `contact-{horalek,vista,wise}.png`, `alpha-hist.log`). Both sides were
captured in the actual shared lab viewer, at the object's own 5 kpc Earth framing and then at one shared
15 kpc framing for the Earth-facing, +60° oblique and both exact 90° side poses, with the catalogue star
layer suppressed on both so only the volume material shows.

- **Earth view and oblique.** The two-scale model shows the bar, the star-forming knots and a coherent
  halo, close to the photograph. The repaint blows its core out to white, loses the bar's shape, and
  prints the registered image's straight footprint edges into the volume as brightness steps.
- **Both 90° side views.** Both follow the same simulation depth distribution, so the silhouettes agree.
  The repaint's is crossed by regular coloured stripes; the new model's is smooth, and the fitted knots sit
  at separate depths instead of being smeared through the whole body.
- **Banding.** The recorded XYZ-bank handoff defect is a quantisation artifact, and the alpha histograms
  measure it. The repaint's texels sit at alpha 1–3 for 57%/56%/67% of the x/y/z banks, with bank median
  alpha 3/3/2 and 90th percentile 18/17/9 — the z bank is markedly fainter per texel than x and y, which is
  the handoff brightness step. The new model reads 41%/41%/42% at alpha 1–3, median 5/5/5 and 90th
  percentile 38/39/38: the banks now agree, and almost no texel is in the range where 8-bit premultiplied
  compositing invents chroma.

## Known problems

- A violet-blue patch sits on the western footprint edge in every dataset, where the envelope's smoothed
  chromaticity is extrapolated from very few covered pixels. A small detached knot group above the body
  appears at the oblique and side poses.
- The AllWISE dataset is noisy: its registered frame covers 24° and the galaxy occupies a small, faint part of
  it, so its chromaticity is far less reliable than the other two.
- Detail is bounded by the 384-pixel fit and the 0.305 kpc slab pitch, which is twice the SMC's because the
  LMC's fitted box is about twice as wide.
- The envelope is the stellar simulation's shape hypothesis, not measured gas depth, and the LMC has no
  depth tracer in this repository to test it the way the SMC's red clumps tested its ellipsoid.
- No star layer is prepared for this model, so the comparison suppressed the star layer on both sides.

The result remains reviewable research, not qualified application material. The full original prior and the
shipped repaint datasets are preserved separately and unchanged.

## Evidence captures

- Registration before and after: top, model `13cf532e` on the hand-authored `scale 3` placement; below, model `9dfd48a6` on the measured registration (1.0000× sky scale), with and without the 1,042-star layer.
- Difference map, old vs fitted Horálek dataset: render − image on luminance at the Earth view, blue too dark and red too bright. Old dataset `95495a7d` (left) shows the red mid-tone ring; the tone-fitted dataset `60b47e10` (right) breaks it up (too-bright share 33% → 12%). The bar reads blue on both: the core plateau the exposure solve then lifted.
- Levels panel: the Reconstruction tab's per-channel histograms, delta and transfer curves for the Horálek dataset.
