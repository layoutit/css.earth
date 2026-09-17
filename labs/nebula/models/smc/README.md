# SMC workspace

The lab contains seven active optical/infrared candidate fields. Standalone Spitzer remains archived in the source intake; its approximate placement is excluded from the active workspace. Alignment opens with the image alone; **Density overlay** optionally shows the existing full stellar simulation. Image switches retain the common sky frame. Approximate or unqualified placements are marked in their labels/registration notes.

## Current qualification

| Candidate | Registration | Processing |
| --- | --- | --- |
| SMASH optical | Publisher sky anchor; reciprocal relative star check | Native NOX and fixed-density comparison completed |
| VISTA near infrared | Fitted shared-star homography to SMASH | Native NOX and fixed-density comparison completed |
| DSS2 optical | Fitted shared-star homography to SMASH | Native NOX and fixed-density comparison completed |
| AllWISE wide infrared | Fixed TAN WCS independently checked against AllWISE positions | Native NOX and fixed-density comparison completed |
| WISE press image | Diagnostic relative fit; fixed acceptance gate failed | Inspection only |
| Herschel + Spitzer | Publisher TAN coordinates | Inspection only; compact dust must not be treated as stars |
| Spitzer far infrared | Approximate publisher placement; star-pattern fit failed | Archived; excluded from active candidates |
| Herschel / Planck / IRAS gas and dust | Same-grid publisher companion transfers TAN coordinates | Inspection only; independent astrometric gate pending |
| DSS2 FITS blue/red | Exact TAN request grid checked against AllWISE catalogue stars in the blue plate channel | Native NOX and finite lens completed; saturated plate stars masked as no coverage, plate steps uncorrected |
| AllWISE FITS W2/W1 | Exact TAN request grid checked against AllWISE catalogue stars in its W1 channel | Native NOX and finite lens completed |
| AllWISE FITS W4/W3/W1 | Same grid and catalogue check in its W1 channel | Compact emission preserved instead of NOX; finite lens completed |
| Herschel SPIRE 250 µm | Same-grid transfer from the qualified AllWISE W2/W1 composite; too few stars for its own gate | Compact emission preserved instead of NOX; finite lens completed |

The four composed survey-band images are described in [survey band composites](README-candidates.md#survey-band-composites). Their fixed-WCS catalogue gate uses a chance control that scales with detection density; [registration](registration/README.md#density-aware-chance-control) records the rule, its regression and the negative controls.

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

Open `/alignment?subject=smc-particles` or `/reconstruction?subject=smc-particles`. The four completed fixed-density materials use the same 144 reference slices and preserve their alpha.

The accepted line of work moved on from those materials. [The observation-constrained shape trial](constrained/README.md) fits the simulation and a simple ellipsoid to the VMC red-clump tracers, and [the simulation-guided emission experiment](constrained/EMISSION-METHOD.md) fits finite emission to the registered optical image on top of one of those shapes. Its subjects are `smc-constrained` and `smc-ellipsoid`. [Published massive stars](stars/README.md) adds 1,803 Bonanos et al. (2010) rows as an image-independent layer of one finite model; the star depths are conditional realizations inside that model, and simulation particles are still not observed individual stars.

## What is not finished

The simulation is displaced and broader than the observed SMC. Measured image-to-image registration must remain separate from an authored image-to-simulation fit. This session deliberately retains that mismatch rather than silently changing the physical frame or stretching images to conceal it.

The inherited fixed-density painter is a **projection-only research baseline**. It does not satisfy the finite-3D-material acceptance gate. Its starless colours cannot establish gas/dust depth; front-image agreement would not validate side structure. The result records `materialGatePassed: false`. It is preserved as a rejected counterexample, not as a delivery.

The finite emission models that superseded it also record `materialGatePassed: false`: a fitted projection and an inspected render are not a measured gas reconstruction. The broad envelope is the VMC-constrained ellipsoid's shape hypothesis and the detail components are conditioned on the Garver simulation, which the same VMC comparison disfavours. [Model `075ce045…`](constrained/EMISSION-METHOD.md#ellipsoid-envelope-2026-09-17) and its five publisher-image lenses are now promoted to the application object; [its README](../../../../src/objects/smc/README.md) owns that delivery's evidence, inspection record and limitations. The four FITS survey-band composites stay in the lab with their recorded defects.

Next: test spatially coherent depth-mode selection and finer finite supports against the image residual; correct the frozen VMC intake's RA-wrap omission as a versioned source change; give the Herschel SPIRE and DSS2 plate composites the coverage and gradient corrections their notes record. Preserve the failing projected-painter counterexample, the independent neutral shape comparison and the measured catalogue identities.
