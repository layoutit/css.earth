# LP 791-18

## Sources

Its radius and temperature follow Peterson et al. 2023. The introduction is generated from Peterson et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3562427951852172288, parallax 37.522 ± 0.039 mas (26.65 pc). Radius 0.182 +/- 0.007 solar radii from Peterson et al. 2023, the stellar radius of the default parameter set of LP 791-18 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023Natur.617..701P/abstract). Mass 0.139 +/- 0.005 solar masses from Peterson et al. 2023, the stellar mass of the default parameter set of LP 791-18 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023Natur.617..701P/abstract). Temperature 2,960 K from Peterson et al. 2023, the stellar temperature of the default parameter set of LP 791-18 b in the NASA Exoplanet Archive. log g 5.06 from the mass and radius.

**Color.** A Planck spectrum at 2,960 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffb66b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 2,960 K and log g 5.06 (u1 0.193, u2 0.527): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "LP 791-18" (revision 1373170985) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
