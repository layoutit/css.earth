# Kepler-42

## Sources

Its radius and temperature follow Muirhead et al. 2012. The introduction is generated from Muirhead et al. 2012's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2126556132093765888, parallax 24.934 ± 0.020 mas (40.11 pc). Radius 0.17 +/- 0.04 solar radii from Muirhead et al. 2012, the stellar radius of the default parameter set of Kepler-42 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012arXiv1201.2189M/abstract). Mass 0.13 +/- 0.05 solar masses from Muirhead et al. 2012, the stellar mass of the default parameter set of Kepler-42 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012arXiv1201.2189M/abstract). Temperature 3,068 K from Muirhead et al. 2012, the stellar temperature of the default parameter set of Kepler-42 c in the NASA Exoplanet Archive. log g 5.09 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2126556132093765888, through the CIE 1931 2° observer: #ffbf6d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,068 K and log g 5.09 (u1 0.172, u2 0.508): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-42" (revision 1374442586) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
