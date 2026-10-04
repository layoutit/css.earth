# Tuiren

## Sources

Its radius and temperature follow Chakrabarty & Sengupta 2019. The introduction is generated from Chakrabarty & Sengupta 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1541532207133249920, parallax 3.406 ± 0.011 mas (293.64 pc). Radius 1.041 +/- 0.013 solar radii from Chakrabarty & Sengupta 2019, the stellar radius of the default parameter set of HAT-P-36 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Mass 1.03 +/- 0.03 solar masses from Chakrabarty & Sengupta 2019, the stellar mass of the default parameter set of HAT-P-36 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract). Temperature 5,620 K from Chakrabarty & Sengupta 2019, the stellar temperature of the default parameter set of HAT-P-36 b in the NASA Exoplanet Archive. log g 4.42 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1541532207133249920, through the CIE 1931 2° observer: #ffeee7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,620 K and log g 4.42 (u1 0.493, u2 0.238): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-36" (revision 1374405757) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
