# TOI-2267

## Sources

Its radius and temperature follow Zúñiga-Fernández et al. 2025. The introduction is generated from Zúñiga-Fernández et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 571488283984760960, parallax 44.350 ± 0.356 mas (22.55 pc); its RUWE is 13.7, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.2075 +/- 0.0225 solar radii from Zúñiga-Fernández et al. 2025, the stellar radius of the default parameter set of TOI-2267 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...702A..85Z/abstract). Mass 0.171 +/- 0.0079 solar masses from Zúñiga-Fernández et al. 2025, the stellar mass of the default parameter set of TOI-2267 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...702A..85Z/abstract). Temperature 3,030 K from Zúñiga-Fernández et al. 2025, the stellar temperature of the default parameter set of TOI-2267 b in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 571488283984760960, through the CIE 1931 2° observer: #ffd486. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,030 K and log g 5.04 (u1 0.178, u2 0.514): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/toi-2267.json: 5.037.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
