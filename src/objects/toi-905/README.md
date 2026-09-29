# TOI-905

## Sources

Its radius and temperature follow Davis et al. 2020. This account was drafted from Davis et al. 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5795534040654879744, parallax 6.363 ± 0.013 mas (157.17 pc). Radius 0.918 +/- 0.038 solar radii from Davis et al. 2020, the stellar radius of the default parameter set of TOI-905 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract). Mass 0.968 +/- 0.061 solar masses from Davis et al. 2020, the stellar mass of the default parameter set of TOI-905 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..229D/abstract). Temperature 5,570 K from Davis et al. 2020, the stellar temperature of the default parameter set of TOI-905 b in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5795534040654879744, through the CIE 1931 2° observer: #ffe9db. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,570 K and log g 4.5 (u1 0.506, u2 0.230): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
