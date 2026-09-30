# TOI-5205

## Sources

Its radius and temperature follow Kanodia et al. 2023. This account was drafted from Kanodia et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1842656663520849024, parallax 11.464 ± 0.026 mas (87.23 pc). Radius 0.394 +/- 0.011 solar radii from Kanodia et al. 2023, the stellar radius of the default parameter set of TOI-5205 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..120K/abstract). Mass 0.392 +/- 0.015 solar masses from Kanodia et al. 2023, the stellar mass of the default parameter set of TOI-5205 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..120K/abstract). Temperature 3,430 K from Kanodia et al. 2023, the stellar temperature of the default parameter set of TOI-5205 b in the NASA Exoplanet Archive. log g 4.84 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1842656663520849024, through the CIE 1931 2° observer: #ffca84. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,430 K and log g 4.84 (u1 0.166, u2 0.438): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
