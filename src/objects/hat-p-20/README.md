# HAT-P-20

## Sources

Its radius and temperature follow Bakos et al. 2010. The introduction is generated from Bakos et al. 2010's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 869913435026514688, parallax 14.007 ± 0.018 mas (71.40 pc). Radius 0.694 +/- 0.021 solar radii from Bakos et al. 2010, the stellar radius of the default parameter set of HAT-P-20 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010arXiv1008.3388B/abstract). Mass 0.756 +/- 0.028 solar masses from Bakos et al. 2010, the stellar mass of the default parameter set of HAT-P-20 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010arXiv1008.3388B/abstract). Temperature 4,595 K from Bakos et al. 2010, the stellar temperature of the default parameter set of HAT-P-20 b in the NASA Exoplanet Archive. log g 4.63 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 869913435026514688, through the CIE 1931 2° observer: #ffcaa7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,595 K and log g 4.63 (u1 0.757, u2 0.035): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-20" (revision 1374438013) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
