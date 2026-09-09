# Fixed cloud and slice stability

The accepted benchmark owns geometry, opacity, depth and catalogue placement. Every candidate repaints its exact 416 prepared quads; all decoded alpha bytes and all 943 catalogue records remain identical. The full raw simulation is an Alignment reference, not a replacement for this cloud.

Candidate chromaticity changes the material. Uncovered or zero-RGB texels retain explicitly counted benchmark color. This preserves the reference cloud’s boundaries and imperfections too; it does not establish measured nebular gas depth.

## Mapping correction

The rejected painter applied Alignment’s shared 3× / +39° fit in the fixed benchmark frame and substituted the much broader, smoother stellar simulation. The current mapper removes that shared preview fit while retaining additional per-image adjustments. It uses the candidate’s verified sky registration and the benchmark/catalogue observer frame.

**Earth view** and **Original image** expose the exact painter registration. Across VISTA, WISE and Horálek, the browser checked 25 catalogue rays against each original-image plane: maximum projected discrepancy was 0.000533 px, below the fixed 0.02 px gate. Both source switches retained the camera; Earth reset, original opacity and retained toggle checks passed without resource errors or processing requests. This tests coordinate consistency, not a fresh detection of matching photographic stars; source-registration evidence remains separate.

## Actual prepared outputs

All three completed material jobs were decoded and checked against the benchmark: identical geometry, every alpha byte, catalogue records and resource hashes. Repainting took about 22–25 seconds per image with already completed native NOX inputs. The 145 lab tests and TypeScript check passed. An isolated mutation making image brightness alter alpha failed the independent output assertion, with the worker’s alpha guard removed in that disposable test copy.

Horálek retained benchmark color at 9.57% of positive-alpha texels outside its footprint; VISTA at 7.05%; WISE covered all positive-alpha texels. These are texel counts across the prepared slices, not physical mass fractions or independent volume coverage measurements.

Front, four oblique directions and both edge views were captured for all three materials. The shape remains fixed across materials. The inherited boundary and side-view texture artifacts remain visible.

## Rotation gate remains failed

At the same camera pose, isolate each active bank with its existing optical-path correction. Use native brightness, zero cutoff, hidden catalogue stars and no original overlay. Thresholds remain 5% relative luminance and 0.04 normalized pixel L1, defined as sum(abs(A−B))/sum(A+B).

| Image | Y/Z luminance difference | X/Z luminance difference | Y/Z image L1 | X/Z image L1 |
|---|---:|---:|---:|---:|
| Horálek | 22.99% | 22.14% | 0.1221 | 0.1118 |
| ESO VISTA | 24.06% | 23.39% | 0.1250 | 0.1162 |
| NASA WISE | 21.80% | 20.78% | 0.1218 | 0.1069 |

**All three still fail the strict bank-handoff gate.** Fixing cloud ownership and registration does not calibrate the benchmark’s axis-dependent compositing. Preserving exact alpha deliberately prevents hiding the defect by reshaping each material. No per-image or per-axis gain has been fitted to force these checks to pass.

The remaining calibration belongs to the common prepared-bank encoding/compositing layer. Earlier sampling changes reached an impasse; see the [historical raw-density experiment](research/raw-density-slice-calibration.md). A future correction must improve identical-camera comparisons while retaining the accepted cloud, all stellar positions and local texture continuity. Do not declare rotation stability from passing unit tests, average color matching or successful bakes.

## Repeat the saved-output checks

From a clean repository setup, with the pinned inputs and completed material results available:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula
# In a second terminal at the repository root, after the lab is ready:
node --experimental-strip-types labs/nebula/src/run.ts browser-reconstruction-reference
node --experimental-strip-types labs/nebula/src/run.ts browser-reconstruction-stability
```

An existing live lab should be reused. Both commands default to `.local/nebula-lab/material-reconstruction-acceptance.json`, accept an explicit ledger/base URL/output directory, inspect saved outputs only, and fail on absent or unverified evidence. They write local screenshots and reports. The stability command currently exits nonzero for the measured disagreement above.
