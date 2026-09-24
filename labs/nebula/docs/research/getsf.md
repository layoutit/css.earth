# getsf decomposition benchmark

> Research record. This describes the recorded experiment, not the current app. Retired tabs and Orion models are no longer available. Use the [current workflow](../workflows.md) for processing and [current reconstruction](../reconstruction.md) for the active method.

This lab runs **Alexander Men’shchikov’s actual getsf260706**, acquired directly from the [author’s site](https://irfu.cea.fr/Pisp/alexander.menshchikov/). The adapter transports images and records results; it does not reproduce or approximate the algorithm.

## Research-only software

Read the [author’s user agreement, guide section8](https://irfu.cea.fr/Pisp/alexander.menshchikov/getsf.guide.pdf) before installing. It permits research, education, non-profit and non-military use. Commercial use requires the author’s written permission. This is not an MIT-licensed dependency. Software, source archives and binaries stay under ignored `.local/`; the repository contains only its independent adapter and benchmark products. The author requests registration for update notices; no contact or registration was made automatically.

Cite Men’shchikov (2021), *Multiscale, multiwavelength extraction of sources and filaments: getsf*, A&A649,A89 ([author’s paper](https://irfu.cea.fr/Pisp/alexander.menshchikov/aa39913-20-Men%27shchikov2021.pdf), [publisher](https://www.aanda.org/articles/aa/full_html/2021/05/aa39913-20/aa39913-20.html)). The benchmark result is our interpretation, not endorsement by the author or their institution.

## Reproduce locally on macOS

From a clean checkout, with Homebrew and command-line build tools available:

```sh
pnpm install
brew install gcc
node --experimental-strip-types labs/nebula/src/run.ts getsf-install .local/nebula-lab/getsf
pnpm lab:nebula:getsf .local/nebula-lab/getsf/bin/getsf .local/nebula-lab/getsf/benchmark
pnpm lab:nebula:structures --getsf-import=.local/nebula-lab/getsf/import.json
pnpm lab:nebula
```

The install command downloads verified original archives, builds static CFITSIO with `--disable-curl --enable-static --disable-shared`, then runs the unmodified author installer with `gfortran`. It preserves the software notices. The benchmark command has a30minute runtime bound; interrupted or incomplete results are never imported as complete. Restarting is an explicit fresh invocation. Keep the same recipe for an existing work directory; use a different directory for another parameter variant.

The tested environment was macOS arm64, GNU Fortran16.2.0 and CFITSIO4.7.0. The optional no-argument `modfits` help banner contains a legacy Fortran format rejected by gfortran16; the configured noninteractive verbosity0 path works. Installation verification performs a real FITS operation and checks exact output pixels. No SWarp is invoked because the supplied single image already occupies the comparison grid. Optional WCSTools is absent, so detection catalogs contain pixel coordinates, not independent sky-coordinate measurements. Optional log coloring is also absent. The local `install-receipt.json` records compiler, platform, archive and binary hashes; `installation.log` records the commands.

| Original input | SHA256 |
| --- | --- |
| [getsf260706 ZIP](https://irfu.cea.fr/Pisp/alexander.menshchikov/getsf.v260706.zip) | `70725784d898a2d49c11ebc37cdaa94c07a6cad830215c6fdfdb32b23255c99b` |
| [CFITSIO4.7.0 source](https://heasarc.gsfc.nasa.gov/FTP/software/fitsio/c/cfitsio-4.7.0.tar.gz) | `ce573bbea8e75b429f8c3d3e86498741ba3dc9628a1530d2f65268397ad059e8` |

## Frozen comparison input

- The same1024×1024 native SMASH crop feeds wavelets and getsf. Its checked PNG hash and full TIFF/crop provenance are in `models/lmc/research/structure-benchmark.json`.
- Intensity is `Float32((0.2126R +0.7152G +0.0722B)/255)` of the8bit sRGB display channels. It is neither linear-light radiance nor calibrated flux. There is no resampling, extra smoothing, normalization, or source mask before getsf.
- FITS uses the original angular pixel scale4.996248331536arcsec. Crop-adjusted AVM cards keep the original TAN frame; rows reverse once into FITS and once back into DOM order. The image is not reprojected.
- getsf only accepts `MJy/sr` or `H2/cm^2`. Its ordinary-photo convention is followed: `MJy/sr` is a compatibility placeholder, explicitly labeled uncalibrated in the FITS and receipt. The synthetic wavelength identifier001 and unused distance100pc are also placeholders. They must never be reused as scientific metadata.

## Parameter and output meaning

The initial morphology choices are beam2pixels, maximum compact footprint radius8pixels and maximum filament footprint radius32pixels. These are display-structure choices, not a measured telescope PSF or physical diameter. The software warns that a2pixel beam is coarsely sampled; native sampling is retained to keep the benchmark input identical. Thresholds and50iteration limits use the author defaults. Separation, flattening, combination and detection are enabled. Physical flux/mass measurement and the optional visualization stage are disabled.

Observed-intensity outputs are imported, **not** flattened detection images:

```text
image − compact background   → compact component
compact background − diffuse → filament component
diffuse                      → diffuse component
```

Raw official FITS files and DOM-order float32 maps remain in the local work directory. The collector pins every imported map and selected detection/skeleton catalogs. A successful result requires the author's completion record plus actual valid component files; exit0 by itself is insufficient.

The default signed-value policy is **reject**. If official components contain negative pixels, the collector records their count, minimum and summed signal, then refuses a positive-emission import. An explicit `positive-parts-with-signed-residual` policy may be used only for a documented display comparison: preserve raw signed maps, use positive parts for the three display components, and carry the removed negative contribution in the signed reconstruction residual. This is a display adapter, not an alteration of getsf's raw scientific output.

Compact peaks can be foreground stars, LMC stars, blends or bright nebular knots. Filament candidates are geometric structures in a display composite; these detections do not establish gas identity, LMC membership or3D depth. Fine stellar crowding and RGB tone mapping violate a calibrated single-band interpretation. Inspect the diffuse map for leftover filaments before interpreting a separation as useful.

## Verification scope

`node --experimental-strip-types labs/nebula/run.mts test getsf` and the FITS transport tests of `@cssearth/fits` (`pnpm --filter @cssearth/fits test`) verify exact luminance/orientation, required FITS/configuration fields, rejection of incomplete runs, and explicit preservation of signed raw maps. Actual external run status and numerical results are recorded with the benchmark, separately from these synthetic adapter tests.

## Recorded full-crop result

The first 1024×1024 experiment stopped at its 30-minute cumulative runtime bound. The uninterrupted final run took 1,616 seconds, completing 11 source-background iterations; its final relative correction was 0.0094 against that phase's 0.005 target. Final component maps and detection catalogues were not produced. See the [pinned status and convergence record](https://github.com/layoutit/cssEarth/blob/59ae463d366e09b1cd6d09fffe251ef15442b1ce/labs/nebula/models/lmc/research/structure-benchmark/getsf/status.json). This incomplete attempt appears as unavailable in the comparison UI, with its actual reason and measurements.

The independent adapter and compiler installation are verified. The scientific comparison remains incomplete; a smaller native subcrop is the recommended next experiment. Rerun both methods on the same new crop rather than comparing different fields.
