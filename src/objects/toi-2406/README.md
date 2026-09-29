# TOI-2406

## Sources

Its radius and temperature follow Hori et al. 2024. This account was drafted from Hori et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2528453161326406016, parallax 17.985 ± 0.041 mas (55.60 pc). Radius 0.204 +/- 0.004 solar radii from Hori et al. 2024, the stellar radius of the default parameter set of TOI-2406 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Mass 0.166 +/- 0.004 solar masses from Hori et al. 2024, the stellar mass of the default parameter set of TOI-2406 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Temperature 3,100 K from Hori et al. 2024, the stellar temperature of the default parameter set of TOI-2406 b in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Colour.** A Planck spectrum at 3,100 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbb74. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,100 K and log g 5.04 (u1 0.167, u2 0.501): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
