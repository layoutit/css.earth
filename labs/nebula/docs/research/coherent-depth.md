# Repeatability and coherent-depth controls

> Research record. This describes the recorded experiment, not the current app. Retired tabs and Orion models are no longer available. Use the [current workflow](../workflows.md) for processing and [current reconstruction](../reconstruction.md) for the active method.

**Decision: retain the reusable tooling; reject these masks for production nebula reconstruction.** The same code processes native Tarantula and Orion crops, but most light still receives broad fallback depth. Repeatable preparation is established; a good general nebula model is not.

## Inspect

- [Tarantula controls](http://127.0.0.1:4331/?subject=tarantula-coherent&tab=reconstruction) and [Orion controls](http://127.0.0.1:4331/?subject=orion-coherent&tab=reconstruction).
- [Tarantula extraction evidence](../../models/lmc/research/tarantula-core-benchmark/benchmark.json) and Orion extraction evidence (removed Orion research asset). These saved research products have no separate UI tab.

**Camera pose** provides front, ±30°, ±60°, and edge-on views. Switching A/B/C within a subject preserves rotation and distance. Pointer orbit and wheel zoom remain available. These comparisons scale focal length and fitting distance together by 100, approximating the parallel projection assumed by the photograph columns. Existing subjects retain their camera. The original close camera introduced radial front-view streaking independently of depth smearing; that comparison error was corrected.

| Control | Depth assignment | Purpose |
|---|---|---|
| A · broad | Whole target uses one broad finite profile | Isolated smearing control; not the complete LMC simulation model |
| B · localized | Whole target uses one thin finite profile | Tests localization alone; can still resemble a thick card |
| C · automatic | Overlapping detected regions share finite supports and coherent tilts; unassigned light stays broad | Tests automatic ownership against A and B |

All controls use the identical full display photograph, including stars, and the same exposure. No point-source subtraction is hidden. Detected pixels retain 20% of their optical contribution in the broad component. Depth widths and tilt bounds are the same fractions of image width in both cases. Tarantula also uses a pinned coarse stellar prior; Orion has no depth prior.

## Inputs and interpretation

| Case | Frozen native input | Projected width | Depth evidence |
|---|---|---:|---|
| Tarantula core | SMASH 512² crop; original origin (2156,956) | 615.02 pc | Authored photo/simulation alignment; stellar cells about 208 pc deep |
| Orion, LL Orionis | HST composite 512² crop; original origin (1700,650) | 0.10276 pc at the cited cluster distance | None; Z placement is an authored hypothesis |

Tarantula: [NOIRLab SMASH](https://noirlab.edu/public/images/noirlab2030a/), CC BY 4.0. Stellar prior: [Garver et al. dataset](https://doi.org/10.5061/dryad.1vhhmgr82) and [paper](https://doi.org/10.1093/mnras/stag1287), CC0 data. A 20×20×48 window copies the existing density cells without interpolation or normalization. Its translated coordinates, source hashes and procedure are recorded beside the compressed field. There are no gas particles in this simulation.

Orion: [NASA/STScI image](https://science.nasa.gov/asset/hubble/abstract-art-found-in-the-orion-nebula/), [publisher registration](https://www.astropix.org/image/stsci/2006-01i), and [Menten et al. distance](https://www.aanda.org/articles/aa/full/2007/41/aa8247-07/aa8247-07.right.html). The composite mixes HST/ESO broad and narrow optical bands. Conversion from Adobe RGB to sRGB does not resize the crop. [The source receipt](../../sources/orion-reference.json) records complete credits, hashes, angular scale and uncertainty. Cluster distance supplies projected scale, not gas depth.

Both inputs are display composites, not calibrated flux maps. Isolated lab frames have zero origin and identity orientation; they do not assert celestial placement.

## Results

| Same default starlet settings | Tarantula | Orion |
|---|---:|---:|
| Detected scale regions | 510 | 290 |
| Connected cross-scale families | 371 | 158 |
| Positive pixels with detected support | 5.49% | 3.56% |
| Optical contribution localized by C | 10.04% | 4.42% |
| Optical contribution remaining broad | 89.96% | 95.58% |

These are display-model quantities, not gas fractions. **Wavelet supports identify significant contrast, not filled cloud footprints.** Tarantula's catalogue remains dominated by stars and the bright centre. Orion recovers parts of the bow arc but also diffraction spikes. Lower thresholds add many texture fragments.

Rotated renders confirm that C remains close to the smeared broad control: too little light changes ownership. B reduces spreading but remains an extruded image. Correct front columns and finer integration do not fix missing cloud ownership. Rectangular crop boundaries are retained diagnostic boundaries, not proposed nebula silhouettes.

The smaller **getsf run reached its 30-minute bound**. Source-background separation converged after 19 iterations, last correction 0.0045. Filament separation completed 10 iterations, last correction 0.0107, without finishing. Final component maps/catalogues were incomplete. The process group was terminated and checked; partial maps are not shown. Configuration, software/input pins and iterations are retained under the core benchmark's `getsf/` directory.

**Next owning problem: reconstruct extended components and filled ownership maps before assigning depth.** Evaluate automatic source/extended separation and multiscale component reconstruction. Do not treat sparse coefficient detections as complete clouds or tune textures to conceal the missing ownership. Physical depth and stellar membership remain separate evidence problems. Whole-galaxy and production integration are not accepted by this experiment.

## Rebuild from committed inputs

The crops and small stellar-prior window are checked in. Restricted getsf software and large original TIFFs are unnecessary for these controls.

```sh
pnpm install --frozen-lockfile
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts prepare-structures labs/nebula/models/lmc/research/tarantula-core-benchmark.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-structures labs/nebula/models/orion-structure-benchmark.json
pnpm lab:nebula:coherent labs/nebula/models/lmc/research/tarantula-coherent.json
pnpm lab:nebula:coherent labs/nebula/models/orion-coherent.json
pnpm lab:nebula
```

The same sampler/baker executes both data recipes. Lossless 512px masters stay in the ignored cache; WebP delivery derives from verified masters. Each control has 32 slabs per axis, 16 integration samples per slab and 96 prepared images.

| Delivery | Compressed images | Decoded images |
|---|---:|---:|
| Tarantula A / B / C | 8.47 / 1.91 / 8.61 MB | 85.6 / 12.1 / 95.3 MB |
| Orion A / B / C | 2.80 / 0.70 / 3.00 MB | 84.6 / 12.1 / 84.1 MB |

These redundant controls are research tooling, not production transfer budgets. Only one control is mounted at a time.

## Verification and stopping limits

- 39 lab tests pass. Deliberately unresolved thin emission and aliased X sampling fail their numerical gates. A 512² region regression guards against argument-stack overflow.
- Actual 512/1024-sample source-column checks stay below 0.000002 display-channel error before image quantization. Independent X/Y/Z ray checks verify quadrature convergence, not physical geometry or slab-spacing quality.
- The browser check captures 42 views and four paired switches, retained leaves, prepared resources and axis banks. No forbidden scene surfaces, browser errors or failed requests occur. Visual inspection still rejects side-view smearing: execution passing is not visual acceptance.
- A different-vendor review completed for the driver and numerical gates with no blocking findings. The larger Grok packet timed out and is not a clearance. Core review fixed invalid prior-mode clamping, unsupported parent links and large-support diagnostics.
- Required repository checks retain the five existing shell asset/fixture failures; the site build retains existing `sun-starfield-back-standard.webp` drift. Lab checks and TypeScript pass.
- Caps: one bounded getsf run and two fixed starlet thresholds for the new crop; two sampler fix/review rounds; at most two final cleanup rounds. This records rejection at the morphology gate, not a reset into another extraction attempt.
