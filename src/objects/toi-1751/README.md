# TOI-1751

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HD 146757. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1629404184289170688, parallax 8.809 ± 0.009 mas (113.52 pc). Radius 1.3137 +/- 0.0251 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1751 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.9382 +/- 0.0363 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1751 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,970 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1751 b in the NASA Exoplanet Archive. log g 4.17 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1629404184289170688, through the CIE 1931 2° observer: #fbf6ff. Routes tried in order: stis-ngsl: HD 146757 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,970 K and log g 4.17 (u1 0.418, u2 0.284): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
