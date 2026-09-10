# Shared density, registration and viewing checks

Alignment and Reconstruction must use the same prepared density object and the same saved image placement. The older photo-derived benchmark is a separate historical experiment.

## Invariants

- Repaint Alignment’s exact 144 prepared LMC quads, preserving all vertices, crops, bounds and every decoded alpha byte. Images supply chromaticity only; missing coverage retains neutral density color.
- Preserve the whole saved Alignment image transform, including authored scale/rotation and pivot. Earth view uses the same physical observer, orientation and lens framing in both tabs, including legacy routes to the same density object.
- Preserve observed stellar IDs, astrometry and photometry. One configured SMASH sky-to-density fit and deterministic density-conditioned depth realization place the same 943 stars for every image. Candidate images cannot move or select them.
- Actual source density must be positive at every star. One faint star falls below the common projection’s eight-bit quantization; it keeps zero cutoff signal and stays visible when cutoff is zero. Do not invent a positive floor or remove it from the catalogue.

## Why the previous check missed the problem

The previous worker preserved the 416-slice photo-derived benchmark and stripped Alignment’s shared fit. Its original-image plane agreed with its own wrong mapping, so within-Reconstruction projection tests passed. The screenshots still differed from Alignment. See the [rejected fixed-benchmark experiment](research/fixed-benchmark-material.md) and [earlier density resampling](research/raw-density-slice-calibration.md).

The current browser gate compares the same nine source-image landmarks in **both actual tabs**, using the saved placement, Earth view and two routes to the same density cloud. It requires a shared camera and at most 0.05 px image-point difference. Internal agreement in Reconstruction alone does not satisfy this gate.

## Current evidence

The cross-tab browser gate passed all six comparisons (three sources × two routes). Maximum image-point discrepancies were 0.00839 px for Horálek, 0.00241 px for VISTA and 0.01210 px for WISE. The camera lens and distance matched; there were no browser errors or processing writes. Neutral original-image metadata reads returned existing prepared assets.

The VISTA, Horálek and WISE jobs are verified against Alignment’s prepared bank: exact geometry, every alpha byte, frame and resource hashes. All three catalogue outputs have identical model positions and preserved measured records. Repainting existing native NOX outputs takes a few seconds per image. No star-removal job is repeated.

Front, four oblique poses and both edge views were captured for all three materials. The inherited density shape remains fixed, without the photo-derived benchmark’s rectangular crop. Thin side-view slice banding and diffuse color projection remain visible; exact cloud ownership does not establish rotation stability or measured nebular gas depth.

At the final lab boundary, all 145 tests and TypeScript checking passed. The saved-placement scale/rotation assertion fails if the shared fit is stripped again.

## Repeatable checks

From the repository root, with pinned inputs and completed results available:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
# In a second terminal at the repository root after the lab is ready:
node --experimental-strip-types labs/nebula/src/run.ts browser-reconstruction-tabs
node --experimental-strip-types labs/nebula/src/run.ts browser-reconstruction-reference
```

Reuse a running lab. Both commands inspect the `.local/nebula-lab/alignment-material-acceptance.json` ledger by default, accept an explicit ledger/base URL/output directory, and write local screenshots/reports. They never start image removal or reconstruction.

The separate `browser-reconstruction-stability` command isolates active banks at the same camera. Its fixed thresholds are 5% relative luminance and 0.04 normalized pixel L1. Earlier failed measurements belong to the historical banks above; they are not evidence of calibrated current output. Preserve the thresholds and report future results honestly. Do not fit per-image exposure to conceal a coordinate or bank-compositing error.
