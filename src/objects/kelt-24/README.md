# KELT-24

## Sources

Its radius and temperature follow Giovinazzi et al. 2024. It is also HD 93148, HIP 52796. The introduction is generated from Giovinazzi et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1076970406751899008, parallax 10.322 ± 0.018 mas (96.88 pc). Radius 1.338 +/- 0.032 solar radii from Giovinazzi et al. 2024, the stellar radius of the default parameter set of KELT-24 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..118G/abstract). Mass 1.268 +/- 0.063 solar masses from Giovinazzi et al. 2024, the stellar mass of the default parameter set of KELT-24 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..118G/abstract). Temperature 6,426 K from Giovinazzi et al. 2024, the stellar temperature of the default parameter set of KELT-24 b in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1076970406751899008, through the CIE 1931 2° observer: #eeedff. Routes tried in order: stis-ngsl: HD 93148 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,426 K and log g 4.29 (u1 0.358, u2 0.312): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "KELT-24" (revision 1329899560) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
