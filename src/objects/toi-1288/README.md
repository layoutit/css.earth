# TOI-1288

## Sources

Its radius and temperature follow MacDougall et al. 2023. This account was drafted from MacDougall et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2245652826430109184, parallax 8.720 ± 0.013 mas (114.68 pc). Radius 0.9583 +/- 0.0166 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1288 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.9552 +/- 0.0319 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1288 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,388 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1288 b in the NASA Exoplanet Archive. log g 4.46 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2245652826430109184, through the CIE 1931 2° observer: #ffe9db. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,388 K and log g 4.46 (u1 0.550, u2 0.200): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1288 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
