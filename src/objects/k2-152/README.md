# K2-152

## Sources

Its radius and temperature follow Livingston et al. 2018. The introduction is generated from Livingston et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3596508242468505216, parallax 9.240 ± 0.015 mas (108.22 pc). Radius 0.61 +/- 0.01 solar radii from Livingston et al. 2018, the stellar radius of the default parameter set of K2-152 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Mass 0.63 +/- 0.01 solar masses from Livingston et al. 2018, the stellar mass of the default parameter set of K2-152 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156...78L/abstract). Temperature 4,044 K from Livingston et al. 2018, the stellar temperature of the default parameter set of K2-152 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3596508242468505216, through the CIE 1931 2° observer: #ffbe8e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,044 K and log g 4.67 (u1 0.575, u2 0.190): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
