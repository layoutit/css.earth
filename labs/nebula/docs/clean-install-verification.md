# Nebula clean-install verification

**Passed on 10 September 2026, on macOS arm64.** A fresh shallow GitHub clone started without `node_modules`, `.local`, downloaded originals, a Python environment or generated nebula textures. Dependency downloads used separate empty pnpm/pip caches. No source images or processing results were copied from the working repository.

The cold bake ran at `4f3cdee28380f4a30cfa0f455d2f091d629b50c9`. After it finished, the clone fast-forwarded to `5fbe0d832` to use the new read-only verifier. That commit adds verification only; the baking algorithms, recipes and source pins are unchanged. The checkout stayed clean throughout processing.

## Results

| Check | Observed result |
|---|---|
| Installation | Fresh `pnpm install --frozen-lockfile --ignore-scripts`, shared package build, new Python venv and dependency/model acquisition succeeded |
| Full bake | **899 seconds (15 minutes)**, including acquisition and Python setup; `BAKE_COMPLETE lmc` |
| Density | Both LMC/SMC fields rebuilt: **288 slices**, matching accepted hashes |
| Images | Three native candidates and historical SMASH calibration downloaded; three inspection previews, six extraction previews and the calibration panel regenerated |
| Native processing | VISTA, Horálek and WISE each completed the saved baseline and NOX; full native coverage and exact source = diffuse + residual checks passed |
| Reconstruction/delivery | **432 LMC slices** reproduced the accepted delivery bytes, with identical cloud geometry and the same **943 stars** across all three materials |
| Cached full bake | **4.22 seconds**; all three baselines, NOX results and reconstructions reused |
| Read-only verification | **0.69 seconds**; `NEBULA_VERIFIED` |
| Negative checks | Removing a real density slice and corrupting a real delivered texture each made verification fail without repairing them; restored files passed again |
| App preparation command | `pnpm prepare:nebulae` restored a removed delivery texture from completed stages, then verified its cached delivery |
| Browser | All three variants loaded and switched; six Alignment/Reconstruction correspondence checks passed, maximum landmark difference **0.0121 px**; no script/HTTP errors or processing writes |
| Lab checks | 159 existing tests, the new verifier regression, typechecking and a lab-only Vite build passed |

Use the complete [nebula-only installation and bake instructions](baking.md). The commands require no planet asset setup or environment-wide preparation. Those other environment textures remained absent in the test clone. The temporary browser server was stopped after verification; the user's running lab was untouched.

## Evidence and limits

[The machine-readable record](clean-install-verification.json) records versions, counts, negative checks and log hashes. Local logs, native receipts and browser evidence remain in `/tmp/cssearth-nebula-clean.91rLVz/.local/verification/`; generated assets are ignored, not committed.

This verifies the current LMC VISTA/Horálek/WISE recipe and neutral SMC density on **macOS 26.5.1 arm64, Node 22.23.2, pnpm 10.33.0, Python 3.9.6**. Other operating systems and CPU architectures were not run. Remote originals/model and compatible Python wheels must remain available. Successful replay preserves the accepted images; the existing model, alignment and oblique-rendering limitations still apply.
