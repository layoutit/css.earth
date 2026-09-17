# Eclipse mapping

A hot Jupiter's map reaches this project as a light curve, not as a picture: the planet's brightness as it turns and as the star hides it. This guide describes how a light curve becomes a map here, which checks a map must pass, and what has been measured. Each planet's README records its own run.

## Method

`tools/objects/eclipse-map/eigenmap-fit.mts` fits maps by eigencurves, the method of Rauscher et al. (2018) as ThERESA implements it (Challener & Rauscher 2022). It shares no code with ThERESA or starry.

1. **Harmonic light curves.** Every real spherical harmonic Y_lm up to degree `lmax` ([spherical-harmonics.mts](../tools/objects/eclipse-map/spherical-harmonics.mts), starry's normalization: Y_00 = 1, mean square 1) is integrated into a light curve by [phase-curve.mts](../tools/objects/eclipse-map/phase-curve.mts). That integrator places the planet with the package's hosted orbit, turns it with its synchronous rotation and hides every cell that passes behind the star. One geometry pass per time serves every harmonic.
2. **Eigencurves.** ThERESA takes the truncated SVD of the curves stacked with their negatives. The same right singular vectors are the eigenvectors of that matrix's Gram matrix, computed here exactly by Jacobi rotations. They order the curves into orthogonal eigencurves, strongest first; each has an eigenmap.
3. **Fit.** The system flux is 1 + s_corr + C0·uniform(t) + Σ c_k·eigencurve_k(t), plus optional systematics columns (instrument baselines, ramps, decorrelation vectors). It is linear, solved by weighted least squares. Every cell that faced the observer is kept at positive intensity by a log-barrier Newton solve, ThERESA's `posflux`.
4. **Choose and sample.** The Bayesian information criterion compares degrees and eigencurve counts. A seeded Metropolis sampler draws the posterior, with positivity as a hard prior. The hot spot is located on the continuous map, not on a grid cell.

**Conventions.** Latitude and longitude are body-fixed: longitude 0 is the substellar meridian, east is the direction of rotation. The map is in planet-to-star flux per unit intensity, so a uniform map of amplitude C0 gives flux C0 when a full hemisphere shows. `brightnessTemperature` inverts it at one effective wavelength (Rauscher et al. 2018, eq. 8).

**Spin axis.** The planet spins about the orbit normal, because the geometry is the package's own orbit. The public ThERESA code leaves the map's inclination at 90°, which tilts the axis off the orbit normal for any orbit that is not edge-on (see [WASP-43b's re-runs](../src/objects/wasp-43b/source/reference/theresa-reruns.md)). That tilt cannot occur here.

## From raw exposures

`tools/objects/jwst/reduce-tso.mts` turns raw JWST time-series exposures into the light curves the fit reads, with [Eureka!](https://github.com/kevin218/Eureka) on the STScI `jwst` pipeline.

- **Toolchain.** `tools/objects/jwst/toolchain.mts install` builds Python 3.11 with micromamba and installs `requirements.lock`, every package at its pinned version or commit, under `output/toolchains/eureka`. One patch is applied: Eureka! 1.4 crashes on a scalar detector gain, which MIRI uses. The CRDS reference context is pinned per program, so reference files match the recorded run.
- **Program.** A directory under `tools/objects/jwst/programs/` pins the raw segments by name and size, the control files, and the deposit to compare with. `wasp-43b-miri-1366` holds the 30 segments (44.2 GB) of the WASP-43b MIRI phase curve, with Bell et al. (2024)'s Eureka! v1 settings carried over to Eureka! 1.4's option names.
- **Run.** Stages 1 and 2 go in batches of five segments, one worker, and a batch does not start with less than half the memory free: a segment's ramp fit peaks near 17 GB. Stage 3 extracts every segment. Stage 4 makes the white light curve, 14 channels and, when a program names them, wider slices with bounds from a file in the program. All of them are exported to CSV, as is the deposit. So is the star's median extracted count spectrum, the band response for a temperature map. `--raw` points at segments already on disk; missing ones download from MAST with resume.
- **Check.** `compare-light-curves.mts` pairs integrations by time and reports correlation, the difference after a straight-line drift, scatter and errors. `reduce-tso.test.mts` holds the run to Bell et al.'s published curves.

Measured on 2026-09-17 from the 30 raw segments, against Bell et al.'s deposited Eureka! v1 light curves:

| Light curve | Paired integrations | Correlation | Difference after the drift | Point-to-point scatter, ours and theirs |
| --- | --- | --- | --- | --- |
| White, 5–10.5 µm | 9,194 | 0.990 | 172 ppm | 342 and 373 ppm |
| Channels 5.0–10.0 µm (10) | 9,194 | 0.927 to 0.994 | 328 to 673 ppm | |
| Channels 10.0–12.0 µm (4) | 9,194 | 0.870 to 0.931 | 846 to 2,430 ppm | |

The two reductions differ by a straight-line drift of 2,221 ppm per day, which a map fit takes up in its baseline terms; the cause is not identified. From 10 µm the channels disagree most; Hammond et al. (2024) excluded the data above 10.5 µm for shadowing. The run took 37 minutes: stages 1 and 2 at 316 to 348 s per five segments with a peak of 16.7 GB, stage 3 in 204 s, stage 4 in 44 s.

## Checks

- [`spherical-harmonics.test.mts`](../tools/objects/eclipse-map/spherical-harmonics.test.mts): the harmonics are orthonormal on the sphere and match their closed forms at degree 1.
- [`eigenmap-fit.test.mts`](../tools/objects/eclipse-map/eigenmap-fit.test.mts):
  - Jacobi eigenvectors diagonalize a random symmetric matrix.
  - A synthetic map with its hot spot 20° east and 15° south, integrated on a finer grid with 30 ppm noise, comes back where it was put when BIC chooses the model. The posterior covers the injected longitude.
  - The temperature inversion returns the star's temperature for a planet as bright per area as the star.
- [`tests/objects/unit/wasp-43b/eigenmap-fit.test.mts`](../tests/objects/unit/wasp-43b/eigenmap-fit.test.mts): on the deposited JWST NIRSpec white-light curve of WASP-43b, the fit must reproduce ThERESA run with the corrected axis.

| Degree 3, 6 eigencurves, positive | This fit | ThERESA, axis corrected |
| --- | --- | --- |
| χ² over 4,202 samples | 8,809.6 (90 × 180 grid), 8,809.7 (180 × 360) | 8,811.1 |
| Best-fit hot spot | −2.31°, +7.09° | −2.5° latitude (least squares) |
| Posterior hot spot, median (16–84 %) | −2.88° (−4.00 to −1.63), +7.25° (6.88 to 7.50) | −4.1° (−5.2 to −3.2), +6.86° (+0.33 −0.27) |
| Runtime | basis 1.3 s, 200,000 posterior steps 4.4 s | hours in PyMC3 and theano |

With positivity dropped, BIC prefers degree 4 with 12 eigencurves and a hot spot near −14°, as the ThERESA re-runs found. With it kept, degrees 2 and 3 with 6 eigencurves are best. The latitude depends on the model; the eastward shift does not.

## Limits

- **Raw reductions are one instrument mode so far.** `reduce-tso.mts` carries settings for MIRI slitless spectroscopy, reproduced on one phase curve. NIRSpec and NIRISS observations need their own control files and their own comparison with a deposit before a map is fitted from them.
- **Systematics are the analyst's model.** Baselines and decorrelation vectors enter as linear columns. A nonlinear ramp's time constant is profiled over a grid, on the simplest candidate model. Different systematics models move the hot spot by more than the statistical uncertainty.
- **Integration grid.** Occultation is decided per cell centre. At 90 × 180 cells, χ² agrees with the 360 × 720 grid to within 0.2.
- **Posterior.** Metropolis with a Gaussian proposal and positivity as a hard prior. It reports the statistical spread under one fixed systematics model, like the published intervals it is compared with.

## Maps as lenses

A planet package can fit its map during preparation instead of shipping a map file. The `eclipse-map-fit` format ([eclipse-map-fit.mts](../tools/objects/terrestrial-layers/eclipse-map-fit.mts)) reads a light curve pinned in the package, calls `fitLightCurveMap` ([light-curve-map.mts](../tools/objects/eclipse-map/light-curve-map.mts)) and paints the temperature map like any scientific lens. The recipe names the light curve, the systematics, the candidate models, the band and the stellar spectrum.

- **Model choice.** Every candidate degree and eigencurve count is fitted. The lowest BIC wins, except that models within 2 of it count as equal, and then the one with fewest parameters, then the lowest degree, is taken. A recipe that lists one model fixes it.
- **Band temperature.** A light curve adds up the star's counts over its band. So the temperature is the one at which the count-weighted planet-to-star intensity, Σ C_i·B(λ_i, T)/I_i ÷ Σ C_i, equals π·value·(1 + s_corr)/rp². C_i can be the star's own extracted counts per detector column, or a filter transmission times wavelength times the stellar intensity. I_i is a model stellar spectrum averaged over each sample's extent. The inversion is tabulated in 0.25 K steps. With one sample and a blackbody star it reduces to `brightnessTemperature`.
- **Checks.** [`light-curve-map.test.mts`](../tools/objects/eclipse-map/light-curve-map.test.mts) tests the reduction to one wavelength, a band with an uneven star and uneven counts, bin averages, and an injected map under a ramp and a drift. [WASP-43b's lens test](../tests/objects/unit/wasp-43b/lens-fits.test.mts) runs its shipped recipes. It compares the MIRI dayside and nightside with Bell et al. (2024): 1,527 K against 1,524 ± 35 K, and 833 K against 863 ± 23 K.
