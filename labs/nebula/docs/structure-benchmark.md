# Automatic structure benchmark

Native image decomposition in the Nebula Lab. This stage identifies candidate structures; it does not assign depth or change any production galaxy.

The **Benchmark** selector now includes the original 1024² field, a native 512² Tarantula core and a native 512² Orion bow-shock field. Their isolated 3D controls and results are in [repeatability and coherent depth](coherent-depth.md). Neither automatic mask has passed the morphology gate for production use.

## Inspect or rebuild

From a clean checkout at the repository root, the committed source crop and prepared panels are sufficient. No restricted software is needed for the independent wavelet and median paths.

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:structures
pnpm lab:nebula
```

Open <http://127.0.0.1:4331/?tab=structure>. Select a method and panel; the source and result retain the same pixel extent and display scale. The 3D scene stays mounted while the comparison is open. The default rebuild marks getsf unavailable unless a verified local import is supplied; it never substitutes a different algorithm.

To regenerate the native crop from the pinned original TIFF as well:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:images
pnpm lab:nebula:structures --refresh-source
pnpm lab:nebula
```

The optional official comparator has a separate [getsf workflow](getsf.md). Its software remains local and subject to its author's terms.

## Frozen evidence

| Item | Value |
|---|---|
| Input | NOIRLab SMASH LMC, original 6737×6536 TIFF; original hash and credit in the recipe |
| Crop | Zero-based image origin (1900,700), 1024×1024 native pixels, no resampling |
| Region | Tarantula, neighboring emission, diffuse surroundings and crowded stars |
| Intensity | Rec.709 coefficients applied to 8-bit display sRGB, divided by 255; not calibrated photometry |
| Masks | None authored; source crop only selects the benchmark area |
| Coordinates | All output pixels match the original crop; FITS comparator rows are converted back to image Y-down |
| Recipe | [structure-benchmark.json](../models/structure-benchmark.json) |
| Output | [benchmark manifest](../models/structure-benchmark/benchmark.json), panels, product receipts and compressed region catalogues |

Original source: [NOIRLab](https://noirlab.edu/public/images/noirlab2030a/), CC BY 4.0; CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever, image processing by Travis Rector, Mahdi Zamani and Davide de Martin. The conversion and crop are our modifications. Preserve the source/recipe hashes before comparing candidates.

## Compared methods

| Method | What is actually executed |
|---|---|
| Starlet, threshold 3 | Independent TypeScript B3 undecimated wavelets; connected coefficient regions; covariance-based morphology; actual-support overlap across scales |
| Starlet, threshold 2 | Same source and algorithm, changing only the significance multiplier; a controlled sensitivity comparison |
| Median control | Existing 7×7 RGB median kernel, without sky subtraction or support masking so the separation operates on the same crop |
| getsf | Official external executable when a verified import exists; no local imitation or source-code port |

The starlet implementation is inspired by standard multiscale analysis, not an implementation of DAWIS. Its threshold estimate is a display-texture proxy from the negative wavelet coefficients; dense stars and negative halos inflate it. Compact and elongated are morphological categories, not physical star/gas membership. Connected regions on different scales may describe the same feature; catalogue counts are not counts of independent nebulae.

The independent allocator uses nonnegative evidence while retaining a signed residual. The median and getsf controls retain their own separation semantics; a negative residual exposes over-allocation. Components plus residual must reproduce the source within Float32 tolerance. This verifies bookkeeping only. It does not establish useful segmentation, true color of separated material, or physical depth.

Component previews share unit gain and inherit source hue; positive signal over source black is shown in neutral gray with an explicit count. Residual previews use a fixed ±0.1 display-luminance range: gray is zero, orange positive, blue negative. Clipped preview counts are reported; numerical maps remain Float32. Compressed numerical maps are reproducible in the ignored cache, not browser inputs.

## Initial findings

| Candidate | Compact signal | Filament signal | Absolute residual/source | Scale regions |
|---|---:|---:|---:|---:|
| Starlet, threshold 3 | 0.313% | 0.230% | 14.49% | 1,493 |
| Starlet, threshold 2 | 1.622% | 0.624% | 12.23% | 9,577 |
| Median control | 16.19% | No detector | 10.04% | No catalogue |
| getsf, official defaults | Incomplete | Incomplete | Not evaluated | No final catalogue |

**The initial starlet-only extraction is insufficient for coherent 3D placement.** Lowering the threshold increases candidate signal, but predominantly introduces more stellar texture. Selected extended arcs are detected; most of Tarantula remains in diffuse emission, with substantial unassigned light. The median residual is mostly negative because its background estimate exceeds the source in dark gaps. None of these accounting percentages is a physical flux fraction or an extraction-quality score.

Retain both wavelet candidates. Do not keep lowering thresholds or promote them merely because reconstruction is exact.

**The full-crop getsf comparison hit the experiment's 30-minute runtime bound.** The final uninterrupted run lasted 1,616 seconds and completed 11 source-background iterations. Its last relative correction was 0.0094, above that phase's 0.005 convergence target. Filament separation, detection and final observed component maps were not completed. The stopped subprocess tree was checked; no partial maps are presented as results. The exact configuration, software/input hashes and convergence history are retained in [getsf status](../models/structure-benchmark/getsf/status.json).

This is a runtime impasse for the declared full-crop experiment, not proof that getsf cannot separate these structures. The next practical experiment is a separately frozen 512×512 **native** subcrop, with both methods rerun on exactly that smaller input. Keep the pixel scale and morphology settings explicit; do not downsample or compare its scores directly to the different 1024×1024 field.

## Verification

- 28 lab checks and the lab TypeScript check pass. Source-pin, reconstruction, FITS orientation/escaping, signed-import rejection and black-source preview cases are covered.
- The browser comparison keeps the same source/result extent and retained 3D scene. Deleting scene retention in a temporary browser mutation fails the check.
- Different-vendor review identified FITS string escaping and undefined preview hue; both were fixed and checked locally. Subsequent external recheck attempts were blocked by the review CLI's headless command permissions, so they are not independent clearances.
- Required repository checks still have the five pre-existing shell asset/fixture failures. The site build still fails on the pre-existing `sun-starfield-back-standard.webp` asset drift. No production renderer or planet assets changed in this experiment.

## Next gate

1. Inspect coherent structures in the separated maps against the native source, including what stays in the residual; confirm that useful emission has not simply moved between channels.
2. Select or reject an automatic decomposition before fitting depth. Keep settings and all source bytes fixed for the first depth comparison.
3. Fit finite, connected 3D components using the stellar volume as a weak placement prior. It contains no measured Tarantula gas; do not copy a filament along an entire stellar column.
4. Only after the automatic baseline works, refine selected named regions with registered detail imagery and local prepared resolution.

Prior work: [getsf](https://irfu.cea.fr/Pisp/alexander.menshchikov/), [DAWIS](https://arxiv.org/abs/2101.03835), [MCA/curvelet experiments](https://www.cosmostat.org/statistical-methods/mca/mca-experiments). See the [research plan](research-plan.md) for depth-fitting assumptions, sampling gates and stopping rules.
