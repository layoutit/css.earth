# TOI-1227

## Sources

Its radius and temperature follow Mann et al. 2022. The introduction is generated from Mann et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5842480953772012928, parallax 9.905 ± 0.024 mas (100.96 pc). Radius 0.56 +/- 0.03 solar radii from Mann et al. 2022, the stellar radius of the default parameter set of TOI-1227 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..156M/abstract). Mass 0.17 +/- 0.015 solar masses from Mann et al. 2022, the stellar mass of the default parameter set of TOI-1227 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..156M/abstract). Temperature 3,072 K from Mann et al. 2022, the stellar temperature of the default parameter set of TOI-1227 b in the NASA Exoplanet Archive. log g 4.17 from the mass and radius.

**Color.** A Planck spectrum at 3,072 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffba72. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,072 K and log g 4.17 (u1 0.172, u2 0.486): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1227 b" (revision 1374087051) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
