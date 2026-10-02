# K2-32B

## Sources

K2-32B shares its motion through space with K2-32, 2,316 AU away, so the two are a bound pair. Both are placed where Gaia measures them. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4130538428745313920, parallax 6.354 ± 0.132 mas (157.38 pc). Radius 0.234 +/- 0.011 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 437444675 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.204 +/- 0.022 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 437444675 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 3,190 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 437444675 (VizieR IV/39/tic82). log g 5.01 from the mass and radius.

**Color.** A Planck spectrum at 3,190 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbe79. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,190 K and log g 5.01 (u1 0.154, u2 0.480): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** K2-32B's orbit around K2-32 is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
