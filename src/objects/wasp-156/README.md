# WASP-156

## Sources

Its radius follows Bourrier et al. 2023, and its temperature Lafarga et al. 2026. The introduction is generated from Lafarga et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2514360548993901312, parallax 8.207 ± 0.021 mas (121.84 pc). Radius 0.76 +/- 0.03 solar radii from Bourrier et al. 2023, the stellar radius of WASP-156 b's parameter set from Bourrier et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...669A..63B/abstract). Mass 0.842 +/- 0.052 solar masses from Bourrier et al. 2023, the stellar mass of WASP-156 b's parameter set from Bourrier et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...669A..63B/abstract). Temperature 5,036 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of WASP-156 b in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2514360548993901312, through the CIE 1931 2° observer: #ffdcc4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,036 K and log g 4.6 (u1 0.647, u2 0.127): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
