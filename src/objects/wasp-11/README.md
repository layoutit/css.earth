# WASP-11

## Sources

Its radius and temperature follow Stassun et al. 2017. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 123376685084303360, parallax 7.700 ± 0.058 mas (129.88 pc); its RUWE is 3.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.89 +/- 0.08 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of WASP-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 1.42 +/- 0.43 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of WASP-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 4,800 K from Stassun et al. 2017, the stellar temperature of the default parameter set of WASP-11 b in the NASA Exoplanet Archive. log g 4.69 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 123376685084303360, through the CIE 1931 2° observer: #ffdbc2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,800 K and log g 4.69 (u1 0.712, u2 0.073): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-11" (revision 1374863771) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
