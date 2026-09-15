# Nebula reconstruction

Private scientific methods for registering observations, detecting projected structures and fitting conditional three-dimensional emission hypotheses. Accepted reconstruction inputs are replayed by `volume-bake`; this package does not render or bake delivery assets.

```text
src/
  star-removal/       configured NOX execution, native RGB preparation and preserved Python workers
  observations/       configured archive requests, metadata validation, footprint and image ranking
  registration/       stellar and particle alignment, overlap
  evidence/           wavelets, contours, ridges, ellipse detection and evidence contracts
  methods/
    density-prior/    filled/coherent support decomposition, depth sampling and projection checks
    inference/        positive emission fitting, projected targets, evidence-conditioned depth
    joint/            morphology and line-of-sight velocity fitting
    kinematics/       slit calibration, molecular table parsing and forward models
    sampled/          sampled-prior emission and material fitting
    symmetry/         positive constrained emission and geometric depth priors
```

Consumers use the explicit package exports. Methods accept arrays, typed fields and validated scientific records. The lab owns acquisition configuration, catalogue membership, host-specific path restrictions and job orchestration. Archive methods receive endpoint, search radius, timeout and HTTP transport explicitly. A depth surface is a conditional hypothesis supported by its evidence ledger, not a uniquely measured three-dimensional reconstruction.

Run `pnpm --filter @cssearth/nebula-reconstruction typecheck` from the repository root. Observation tests live in `tests/observations`; existing numerical tests remain under the lab during the ownership migration and exercise the package through compatibility exports.

The preserved Python workers require their established NumPy/OpenCV environment (classical separation additionally uses SciPy). NOX loads its pinned model only when explicitly invoked. Worker relocation preserves file bytes and the `scriptSha256` in existing receipts; the host resolves historical source pins to the current owner. Native image and subprocess tests use tiny synthetic data and no model download.
