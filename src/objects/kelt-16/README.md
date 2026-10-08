# KELT-16

## Sources

Its radius and temperature follow Oberst et al. 2017. The introduction is generated from Oberst et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1864885215233116032, parallax 2.247 ± 0.013 mas (445.01 pc). Radius 1.36 +/- 0.064 solar radii from Oberst et al. 2017, the stellar radius of the default parameter set of KELT-16 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...97O/abstract). Mass 1.211 +/- 0.043 solar masses from Oberst et al. 2017, the stellar mass of the default parameter set of KELT-16 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...97O/abstract). Temperature 6,236 K from Oberst et al. 2017, the stellar temperature of the default parameter set of KELT-16 b in the NASA Exoplanet Archive. log g 4.25 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1864885215233116032, through the CIE 1931 2° observer: #faf5ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,236 K and log g 4.25 (u1 0.379, u2 0.304): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
