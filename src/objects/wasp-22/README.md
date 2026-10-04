# Tojil

## Sources

Its radius and temperature follow Stassun et al. 2017. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5086537022856406272, parallax 3.153 ± 0.033 mas (317.14 pc); its RUWE is 1.7, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 1.24 +/- 0.13 solar radii from Stassun et al. 2017, the stellar radius of the default parameter set of WASP-22 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Mass 1.46 +/- 0.63 solar masses from Stassun et al. 2017, the stellar mass of the default parameter set of WASP-22 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract). Temperature 6,000 K from Stassun et al. 2017, the stellar temperature of the default parameter set of WASP-22 b in the NASA Exoplanet Archive. log g 4.42 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5086537022856406272, through the CIE 1931 2° observer: #fff6f9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,000 K and log g 4.42 (u1 0.415, u2 0.286): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-22" (revision 1375720811) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
