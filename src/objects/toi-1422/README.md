# TOI-1422

## Sources

Its radius and temperature follow MacDougall et al. 2023. This account was drafted from Naponiello et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1920333449169516288, parallax 6.442 ± 0.014 mas (155.24 pc). Radius 1.0235 +/- 0.0183 solar radii from MacDougall et al. 2023, the stellar radius of TOI-1422 b's parameter set from MacDougall et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.9903 +/- 0.0358 solar masses from MacDougall et al. 2023, the stellar mass of TOI-1422 b's parameter set from MacDougall et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,811 K from MacDougall et al. 2023, the stellar temperature of TOI-1422 b's parameter set from MacDougall et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.41 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1920333449169516288, through the CIE 1931 2° observer: #fff4f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,811 K and log g 4.41 (u1 0.452, u2 0.264): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
