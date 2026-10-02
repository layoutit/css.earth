# TOI-4666

## Sources

Its radius and temperature follow Dransfield et al. 2026. The introduction is generated from Dransfield et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4855422771071903232, parallax 6.488 ± 0.016 mas (154.13 pc). Radius 0.585 +/- 0.018 solar radii from Dransfield et al. 2026, the stellar radius of the default parameter set of TOI-4666 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.547ag448D/abstract). Mass 0.576 +/- 0.012 solar masses from Dransfield et al. 2026, the stellar mass of the default parameter set of TOI-4666 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.547ag448D/abstract). Temperature 3,793 K from Dransfield et al. 2026, the stellar temperature of the default parameter set of TOI-4666 b in the NASA Exoplanet Archive. log g 4.66 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4855422771071903232, through the CIE 1931 2° observer: #ffc189. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,793 K and log g 4.66 (u1 0.435, u2 0.321): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
