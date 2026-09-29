# EPIC 206215704

## Sources

Its radius and temperature follow Adams et al. 2021. This account was drafted from Adams et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2615281560211505408, parallax 9.007 ± 0.063 mas (111.03 pc). Radius 0.25 +/- 0.01 solar radii from Adams et al. 2021, the stellar radius of the default parameter set of EPIC 206215704 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021PSJ.....2..152A/abstract). Mass 0.407 +/- 0.095 solar masses from Heller et al. 2019, the stellar mass of EPIC 206215704 b's parameter set from Heller et al. 2019 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...627A..66H/abstract). Temperature 3,297 K from Adams et al. 2021, the stellar temperature of the default parameter set of EPIC 206215704 b in the NASA Exoplanet Archive. log g 5.25 from the mass and radius.

**Colour.** A Planck spectrum at 3,297 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc180. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,297 K and log g 5.25 (u1 0.151, u2 0.467): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
