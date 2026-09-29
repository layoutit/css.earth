# Kepler-1939

## Sources

Its radius and temperature follow Q1-Q17 DR25 KOI Table. This account was drafted from Q1-Q17 DR25 KOI Table's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2103800158408255872, parallax 5.302 ± 0.015 mas (188.62 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.603 +/- 0.06 solar radii from Q1-Q17 DR25 KOI Table, the stellar radius of the default parameter set of Kepler-1939 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Mass 0.648 +/- 0.056 solar masses from Q1-Q17 DR25 KOI Table, the stellar mass of the default parameter set of Kepler-1939 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Temperature 4,353 K from Q1-Q17 DR25 KOI Table, the stellar temperature of the default parameter set of Kepler-1939 b in the NASA Exoplanet Archive. log g 4.69 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2103800158408255872, through the CIE 1931 2° observer: #ffc69f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,353 K and log g 4.69 (u1 0.737, u2 0.051): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
