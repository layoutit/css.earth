# TOI-1898

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HD 83342, HIP 47288. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 644224345413418880, parallax 12.479 ± 0.027 mas (80.13 pc). Radius 1.6131 +/- 0.0292 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1898 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 1.2484 +/- 0.0261 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1898 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 6,241 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1898 b in the NASA Exoplanet Archive. log g 4.12 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 644224345413418880, through the CIE 1931 2° observer: #f0eeff. Routes tried in order: stis-ngsl: HD 83342 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,241 K and log g 4.12 (u1 0.377, u2 0.304): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
