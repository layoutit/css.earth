# Pipoltr

## Sources

Its radius and temperature follow Sozzetti et al. 2009. The introduction is generated from Sozzetti et al. 2009's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4609131509318715136, parallax 4.311 ± 0.009 mas (231.99 pc). Radius 0.829 +/- 0.015 solar radii from Sozzetti et al. 2009, the stellar radius of the default parameter set of TrES-3 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...691.1145S/abstract). Mass 0.928 +/- 0.028 solar masses from Sozzetti et al. 2009, the stellar mass of the default parameter set of TrES-3 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...691.1145S/abstract). Temperature 5,650 K from Sozzetti et al. 2009, the stellar temperature of the default parameter set of TrES-3 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4609131509318715136, through the CIE 1931 2° observer: #ffeee6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,650 K and log g 4.57 (u1 0.488, u2 0.242): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TrES-3b" (revision 1374222310) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
