# TOI-6303

## Sources

Its radius and temperature follow Hotnisky et al. 2025. The introduction is generated from Hotnisky et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 239050153051494272, parallax 6.587 ± 0.019 mas (151.81 pc). Radius 0.609 +/- 0.016 solar radii from Hotnisky et al. 2025, the stellar radius of the default parameter set of TOI-6303 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170....1H/abstract). Mass 0.644 +/- 0.024 solar masses from Hotnisky et al. 2025, the stellar mass of the default parameter set of TOI-6303 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170....1H/abstract). Temperature 3,977 K from Hotnisky et al. 2025, the stellar temperature of the default parameter set of TOI-6303 b in the NASA Exoplanet Archive. log g 4.68 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 239050153051494272, through the CIE 1931 2° observer: #ffbe8a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,977 K and log g 4.68 (u1 0.528, u2 0.232): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
