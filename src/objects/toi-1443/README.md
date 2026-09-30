# TOI-1443

## Sources

Its radius and temperature follow MacDougall et al. 2023. This account was drafted from MacDougall et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2289567870599358080, parallax 11.657 ± 0.013 mas (85.78 pc). Radius 0.7511 +/- 0.0346 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1443 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.7663 +/- 0.0234 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1443 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,224 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1443 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2289567870599358080, through the CIE 1931 2° observer: #ffe9de. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,224 K and log g 4.57 (u1 0.594, u2 0.168): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
