# WASP-152B

## Sources

WASP-152B shares its motion through space with K2-29, 763 AU away, so the two are a bound pair. Both are placed where Gaia measures them. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 150054788545735296, parallax 5.557 ± 0.023 mas (179.96 pc). Radius 0.683 +/- 0.02 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 56399551 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.651 +/- 0.02 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 56399551 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 3,909 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 56399551 (VizieR IV/39/tic82). log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 150054788545735296, through the CIE 1931 2° observer: #ffb883. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,909 K and log g 4.58 (u1 0.526, u2 0.239): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** WASP-152B's orbit around K2-29 is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
