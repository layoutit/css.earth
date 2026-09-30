# TOI-1452

## Sources

Its radius and temperature follow Cadieux et al. 2022. The introduction is generated from Cadieux et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2264839957167921024, parallax 32.782 ± 0.014 mas (30.50 pc); its RUWE is 1.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.275 +/- 0.009 solar radii from Cadieux et al. 2022, the stellar radius of the default parameter set of TOI-1452 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...96C/abstract). Mass 0.249 +/- 0.008 solar masses from Cadieux et al. 2022, the stellar mass of the default parameter set of TOI-1452 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...96C/abstract). Temperature 3,185 K from Cadieux et al. 2022, the stellar temperature of the default parameter set of TOI-1452 b in the NASA Exoplanet Archive. log g 4.96 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2264839957167921024, through the CIE 1931 2° observer: #ffcb82. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,185 K and log g 4.96 (u1 0.155, u2 0.480): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1452 b" (revision 1374086980) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
