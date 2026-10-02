# TOI-1451

## Sources

Its radius and temperature follow MacDougall et al. 2023. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1581799694493008384, parallax 11.008 ± 0.011 mas (90.84 pc). Radius 1.0162 +/- 0.0181 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1451 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 1.0022 +/- 0.0364 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1451 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,801 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1451 b in the NASA Exoplanet Archive. log g 4.43 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1581799694493008384, through the CIE 1931 2° observer: #fff4f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,801 K and log g 4.43 (u1 0.454, u2 0.263): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
