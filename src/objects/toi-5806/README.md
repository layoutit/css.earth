# TOI-5806

## Sources

Its radius and temperature follow Lillo-Box et al. 2026. It is also HD 208528. The introduction is generated from Lillo-Box et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1780750207505594496, parallax 8.444 ± 0.019 mas (118.43 pc). Radius 1.387 +/- 0.08 solar radii from Lillo-Box et al. 2026, the stellar radius of the default parameter set of TOI-5806 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260719756L/abstract). Mass 1.333 +/- 0.099 solar masses from Lillo-Box et al. 2026, the stellar mass of the default parameter set of TOI-5806 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260719756L/abstract). Temperature 6,730 K from Lillo-Box et al. 2026, the stellar temperature of the default parameter set of TOI-5806 b in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1780750207505594496, through the CIE 1931 2° observer: #ebebff. Routes tried in order: stis-ngsl: HD 208528 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,730 K and log g 4.28 (u1 0.330, u2 0.322): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
