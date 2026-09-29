# EPIC 201170410

## Sources

Its radius and temperature follow del Ser & Fors 2020. This account was drafted from del Ser & Fors 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3786541956697681664, parallax 4.722 ± 0.478 mas (211.78 pc); its RUWE is 8.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.282 +/- 0.074 solar radii from del Ser & Fors 2020, the stellar radius of the default parameter set of EPIC 201170410.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.498.2778D/abstract). Mass 0.287 +/- 0.101 solar masses from del Ser & Fors 2020, the stellar mass of the default parameter set of EPIC 201170410.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.498.2778D/abstract). Temperature 3,648 K from del Ser & Fors 2020, the stellar temperature of the default parameter set of EPIC 201170410.02 in the NASA Exoplanet Archive. log g 5 from the mass and radius.

**Colour.** A Planck spectrum at 3,648 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffcb93. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,648 K and log g 5 (u1 0.349, u2 0.399): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
