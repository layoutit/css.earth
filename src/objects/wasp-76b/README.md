# WASP-76b

## Sources

WASP-76b is an ultra-hot giant planet that orbits the F star [WASP-76](../wasp-76/README.md) every 43.4 hours. ESPRESSO spectra of two transits show iron vapour on its evening edge and none on its morning edge: iron condenses somewhere on the night side (Ehrenreich et al. 2020, [Nature 580, 597](https://doi.org/10.1038/s41586-020-2107-1)). That is a measurement at the planet's edges, not a map, so it is told in the text. The one lens is a brightness-temperature map from a published phase-curve fit.

**The map.** May et al. (2021, [AJ 162, 158](https://doi.org/10.3847/1538-3881/ac0e30); [arXiv:2107.03349](https://arxiv.org/abs/2107.03349)) observed a full orbit with Spitzer at 4.5 µm in April 2017 (program 13038). They fitted the planet with SPIDERMAN (Louden & Kreidberg 2018), a code that models a planet's brightness with spherical harmonics. Their best 4.5 µm model is a dipole centred on the substellar point: two coefficients, Y₀⁰ = 0.00063 and Y₁¹ = 0.00039, and a 0.67° offset (Table 4). The table is transcribed in [phase-curve.json](source/science/may-2021/phase-curve.json). The [`published-phase-curve-map`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.mts) format hands those numbers to SPIDERMAN 1.0.3 itself, pinned in its own environment ([spiderman.mts](../../../tools/objects/astronomy-packages/spiderman.mts)). SPIDERMAN evaluates the map on a 1° grid and integrates its light curve. The palette runs from 600 to 3,000 K in false colour.

| Quantity | This map | May et al. (2021) |
| --- | --- | --- |
| Day side, flux | 3,704 ppm | 3,729 ± 52 ppm |
| Day side | 2,688 K | 2,699 ± 32 K |
| Night side | 1,185 K | 1,259 ± 44 K |
| Half amplitude | 1,546 ppm (1,418 before the dilution correction) | 1,464 ± 38 ppm |
| Peak before eclipse | 0.0° | 0.67 ± 0.2° |
| Surface with negative fitted brightness | 3.4 % | — |

**Temperature.** WASP-76 has a fainter companion 0.44″ away inside Spitzer's pixel. The paper corrects for its light with a dilution factor of 0.0901 at 4.5 µm. The planet's intensity relative to the star's is π·value·(1 + 0.0901)/rp² with SPIDERMAN's map value and rp = 0.106. It becomes a brightness temperature at 4.5 µm against the star's 4.5 µm brightness temperature. The paper used an interpolated Kurucz model and prints no number. The value its own eclipse depth, radius ratio and day side imply is 5,695 K. Weighting by Spitzer's 4.5 µm filter curve instead of one wavelength moves the night side by 5 K.

**Orbit and rotation.** Ehrenreich et al. (2020, Extended Data Table 1) give the period, 1.80988198 days, a/R* 4.08, the 89.623° inclination and the transit time. That is 58080.626165 in BJD − 2,400,000, which lands 122 orbits after May et al.'s Spitzer transit to within 76 s. The radius ratio is 0.10852, which is 1.854 Jupiter radii; the mass is 0.894 Jupiter masses. The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked. The planet is drawn emissive.

**Catalogue colour.** #f4c731, the lens palette at the paper's 2,699 K day side, the rule WASP-43b's colour follows.

## Evidence

Run of 2026-09-23 (this version):

- [`published-phase-curve-map.test.mts`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.test.mts) evaluates the recipe through SPIDERMAN 1.0.3. The day side agrees with the paper within its uncertainty, in flux and in temperature. The night side lies within two standard deviations below the paper's. The curve has no peak offset, the map is the same east and west of noon, and the negative patch at midnight is left without a temperature.
- The lo0 reading. May et al.'s Table 4 labels lo0 in degrees; SPIDERMAN takes radians. Read as 0.67 radians, the map's corrected day side is 3,423 ppm and its half amplitude 1,266 ppm, far from the paper. Read as 0.67°, they are 3,704 and 1,546 ppm. The degree reading is used.
- [`exoplanet-radius.test.mts`](../../../tests/objects/unit/exoplanet-radius.test.mts) and [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) check the radius and the system.
- [`hot-jupiter-default-views.png`](../kelt-9b/evidence/hot-jupiter-default-views.png): the default views of KELT-9, KELT-9b, WASP-76 and WASP-76b on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready. Both planets open on their substellar point; KELT-9b's hot spot shows east of centre.

## Known problems

- **The fitted offset moves the map north–south, not east–west.** In spiderman-package 1.0.3 the Python layer packs the parameters as [degree, la0, lo0], and the C model adds the la0 slot to longitude and the lo0 slot to latitude. The 0.67° the paper reports as a longitude offset therefore tilts the dipole 0.67° toward the south pole, and the curve's peak stays at eclipse. The map is drawn as SPIDERMAN evaluates it. At 0.67° this is under two pixels either way.
- **The night side is 1.7 standard deviations colder than the paper's.** The table prints the coefficients to two significant figures, up to 1.3 % off, which moves the night side by up to about 20 K. That explains part of the 74 K gap. The paper's value may also come from its posterior rather than its best fit; the paper does not say.
- **A dipole is the simplest map.** Only the day–night contrast is measured. Near midnight the fitted dipole falls below zero, which no temperature can match; that patch, 3.4 % of the surface, shows no data.
- **Brightness temperature, not temperature.** Each value is the temperature of a blackbody with the observed 4.5 µm brightness, against a star temperature the paper's own numbers imply.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The orbit's position angle on the sky is set at 0 as a display convention. The planet is a sphere.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
