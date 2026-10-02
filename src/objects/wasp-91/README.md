# WASP-91

## Sources

Its radius and temperature follow Anderson et al. 2017. The introduction is generated from Anderson et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6386751579018596864, parallax 6.615 ± 0.011 mas (151.18 pc). Radius 0.86 +/- 0.03 solar radii from Anderson et al. 2017, the stellar radius of the default parameter set of WASP-91 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...604A.110A/abstract). Mass 0.84 +/- 0.07 solar masses from Anderson et al. 2017, the stellar mass of the default parameter set of WASP-91 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...604A.110A/abstract). Temperature 4,920 K from Anderson et al. 2017, the stellar temperature of the default parameter set of WASP-91 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6386751579018596864, through the CIE 1931 2° observer: #ffdec7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,920 K and log g 4.49 (u1 0.679, u2 0.102): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
