# SMC workspace

The lab contains eight optical/infrared candidate fields. Alignment opens with the image alone; **Density overlay** optionally shows the existing full stellar simulation. Image switches retain the common sky frame. Approximate or unqualified placements are marked in their labels/registration notes.

## Current qualification

| Candidate | Registration | Processing |
| --- | --- | --- |
| SMASH optical | Publisher sky anchor; reciprocal relative star check | Native NOX and fixed-density comparison completed |
| VISTA near infrared | Fitted shared-star homography to SMASH | Native NOX and fixed-density comparison completed |
| DSS2 optical | Fitted shared-star homography to SMASH | Native NOX and fixed-density comparison completed |
| AllWISE wide infrared | Fixed TAN WCS independently checked against AllWISE positions | Native NOX and fixed-density comparison completed |
| WISE press image | Diagnostic relative fit; fixed acceptance gate failed | Inspection only |
| Herschel + Spitzer | Publisher TAN coordinates | Inspection only; compact dust must not be treated as stars |
| Spitzer far infrared | Approximate publisher placement; star-pattern fit failed | Inspection only |
| Herschel / Planck / IRAS gas and dust | Same-grid publisher companion transfers TAN coordinates | Inspection only; independent astrometric gate pending |

[Candidate intake](README-candidates.md) records source grids, coverage, credits and acquisition limits. [Registration runs](registration/runs.json) retain passes and failures. The pinned [alignment report](registration/alignment-report.json) controls processing; no thresholds were relaxed for rejected images. SMASH's absolute sky solution remains the publisher's, whereas AllWISE has a catalogue check. These are not views from different observing directions.

## Reproduce the comparisons

From the repository root, with Python 3.9–3.12 and venv/pip available:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r --filter "./packages/**" build
node labs/nebula/run.mts prepare-processing-environment
node labs/nebula/run.mts prepare-overlays labs/nebula/models/smc/image-candidates.json
node labs/nebula/run.mts process-density-candidates labs/nebula/models/smc/process.json
pnpm lab:nebula
```

The overlay command restores missing images from their pinned publisher URLs. The processing command verifies registration before native NOX, reuses verified completed removal, and writes one resumable comparison receipt under `.local/nebula-lab/density-comparisons/smc-particles/`. [Star-removal setup](../../docs/star-removal.md) describes the Python environment and model required for a new machine. The command verifies or restores the reference density slices from the tracked compact grid; it does not regenerate the simulation or download its archive.

Open `/alignment?subject=smc-particles` or `/reconstruction?subject=smc-particles`. The four completed materials use the same 144 reference slices and preserve their alpha. None includes an observed SMC star layer yet. Bonanos et al. (2010) tables have been acquired, but selection, photometric calibration and conditional depth placement remain unimplemented; simulation particles are not observed individual stars.

## What is not finished

The simulation is displaced and broader than the observed SMC. Measured image-to-image registration must remain separate from an authored image-to-simulation fit. This session deliberately retains that mismatch rather than silently changing the physical frame or stretching images to conceal it.

The inherited fixed-density painter is a **projection-only research baseline**. It does not satisfy the finite-3D-material acceptance gate. Its starless colours cannot establish gas/dust depth; front-image agreement would not validate side structure. The result records `materialGatePassed: false`. No application object was replaced or promoted.

Next: qualify the remaining infrared registrations without erasing compact dust; establish an explicit, reviewable model-placement hypothesis; implement/compare finite 3D material support; then inspect front, oblique and both side axes before considering production. Preserve a failing projected-painter counterexample, shared density geometry and measured catalogue identities.
