# K2-29

## Sources

Its radius and temperature follow Santerne et al. 2016. The introduction is generated from Santerne et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 150054788545735424, parallax 5.643 ± 0.019 mas (177.20 pc). Radius 0.86 +/- 0.01 solar radii from Santerne et al. 2016, the stellar radius of the default parameter set of K2-29 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract). Mass 0.94 +/- 0.02 solar masses from Santerne et al. 2016, the stellar mass of the default parameter set of K2-29 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract). Temperature 5,358 K from Santerne et al. 2016, the stellar temperature of the default parameter set of K2-29 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 150054788545735424, through the CIE 1931 2° observer: #ffdcbc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,358 K and log g 4.54 (u1 0.558, u2 0.194): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
