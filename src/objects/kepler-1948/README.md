# Kepler-1948

## Sources

Its radius and temperature follow Q1-Q17 DR25 KOI Table. This account was drafted from Q1-Q17 DR25 KOI Table's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2131059972237410560, parallax 5.082 ± 0.023 mas (196.78 pc); its RUWE is 2.2, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.557 +/- 0.033 solar radii from Q1-Q17 DR25 KOI Table, the stellar radius of the default parameter set of Kepler-1948 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Mass 0.585 +/- 0.028 solar masses from Q1-Q17 DR25 KOI Table, the stellar mass of the default parameter set of Kepler-1948 b in the NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/docs/Kepler_KOI_docs.html). Temperature 3,872 K from Q1-Q17 DR25 KOI Table, the stellar temperature of the default parameter set of Kepler-1948 b in the NASA Exoplanet Archive. log g 4.71 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2131059972237410560, through the CIE 1931 2° observer: #ffbf8c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,872 K and log g 4.71 (u1 0.462, u2 0.292): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
