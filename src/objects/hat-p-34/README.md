# Sansuna

## Sources

Its radius and temperature follow Bonomo et al. 2017. It is also HD 351766. The introduction is generated from Bonomo et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1810218734058821632, parallax 3.948 ± 0.022 mas (253.31 pc). Radius 1.53 +/- 0.14 solar radii from Bonomo et al. 2017, the stellar radius of the default parameter set of HAT-P-34 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Mass 1.392 +/- 0.047 solar masses from Bonomo et al. 2017, the stellar mass of the default parameter set of HAT-P-34 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract). Temperature 6,442 K from Bonomo et al. 2017, the stellar temperature of the default parameter set of HAT-P-34 b in the NASA Exoplanet Archive. log g 4.21 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1810218734058821632, through the CIE 1931 2° observer: #f0eeff. Routes tried in order: stis-ngsl: HD 351766 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,442 K and log g 4.21 (u1 0.356, u2 0.312): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
