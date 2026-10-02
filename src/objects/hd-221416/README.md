# HD 221416

## Sources

Its radius and temperature follow Huber et al. 2019. It is also HIP 116158. The introduction is generated from Huber et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2388463203438164096, parallax 10.479 ± 0.032 mas (95.43 pc). Radius 2.943 +/- 0.064 solar radii from Huber et al. 2019, the stellar radius of the default parameter set of HD 221416 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..245H/abstract). Mass 1.212 +/- 0.074 solar masses from Huber et al. 2019, the stellar mass of the default parameter set of HD 221416 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..245H/abstract). Temperature 5,080 K from Huber et al. 2019, the stellar temperature of the default parameter set of HD 221416 b in the NASA Exoplanet Archive. log g 3.58 from the mass and radius.

**Color.** A Planck spectrum at 5,080 K, because no archive holds a spectrum of this star (stis-ngsl: HD 221416 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: HD 221416 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,080 K and log g 3.58 (u1 0.619, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
