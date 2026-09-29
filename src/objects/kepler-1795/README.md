# Kepler-1795

## Sources

Its radius and temperature follow Q1-Q17 DR25 KOI Table. This account was drafted from Q1-Q17 DR25 KOI Table's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2100442009379544320, parallax 2.280 ± 0.400 mas (438.52 pc); its RUWE is 16.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.688 +/- 0.048 solar radii from Q1-Q17 DR25 KOI Table, the stellar radius of the default parameter set of Kepler-1795 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Mass 0.768 +/- 0.024 solar masses from Q1-Q17 DR25 KOI Table, the stellar mass of the default parameter set of Kepler-1795 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Temperature 4,500 K from Q1-Q17 DR25 KOI Table, the stellar temperature of the default parameter set of Kepler-1795 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** A Planck spectrum at 4,500 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,500 K and log g 4.65 (u1 0.774, u2 0.021): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
