# K2-212

## Sources

Its radius and temperature follow Duck et al. 2021. This account was drafted from Duck et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2538824923230146560, parallax 9.306 ± 0.016 mas (107.45 pc). Radius 0.678 +/- 0.052 solar radii from Duck et al. 2021, the stellar radius of the default parameter set of K2-212 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..136D/abstract). Mass 0.622 +/- 0.02 solar masses from Duck et al. 2021, the stellar mass of the default parameter set of K2-212 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..136D/abstract). Temperature 4,349 K from Duck et al. 2021, the stellar temperature of the default parameter set of K2-212 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2538824923230146560, through the CIE 1931 2° observer: #ffc298. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,349 K and log g 4.57 (u1 0.767, u2 0.027): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
