# TOI-1410

## Sources

Its radius and temperature follow MacDougall et al. 2023. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1958584565350234752, parallax 13.778 ± 0.013 mas (72.58 pc). Radius 0.7558 +/- 0.024 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1410.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.7941 +/- 0.0209 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1410.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 4,635 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1410.01 in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1958584565350234752, through the CIE 1931 2° observer: #ffceae. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,635 K and log g 4.58 (u1 0.751, u2 0.041): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1410 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
