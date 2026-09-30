# WASP-189

## Sources

Its radius and temperature follow Lendl et al. 2020. It is also HD 133112, HR 5599, HIP 73608. The introduction is generated from Lendl et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6339097679918871168, parallax 10.100 ± 0.029 mas (99.01 pc). Radius 2.36 +/- 0.03 solar radii from Lendl et al. 2020, the stellar radius of the default parameter set of WASP-189 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...643A..94L/abstract). Mass 2.03 +/- 0.066 solar masses from Lendl et al. 2020, the stellar mass of the default parameter set of WASP-189 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...643A..94L/abstract). Temperature 8,000 K from Lendl et al. 2020, the stellar temperature of the default parameter set of WASP-189 b in the NASA Exoplanet Archive. log g 4 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6339097679918871168, through the CIE 1931 2° observer: #c9d6ff. Routes tried in order: stis-ngsl: HD 133112 is not in the library; pulkovo: HR 5599 is not in the catalogue; kiehling: HR 5599 is not among its 60 stars; kharitonov: HR 5599 is not in the catalogue; burnashev: BS 5599 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,000 K and log g 4 (u1 0.313, u2 0.327): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-189 b" (revision 1374244884) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
