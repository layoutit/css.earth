# TOI-784

## Sources

Its radius and temperature follow Hua et al. 2023. It is also HD 307842. The introduction is generated from Hua et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5251941573573934080, parallax 15.483 ± 0.011 mas (64.59 pc). Radius 0.907 +/- 0.017 solar radii from Hua et al. 2023, the stellar radius of the default parameter set of TOI-784 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...32H/abstract). Mass 0.91 +/- 0.1 solar masses from Hua et al. 2023, the stellar mass of the default parameter set of TOI-784 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...32H/abstract). Temperature 5,558 K from Hua et al. 2023, the stellar temperature of the default parameter set of TOI-784 b in the NASA Exoplanet Archive. log g 4.48 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5251941573573934080, through the CIE 1931 2° observer: #ffeee6. Routes tried in order: stis-ngsl: HD 307842 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,558 K and log g 4.48 (u1 0.508, u2 0.229): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
