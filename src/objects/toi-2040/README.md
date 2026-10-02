# TOI-2040

## Sources

Its radius and temperature follow Guenther et al. 2026. The introduction is generated from Guenther et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2227309055469504640, parallax 6.919 ± 0.014 mas (144.53 pc). Radius 0.87 +/- 0.02 solar radii from Guenther et al. 2026, the stellar radius of the default parameter set of TOI-2040 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract). Mass 0.92 +/- 0.03 solar masses from Guenther et al. 2026, the stellar mass of the default parameter set of TOI-2040 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract). Temperature 5,132 K from Guenther et al. 2026, the stellar temperature of the default parameter set of TOI-2040 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2227309055469504640, through the CIE 1931 2° observer: #ffdec7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,132 K and log g 4.52 (u1 0.619, u2 0.149): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
