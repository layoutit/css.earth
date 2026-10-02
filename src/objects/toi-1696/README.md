# TOI-1696

## Sources

Its radius and temperature follow Mori et al. 2022. The introduction is generated from Mori et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 270260649602149760, parallax 15.475 ± 0.035 mas (64.62 pc). Radius 0.2775 +/- 0.008 solar radii from Mori et al. 2022, the stellar radius of the default parameter set of TOI-1696 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..298M/abstract). Mass 0.255 +/- 0.0066 solar masses from Mori et al. 2022, the stellar mass of the default parameter set of TOI-1696 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..298M/abstract). Temperature 3,185 K from Mori et al. 2022, the stellar temperature of the default parameter set of TOI-1696 b in the NASA Exoplanet Archive. log g 4.96 from the mass and radius.

**Color.** A Planck spectrum at 3,185 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbe79. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,185 K and log g 4.96 (u1 0.155, u2 0.480): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
