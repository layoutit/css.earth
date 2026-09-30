# TOI-1839

## Sources

Its radius and temperature follow Castro-González et al. 2026. The introduction is generated from Castro-González et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3729117900352224768, parallax 8.542 ± 0.018 mas (117.07 pc). Radius 0.89 +/- 0.03 solar radii from Castro-González et al. 2026, the stellar radius of the default parameter set of TOI-1839 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260905413C/abstract). Mass 0.86 +/- 0.01 solar masses from Castro-González et al. 2026, the stellar mass of the default parameter set of TOI-1839 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260905413C/abstract). Temperature 5,347 K from Castro-González et al. 2026, the stellar temperature of the default parameter set of TOI-1839 b in the NASA Exoplanet Archive. log g 4.47 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3729117900352224768, through the CIE 1931 2° observer: #ffe9da. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,347 K and log g 4.47 (u1 0.560, u2 0.192): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
