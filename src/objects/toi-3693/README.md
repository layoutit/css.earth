# TOI-3693

## Sources

Its radius and temperature follow Yee et al. 2022. The introduction is generated from Yee et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 404433018447476096, parallax 5.688 ± 0.018 mas (175.82 pc). Radius 0.791 +/- 0.017 solar radii from Yee et al. 2022, the stellar radius of the default parameter set of TOI-3693 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...70Y/abstract). Mass 0.867 +/- 0.036 solar masses from Yee et al. 2022, the stellar mass of the default parameter set of TOI-3693 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...70Y/abstract). Temperature 5,321 K from Yee et al. 2022, the stellar temperature of the default parameter set of TOI-3693 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 404433018447476096, through the CIE 1931 2° observer: #ffe5d4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,321 K and log g 4.58 (u1 0.568, u2 0.187): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
