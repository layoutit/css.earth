# TOI-5108

## Sources

Its radius and temperature follow Thomas et al. 2025. It is also HIP 54186. This account was drafted from Thomas et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3868491612036282752, parallax 7.635 ± 0.029 mas (130.97 pc). Radius 1.29 +/- 0.04 solar radii from Thomas et al. 2025, the stellar radius of the default parameter set of TOI-5108 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A.143T/abstract). Mass 1.1 +/- 0.03 solar masses from Thomas et al. 2025, the stellar mass of the default parameter set of TOI-5108 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A.143T/abstract). Temperature 5,808 K from Thomas et al. 2025, the stellar temperature of the default parameter set of TOI-5108 b in the NASA Exoplanet Archive. log g 4.26 from the mass and radius.

**Colour.** A Planck spectrum at 5,808 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #fff1eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,808 K and log g 4.26 (u1 0.450, u2 0.265): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
