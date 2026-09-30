# WASP-103

## Sources

WASP-103 hosts the ultra-hot giant WASP-103 b. Its uniform disc uses the colour derived from its Gaia DR3 spectrum.

**Star.** Placement: Gaia DR3 source 4439085988769170432, parallax 1.833 ± 0.107 mas (545.49 pc); its RUWE is 7.2, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 1.436 +/- 0.052 solar radii from Gillon et al. 2014, the stellar radius of the default parameter set of WASP-103 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014A&A...562L...3G/abstract). Mass 1.22 +/- 0.039 solar masses from Gillon et al. 2014, the stellar mass of the default parameter set of WASP-103 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014A&A...562L...3G/abstract). Temperature 6,110 K from Gillon et al. 2014, the stellar temperature of the default parameter set of WASP-103 b in the NASA Exoplanet Archive. log g 4.21 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4439085988769170432, through the CIE 1931 2° observer: #fff4f2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,110 K and log g 4.21 (u1 0.397, u2 0.295): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-27 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

The package source-coverage and inventory checks passed. Chromium 154 mounted this star as one shared object scene and the inspected disc showed its model limb darkening. The companion's evidence record identifies the tested integration revision.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
