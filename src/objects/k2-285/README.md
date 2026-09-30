# K2-285

## Sources

Its radius and temperature follow Palle et al. 2019. This account was drafted from Palle et al. 2019's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2657374606238804992, parallax 6.437 ± 0.017 mas (155.36 pc). Radius 0.787 +/- 0.016 solar radii from Palle et al. 2019, the stellar radius of the default parameter set of K2-285 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...623A..41P/abstract). Mass 0.83 +/- 0.023 solar masses from Palle et al. 2019, the stellar mass of the default parameter set of K2-285 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...623A..41P/abstract). Temperature 4,975 K from Palle et al. 2019, the stellar temperature of the default parameter set of K2-285 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** A Planck spectrum at 4,975 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,975 K and log g 4.57 (u1 0.664, u2 0.114): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
