# TOI-5803

## Sources

Its radius and temperature follow Mistry et al. 2023. The introduction is generated from Mistry et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2700166125618717696, parallax 11.942 ± 0.018 mas (83.74 pc). Radius 0.7625 +/- 0.0451 solar radii from Mistry et al. 2023, the stellar radius of the default parameter set of TOI-5803 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166....9M/abstract). Mass 0.87 +/- 0.1032 solar masses from Mistry et al. 2023, the stellar mass of the default parameter set of TOI-5803 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166....9M/abstract). Temperature 5,134 K from Mistry et al. 2023, the stellar temperature of the default parameter set of TOI-5803 b in the NASA Exoplanet Archive. log g 4.61 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2700166125618717696, through the CIE 1931 2° observer: #ffe4d4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,134 K and log g 4.61 (u1 0.619, u2 0.148): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
