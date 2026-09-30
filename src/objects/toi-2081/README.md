# TOI-2081

## Sources

Its radius and temperature follow Esparza-Borges et al. 2022. The introduction is generated from Esparza-Borges et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1416730563570869376, parallax 16.050 ± 0.012 mas (62.31 pc). Radius 0.534 +/- 0.08 solar radii from Esparza-Borges et al. 2022, the stellar radius of the default parameter set of TOI-2081 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...666A..10E/abstract). Mass 0.54 +/- 0.08 solar masses from Esparza-Borges et al. 2022, the stellar mass of the default parameter set of TOI-2081 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...666A..10E/abstract). Temperature 3,800 K from Esparza-Borges et al. 2022, the stellar temperature of the default parameter set of TOI-2081 b in the NASA Exoplanet Archive. log g 4.72 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1416730563570869376, through the CIE 1931 2° observer: #ffbe85. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,800 K and log g 4.72 (u1 0.423, u2 0.329): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
