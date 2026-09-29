# EPIC 201238110

## Sources

Its radius follows Kruse et al. 2019, and its temperature the TESS Input Catalog v8.2. This account was drafted from Heller et al. 2019's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3600975145895223040, parallax 6.283 ± 0.030 mas (159.16 pc). Radius 0.374 +/- 0.089 solar radii from Kruse et al. 2019, the stellar radius of EPIC 201238110 b's parameter set from Kruse et al. 2019 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019ApJS..244...11K/abstract). Mass 0.41 +/- 0.112 solar masses from Heller et al. 2019, the stellar mass of the default parameter set of EPIC 201238110 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...627A..66H/abstract). Temperature 3,587 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 35019000 (VizieR IV/39/tic82); no NASA Exoplanet Archive row gives one. log g 4.91 from the mass and radius.

**Colour.** A Planck spectrum at 3,587 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc990. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,587 K and log g 4.91 (u1 0.374, u2 0.386): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
