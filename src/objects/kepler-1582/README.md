# Kepler-1582

## Sources

Its radius and temperature follow Morton et al. 2016. This account was drafted from Morton et al. 2016's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2101449265111030912, parallax 12.802 ± 0.042 mas (78.11 pc). Radius 0.3 +/- 0.023 solar radii from Morton et al. 2016, the stellar radius of the default parameter set of Kepler-1582 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Mass 0.28 +/- 0.03 solar masses from Morton et al. 2016, the stellar mass of the default parameter set of Kepler-1582 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Temperature 3,208 K from Morton et al. 2016, the stellar temperature of the default parameter set of Kepler-1582 b in the NASA Exoplanet Archive. log g 4.93 from the mass and radius.

**Colour.** A Planck spectrum at 3,208 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbe7a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,208 K and log g 4.93 (u1 0.155, u2 0.475): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
