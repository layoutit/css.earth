# K2-158

## Sources

Its radius and temperature follow Livingston et al. 2018. This account was drafted from Livingston et al. 2018's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3596003497911958528, parallax 5.097 ± 0.032 mas (196.19 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.95 +/- 0.02 solar radii from Livingston et al. 2018, the stellar radius of the default parameter set of K2-158 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Mass 0.92 +/- 0.03 solar masses from Livingston et al. 2018, the stellar mass of the default parameter set of K2-158 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Temperature 5,503 K from Livingston et al. 2018, the stellar temperature of the default parameter set of K2-158 c in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Colour.** A Planck spectrum at 5,503 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffede1. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,503 K and log g 4.45 (u1 0.520, u2 0.221): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
