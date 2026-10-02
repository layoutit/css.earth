# MASCARA-1

## Sources

Its radius and temperature follow Hooton et al. 2022. It is also HD 201585, HIP 104513. The introduction is generated from Hooton et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1744911763437512064, parallax 5.489 ± 0.024 mas (182.19 pc). Radius 2.082 +/- 0.022 solar radii from Hooton et al. 2022, the stellar radius of the default parameter set of MASCARA-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A..75H/abstract). Mass 1.9 +/- 0.063 solar masses from Hooton et al. 2022, the stellar mass of the default parameter set of MASCARA-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A..75H/abstract). Temperature 7,490 K from Hooton et al. 2022, the stellar temperature of the default parameter set of MASCARA-1 b in the NASA Exoplanet Archive. log g 4.08 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1744911763437512064, through the CIE 1931 2° observer: #cdd9ff. Routes tried in order: stis-ngsl: HD 201585 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,490 K and log g 4.08 (u1 0.277, u2 0.347): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 201585" (revision 1324636195) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
