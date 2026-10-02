# TOI-677

## Sources

Its radius and temperature follow Jordán et al. 2020. It is also HD 297549. The introduction is generated from Jordán et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5313031504751276032, parallax 7.049 ± 0.011 mas (141.86 pc). Radius 1.28 +/- 0.03 solar radii from Jordán et al. 2020, the stellar radius of the default parameter set of TOI-677 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....159..145J/abstract). Mass 1.181 +/- 0.058 solar masses from Jordán et al. 2020, the stellar mass of the default parameter set of TOI-677 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....159..145J/abstract). Temperature 6,295 K from Jordán et al. 2020, the stellar temperature of the default parameter set of TOI-677 b in the NASA Exoplanet Archive. log g 4.3 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5313031504751276032, through the CIE 1931 2° observer: #fff7ff. Routes tried in order: stis-ngsl: HD 297549 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,295 K and log g 4.3 (u1 0.372, u2 0.307): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-677 b" (revision 1374392731) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
