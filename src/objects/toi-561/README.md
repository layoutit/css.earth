# TOI-561

## Sources

Its radius follows Piotto et al. 2024, and its temperature MacDougall et al. 2023. The introduction is generated from Piotto et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3850421005290172416, parallax 11.834 ± 0.021 mas (84.50 pc). Radius 0.843 +/- 0.005 solar radii from Piotto et al. 2024, the stellar radius of the default parameter set of TOI-561 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract). Mass 0.806 +/- 0.036 solar masses from Piotto et al. 2024, the stellar mass of the default parameter set of TOI-561 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract). Temperature 5,342 K from MacDougall et al. 2023, the stellar temperature of TOI-561 b's parameter set from MacDougall et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3850421005290172416, through the CIE 1931 2° observer: #ffede4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,342 K and log g 4.49 (u1 0.562, u2 0.191): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-561" (revision 1374406462) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
