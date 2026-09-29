# TOI-206

## Sources

Its radius and temperature follow Giacalone et al. 2022. This account was drafted from Giacalone et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4665277593852295424, parallax 20.928 ± 0.013 mas (47.78 pc). Radius 0.35 +/- 0.01 solar radii from Giacalone et al. 2022, the stellar radius of the default parameter set of TOI-206 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Mass 0.35 +/- 0.01 solar masses from Giacalone et al. 2022, the stellar mass of the default parameter set of TOI-206 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Temperature 3,383 K from Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-206 b in the NASA Exoplanet Archive. log g 4.89 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4665277593852295424, through the CIE 1931 2° observer: #ffc783. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,383 K and log g 4.89 (u1 0.161, u2 0.446): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
