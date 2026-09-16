# Interferometric imaging

A star's surface reaches this project as interferometric data, not as a picture. This guide describes how that data becomes a lens, which checks decide whether it may, and what has been measured. Each star's README records its own run.

## Stages

1. **Calibrate.** Most public data are raw exposures. `tools/objects/interferometry/calibrate-pionier.mts` plans a VLTI/PIONIER night from the ESO archive's raw table and reduces it with ESO's pipeline. An author's calibrated file, when one is public, can be used instead.
2. **Select.** `oifits-select.mts` flags channels outside chosen wavelength windows, flags data outside an MJD range, and applies a published wavelength-scale correction. The measurements themselves are never changed.
3. **Reconstruct.** SQUEEZE builds a flat sky-plane image. `surface-reconstruction.mts` runs ROTIR, which fits brightness directly on a sphere of known size and limb darkening.
4. **Check.** `spotless-disc.mts` simulates a spotless limb-darkened disc on the same sampling and errors, reconstructs it with the same recipe, and compares the two. A reconstruction may be cast only if it fits its own data to a reduced chi-squared of 3 and its spots are at least twice as strong as the spotless disc's.
5. **Cast.** A flat image goes onto the sphere through the `surface-observation` route with a computed camera, as for Betelgeuse and π¹ Gruis. No sphere reconstruction has passed the checks yet, so casting one onto a lens is not built. When one passes, it needs its own end-to-end check of the longitude convention.

## Toolchains

`tools/objects/interferometry/toolchains.json` pins every external code: SQUEEZE by commit, ROTIR by commit through a Julia 1.12.7 environment (`rotir/Project.toml` and `rotir/Manifest.toml`), and the ESO PIONIER pipeline 4.0.4 with Yorick from ESO's source package. Install one with:

```bash
node tools/objects/interferometry/toolchain.mts install rotir
```

Toolchains install under `output/toolchains/`, which git ignores. Downloads are checked against their sha256 and deleted once built. ROTIR needs about 1.8 GB installed and about 1.6 GB of memory per run.

## Measured results

The two checks, measured with the pinned recipes on 2026-09-16:

| Reconstruction | Reduced chi-squared, V² and closure phase | Spot ratio against the spotless disc | Verdict |
| --- | --- | --- | --- |
| π¹ Gruis, SQUEEZE, both nights | 2.45 and 1.06 | 5.22 | cast (shipped) |
| Betelgeuse, SQUEEZE | 0.35 and 1.12 | 2.90 | cast (shipped) |
| Polaris, SQUEEZE, April 2021 | 1.76 and 2.28 | 1.05 | not cast |
| Polaris, ROTIR sphere, April 2021 | 1.45 and 5.58 | 2.32 | not cast: does not fit |
| R Dor, SQUEEZE, AMBER continuum | 1.74 and 2.99 | 1.43 | not cast |

Calibration from raw frames was checked against an author's file. One π¹ Gruis block from 25 September 2014, with its two calibrator blocks, reproduces the squared visibilities of Paladini et al. (2018) in all 18 channel points. The median ratio is 0.990, the range 0.954 to 0.999, and the largest difference 0.84 sigma. `calibrate-pionier.test.mts` repeats that comparison whenever the reduction output is present.

## Known limits

**Single nights are not enough.** π¹ Gruis's first night alone fails the spotless check (ratio 1.01) and its second passes (4.05). Each Polaris night alone correlates 0.85 to 0.93 with its spotless twin. Reconstructions from separate nights therefore cannot be required to agree, and no such check is used.

**A sphere cannot hold light beyond the limb.** π¹ Gruis has 12.8 percent of its flux outside the disc. ROTIR fits it at reduced chi-squared 17.5 on squared visibilities where SQUEEZE reaches 2.45. The sphere backend suits compact photospheres.

**No sphere explains Polaris.** ROTIR's spots on Polaris are far stronger than on the spotless disc (7.1 percent surface contrast against 0.19), yet no fixed surface brings the closure phases below 5.58. The star is asymmetric in a way a static sphere over three nights does not describe. It could be changing or a calibration difference between nights; that has not been tested.

**Differential phases do not help a continuum surface.** Across a continuum window, a grey star's Fourier phase is linear in wavenumber on each baseline, and a differential phase has already removed that term. `oifits-observables.test.mts` proves the statistic is unchanged by shifting a grey image. Differential phases matter in spectral lines, not for a surface lens. SQUEEZE 3.0 at the pinned commit also fails to read AMBER's differential visibilities ("OOOOPS BUG when reading differential vis!").

**Our wavelengths differ from the author's.** The spectral calibration gives 1.6376, 1.6857 and 1.7374 µm where Paladini's file states 1.6238, 1.6764 and 1.7287 µm, 0.5 to 0.9 percent longer. Calibrating from a whole block gives the same values. A reconstruction's angular scale from these files carries that uncertainty until the author's wavelength table is understood.

**Only PIONIER is calibrated from raw.** `toolchain.mts install pionier` builds Yorick and ESO's kit in 8 minutes (295 MB), and the comparison above ran on that install; the frames of the oracle came from the ESO data portal and the plan from its archive query, both checked live. GRAVITY, MATISSE and AMBER reductions are not built.

**Only public frames.** Raw frames still in their proprietary period answer 401 and are refused.
