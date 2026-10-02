# TOI-5126

## Sources

Its radius and temperature follow Fairnington et al. 2024. The introduction is generated from Fairnington et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 623633615066248576, parallax 6.224 ± 0.022 mas (160.67 pc). Radius 1.241 +/- 0.032 solar radii from Fairnington et al. 2024, the stellar radius of the default parameter set of TOI-5126 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.527.8768F/abstract). Mass 1.24 +/- 0.05 solar masses from Fairnington et al. 2024, the stellar mass of the default parameter set of TOI-5126 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.527.8768F/abstract). Temperature 6,150 K from Fairnington et al. 2024, the stellar temperature of the default parameter set of TOI-5126 b in the NASA Exoplanet Archive. log g 4.34 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 623633615066248576, through the CIE 1931 2° observer: #fef6ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,150 K and log g 4.34 (u1 0.392, u2 0.298): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
