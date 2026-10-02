# TOI-4336 A

## Sources

Its radius and temperature follow Parc et al. 2026. The introduction is generated from Parc et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6113245033656232448, parallax 44.535 ± 0.038 mas (22.45 pc); its RUWE is 1.9, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.326 +/- 0.01 solar radii from Parc et al. 2026, the stellar radius of the default parameter set of TOI-4336 A c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A..81P/abstract). Mass 0.306 +/- 0.008 solar masses from Parc et al. 2026, the stellar mass of the default parameter set of TOI-4336 A c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A..81P/abstract). Temperature 3,307 K from Parc et al. 2026, the stellar temperature of the default parameter set of TOI-4336 A c in the NASA Exoplanet Archive. log g 4.9 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6113245033656232448, through the CIE 1931 2° observer: #ffc985. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,307 K and log g 4.9 (u1 0.157, u2 0.458): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
