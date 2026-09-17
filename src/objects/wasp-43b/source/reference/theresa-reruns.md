# ThERESA reruns of the WASP-43b eclipse map

These runs test the Temperature lens against the method that made it. They reran the authors' public mapping code, ThERESA, on the light curve in the Zenodo deposit. Scratch runs, 2026-09-16; the lens shows the deposited map unchanged. The [README](../../README.md) says what the results mean for the lens.

## What was run

- **Code:** [ThERESA](https://github.com/rychallener/ThERESA) at commit `74a8fec0462f4583e336bbc44e2f2441b263a49f` (MIT), the public version, last changed in its mapping code on 2022-02-03. The 2024 paper used a later, unpublished version that adds light-travel time and, the paper says, the planet's tilt.
- **Environment:** osx-arm64, micromamba, Python 3.8.19, starry 1.1.0, theano 1.0.5, mc3 3.0.9, pymc3 3.9.3, numpy 1.20.3, scipy 1.6.3, arviz 0.9.0, xarray 0.16.0, scikit-learn 0.24.2, numba 0.53.1. One change in the environment: pymc3 3.9.3's `distributions/dist_math.py` assumes `float128` on every Darwin machine, which arm64 numpy lacks; the check was guarded with `hasattr(np, "float128")`, as later pymc3 releases do.
- **Driver:** ThERESA's `map2d` from `theresa.py`, with its TauREx imports replaced by empty modules. TauREx is used only by the 3D stage.
- **Data:** `wasp-43b/time.txt`, `flux-whitelight.txt` and `ferr-whitelight.txt` from the pinned deposit, minus the transit, 60078.910–60078.975 BMJD, which the paper uses only to fit the system parameters (section 3). 4,202 of 4,498 samples remain.
- **Configuration:** 2D stage with `lmax = 3`, `ncurves = 6`, `pca = tsvd`, `posflux = True`, `nsamples = 200000`, `burnin = 5000`, `leastsq = trf`, a 48 × 96 grid; star m 0.6916, r 0.665, t 4520; planet m 0.0019588 (2.052 Jupiter masses), r 0.10562 (0.15883 × 0.665), porb and prot 0.8134741, inc 82.155, ecc 0, Omega 0, w 90, t0 55934.2922503. These are the Challener et al. (2024) Table 1 values.
- **Deviations from the paper:** the filter is a flat 2.87–5.18 μm band and the star a 4,520 K blackbody, so temperatures differ from the deposited ones (peaks of 1,813–1,832 K against 1,976 K); flux maps and hotspot positions do not depend on them. No light-travel time.

## The axis

`utils.initsystem` sets the orbit's inclination (`inc = 82.155`) but not the map's, and starry leaves a map's `inc` at 90°. Measured in starry: the orbit normal is (x, y, z) = (0, 0.9906, 0.1365) with +z toward the observer. A map with `inc = 82.155` has its rotation axis there; with the default 90° the axis lies in the plane of the sky, 7.8° off the orbit normal; with 97.845° it tips the other way. The runs marked "axis corrected" add one line after the `Secondary` is built:

```python
planet.map.inc = cfg.planet.inc
```

## Results

MCMC runs, 200,000 samples, positive emission enforced on the visible planet:

| Run | χ² | BIC | Hotspot latitude, median (16–84 %) | Hotspot longitude | Correlation with the deposited temperature map |
| --- | --- | --- | --- | --- | --- |
| Public code, degree 3, 6 eigencurves | 8,810.4 | 8,877.2 | −12.1° (−14.4 to −10.4) | +7.0° | 0.967 |
| Axis corrected, degree 3, 6 eigencurves | 8,811.1 | 8,877.8 | −4.1° (−5.2 to −3.2) | +6.9° | 0.963 |
| Axis corrected, degree 4, 12 eigencurves | 8,782.0 | 8,898.9 | −16.3° (−18.1 to −14.3) | +7.2° | 0.919 |
| Deposited map | — | — | −13.1° (hottest 3.75° cell) | +5.6° | 1 |

Challener et al. (2024) report +6.9 ± 0.5° longitude and −13.4 +3.2/−1.7° latitude. Every posterior sample of every run is south of the equator.

Least-squares tests with the same eigencurves and light curve:

- **Eigencurve 6.** Adding the sixth eigencurve to five improves χ² by 94.0 with the public axis, where eigenmap 6 is 95 % north–south antisymmetric. With the corrected axis the improvement is 35.4 and the eigenmap is 75 % antisymmetric. The best-fit hotspot latitude is −12.5° and −2.5° respectively.
- **Complete north–south test.** All harmonics against their symmetric part, built in map space. Degree 3, corrected axis: Δχ² 15.4 for 6 parameters (p = 0.29 after scaling by the reduced χ²; BIC prefers symmetric). This agrees with the independent geometry in this package (`tools/objects/eclipse-map/phase-curve.mts`): symmetric χ² 8,808.9 against starry's 8,809.8, full 8,793.5 against 8,794.4. Degree 3, public axis: Δχ² 49.5 (p = 0.001). Degrees 4 and 5, corrected axis: Δχ² 84.7 for 10 parameters and 112.6 for 15 (both p < 0.001), though BIC barely favours the asymmetric model at degree 4 (by 1.2) and favours the symmetric one at degree 5 (by 12.6).
- **Model selection without positivity** (degree ≤ 5, ≤ 12 eigencurves, corrected axis): the lowest BIC is degree 4 with 12 eigencurves, hotspot −13.75°, then degree 2 and 3 with 6 eigencurves, −1.25° and −3.75°. With positivity enforced (the MCMC table above), degree 3 with 6 eigencurves has the lower BIC.

## Reading

The day–night contrast, the eastward shift of about 7° and a southward offset hold in every run. How far south does not: −4° to −16° among fits of nearly equal quality, and the public code's axis alone turns −4° into −12° for the paper's model choice. The deposited −13° lies in that range. Whether the paper's unpublished code has the corrected axis cannot be checked from these files.
