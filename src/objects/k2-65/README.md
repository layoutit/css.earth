# K2-65

## Sources

Its radius and temperature follow Crossfield et al. 2016. It is also HIP 109656. The introduction is generated from Crossfield et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2613211076737129856, parallax 15.847 ± 0.021 mas (63.10 pc). Radius 0.84 +/- 0.12 solar radii from Crossfield et al. 2016, the stellar radius of the default parameter set of K2-65 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract). Mass 0.87 +/- 0.1 solar masses from Crossfield et al. 2016, the stellar mass of the default parameter set of K2-65 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract). Temperature 5,213 K from Crossfield et al. 2016, the stellar temperature of the default parameter set of K2-65 b in the NASA Exoplanet Archive. log g 4.53 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2613211076737129856, through the CIE 1931 2° observer: #ffdbc6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,213 K and log g 4.53 (u1 0.597, u2 0.166): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
