# Published SMC massive stars

Measured angular positions and Johnson V photometry from [Bonanos et al. (2010), AJ 140, 416](https://doi.org/10.1088/0004-6256/140/2/416), [CDS/VizieR J/AJ/140/416](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/140/416). The original fixed-width tables, their byte pins and the original column description (`Bonanos2010-ReadMe.txt`) are kept in `source/`.

The publication compiles 5,324 massive SMC stars with literature spectral types. Table 3 has 3,654 counterparts with 0.3–24 µm photometry; 2,962 have a finite published V, and 1,803 have V ≤ 16. Preparation keeps finite V ≤ 16 whose measured ray lands on a covered pixel of the current finite model's fit footprint. That footprint is the registered Horálek image with alpha ≥ 250, minus the authored foreground-cluster exclusion. All 1,803 bright rows are inside it, and all 1,803 have positive joint support, so none is excluded. This is an incomplete massive-star sample, not every SMC star. The separate OGLE V column is not substituted for a missing V.

## Depth

J2000 angular positions stay fixed at the lab epoch, and individual distances are unmeasured. The star layer belongs to the **finite model**, not to any image. A checked-in lens recipe names the model: `constrained/finite-lenses.json` (Garver simulation envelope, `ed90b7bc…`, `prepared/stars.json`) or `constrained/finite-lenses-ellipsoid.json` (VMC-constrained ellipsoid envelope, `075ce045…`, `prepared/stars-ellipsoid.json`). The command takes the recipe path as its only argument and falls back to the manifest default, so no result id is hard-coded and both layers coexist. Each measured ray is placed on the model's tangent plane in the model frame (kpc, observer at `D = 62.44` kpc). A proposed depth maps to `(x,y,z)=(x0*(1+z/D),y0*(1+z/D),z)`.

The conditional depth weight is `maxRGB(model emission) × decoded density × (1+z/D)^2`. The density is the cloud that model's own `source/envelope.json` pins (`priorCloud`): the Garver simulation volume for `ed90b7bc…`, the VMC-constrained ellipsoid volume for `075ce045…`. Records that pin no cloud of their own fall back to the model request's cloud, and the envelope's `priorIdentity` must match either way. Model emission is sampled exactly as the bake samples it: finite components plus the envelope, times the arcsec-per-kpc path factor, and zero outside the baked box. The same SHA-256 source-ID quantile and 1,536-interval piecewise-linear CDF as the LMC layer select the depth. Each chosen point must have positive emission and density, and the CDF must not bridge a zero-support gap. A ray without joint support would be listed in `provenance.excludedNoJointSupport` and never relocated. There is no plane, jitter or fallback point. This is a **model-contained display realization**, not a recovered stellar distance or evidence of membership in a particular structure.

`cloudSignal` is the model's own cutoff signal at the placed point: `aligned-image.png` luminance with global maximum normalization, the same raster the lab cutoff tool uses. Membership is the model's single `all-light` part. Colours follow published B−V through the shared catalogue display-colour approximation, with no dereddening. Point size and opacity use the shared magnitude response. Retain author and CDS credit; no new licence is asserted.

## Wiring

`prepare-smc-stars [recipe]` writes the recipe's layer (`finite-lenses.json` → `stars.json`, `finite-lenses-<name>.json` → `stars-<name>.json`) and the model-owned index `.local/nebula-lab/finite-stars-<modelResultId>.json`. That index sits beside the lens bundle and pins the file's SHA-256. Lens discovery attaches the same `stars` path to every baked lens of that model. A stale pin, another model, a different frame or a different subject rejects the bundle rather than showing unverified stars. After a re-fit, update the recipe and re-run the command for it; other models' layers and indexes are untouched. No result id is hard-coded.

## Evidence (models `ed90b7bc…` and `075ce045…`, 2026-09-17)

- `smc-stars` tests run per layer (`SMC_STAR_LAYER=<path>`; both pass) and cover the following. Mutations that remove the zero-gap guard, the footprint predicate, the narrow unsupported-ray handling, or that read the baseline cloud instead of the envelope's pinned prior, each turn a test or the command red.
  - byte pins
  - deterministic replay
  - RA/Dec recovered from the placed kpc points within 1e-9°
  - footprint selection
  - positive joint support for all stars
  - an independent cutoff-signal read
  - joint-CDF guards
  - one layer per model, each naming its own recipe, index pin and pinned depth density
- Registration: stars were projected onto each registered original image. The table gives how many of the 40 brightest land within 1 px of a photographic peak; mirroring east-west gives 0 for every image.

  | Image | Within 1 px of 40 | Median offset |
  | --- | --- | --- |
  | Horálek | 22 | 0.67 px |
  | VISTA | 20 | 3.12 px |
  | DSS2 | 35 | 0.70 px |
  | AllWISE | 14 | 3.84 px |
  | SMASH | 9 | 5.26 px |

- Browser (shared viewer, Earth view, Horálek and VISTA lenses of each model): every rendered star lies within 0.011 CSS px of the rendered original-overlay texel on its ray, with no console error but the favicon. Captures are in ignored `output/smc-vmc/stars/` (`ed90b7bc…`, 5 lenses) and `output/smc-vmc/stars-ellipsoid/` (`075ce045…`, 9 lenses).
- The two models place the same measured rays at different depths: median |Δz| 0.48 kpc. Tangent positions, and so every registration number above, are identical by construction.

## Known limitations

- Depths inherit the simulation envelope's shape hypothesis.
- The footprint is the Horálek fit's. Stars outside a narrower lens image still display, because stars are image-independent.
- `prepared/stars.json` requires the local finite model to replay.

From the repository root:

```sh
python3 labs/nebula/packages/lab/src/server/workflows/stars/acquire-smc-stars.py
node --experimental-strip-types labs/nebula/run.mts prepare-smc-stars
node --experimental-strip-types labs/nebula/run.mts prepare-smc-stars labs/nebula/models/smc/constrained/finite-lenses-ellipsoid.json
node --experimental-strip-types labs/nebula/run.mts test smc-stars finite-lens-bundles
SMC_STAR_LAYER=labs/nebula/models/smc/stars/prepared/stars-ellipsoid.json node --experimental-strip-types labs/nebula/run.mts test smc-stars
```
