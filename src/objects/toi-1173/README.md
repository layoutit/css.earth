# TOI-1173

## Sources

Its radius and temperature follow Galarza et al. 2024. The introduction is generated from Yee & Vissapragada 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1686171213716517504, parallax 7.566 ± 0.012 mas (132.16 pc). Radius 0.934 +/- 0.011 solar radii from Galarza et al. 2024, the stellar radius of TOI-1173 b's parameter set from Galarza et al. 2024 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168...91G/abstract). Mass 0.911 +/- 0.028 solar masses from Galarza et al. 2024, the stellar mass of TOI-1173 b's parameter set from Galarza et al. 2024 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168...91G/abstract). Temperature 5,350 K from Galarza et al. 2024, the stellar temperature of TOI-1173 b's parameter set from Galarza et al. 2024 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.46 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1686171213716517504, through the CIE 1931 2° observer: #ffe9db. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,350 K and log g 4.46 (u1 0.560, u2 0.193): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
