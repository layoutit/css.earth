# TOI-480

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HD 39688, HIP 27849. This account was drafted from MacDougall et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2992025233741516928, parallax 18.423 ± 0.019 mas (54.28 pc). Radius 1.4877 +/- 0.0443 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-480 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 1.2793 +/- 0.0282 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-480 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 6,174 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-480 b in the NASA Exoplanet Archive. log g 4.2 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2992025233741516928, through the CIE 1931 2° observer: #f8f4ff. Routes tried in order: stis-ngsl: HD 39688 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,174 K and log g 4.2 (u1 0.387, u2 0.300): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
