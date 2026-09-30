# TOI-4559

## Sources

Its radius and temperature follow Mistry et al. 2024. This account was drafted from Mistry et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6173120554255287808, parallax 31.639 ± 0.023 mas (31.61 pc). Radius 0.374 +/- 0.017 solar radii from Mistry et al. 2024, the stellar radius of the default parameter set of TOI-4559 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024PASA...41...30M/abstract). Mass 0.392 +/- 0.027 solar masses from Mistry et al. 2024, the stellar mass of the default parameter set of TOI-4559 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024PASA...41...30M/abstract). Temperature 3,558 K from Mistry et al. 2024, the stellar temperature of the default parameter set of TOI-4559 b in the NASA Exoplanet Archive. log g 4.89 from the mass and radius.

**Colour.** A Planck spectrum at 3,558 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc88e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,558 K and log g 4.89 (u1 0.380, u2 0.383): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
