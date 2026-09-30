# K2-232

## Sources

Its radius and temperature follow Ranshaw et al. 2026. It is also HD 286123. The introduction is generated from Ranshaw et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3406687485600728192, parallax 7.706 ± 0.017 mas (129.77 pc). Radius 1.21 +/- 0.036 solar radii from Ranshaw et al. 2026, the stellar radius of the default parameter set of K2-232 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260909077R/abstract). Mass 1.121 +/- 0.063 solar masses from Ranshaw et al. 2026, the stellar mass of the default parameter set of K2-232 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260909077R/abstract). Temperature 6,100 K from Ranshaw et al. 2026, the stellar temperature of the default parameter set of K2-232 b in the NASA Exoplanet Archive. log g 4.32 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3406687485600728192, through the CIE 1931 2° observer: #fff5f8. Routes tried in order: stis-ngsl: HD 286123 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,100 K and log g 4.32 (u1 0.399, u2 0.294): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
