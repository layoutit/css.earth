# K2-95

## Sources

Its radius and temperature follow Castro-González et al. 2022. This account was drafted from Castro-González et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 659744295638254336, parallax 5.552 ± 0.063 mas (180.11 pc). Radius 0.4 +/- 0.01 solar radii from Castro-González et al. 2022, the stellar radius of the default parameter set of K2-95 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.509.1075C/abstract). Mass 0.41 +/- 0.01 solar masses from Castro-González et al. 2022, the stellar mass of the default parameter set of K2-95 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.509.1075C/abstract). Temperature 3,566 K from Castro-González et al. 2022, the stellar temperature of the default parameter set of K2-95 b in the NASA Exoplanet Archive. log g 4.85 from the mass and radius.

**Colour.** A Planck spectrum at 3,566 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc98f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,566 K and log g 4.85 (u1 0.386, u2 0.378): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
