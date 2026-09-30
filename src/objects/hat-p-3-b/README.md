# HAT-P-3B

## Sources

HAT-P-3B shares its motion through space with HAT-P-3, 1,321 AU away, so the two are a bound pair. Both are placed where Gaia measures them. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1510191594552968960, parallax 7.283 ± 0.061 mas (137.31 pc). Radius 0.283 +/- 0.01 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 311035839 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.257 +/- 0.021 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 311035839 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 3,300 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 311035839 (VizieR IV/39/tic82). log g 4.94 from the mass and radius.

**Colour.** A Planck spectrum at 3,300 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc180. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,300 K and log g 4.94 (u1 0.155, u2 0.459): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HAT-P-3B's orbit around HAT-P-3 is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
