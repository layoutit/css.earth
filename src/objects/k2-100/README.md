# K2-100

## Sources

Its radius and temperature follow Barragán et al. 2019. The introduction is generated from Barragán et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 664337230586013312, parallax 5.472 ± 0.024 mas (182.74 pc). Radius 1.24 +/- 0.05 solar radii from Barragán et al. 2019, the stellar radius of the default parameter set of K2-100 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.490..698B/abstract). Mass 1.15 +/- 0.05 solar masses from Barragán et al. 2019, the stellar mass of the default parameter set of K2-100 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.490..698B/abstract). Temperature 5,945 K from Barragán et al. 2019, the stellar temperature of the default parameter set of K2-100 b in the NASA Exoplanet Archive. log g 4.31 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 664337230586013312, through the CIE 1931 2° observer: #fff6fb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,945 K and log g 4.31 (u1 0.424, u2 0.281): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
