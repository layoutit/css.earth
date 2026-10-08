# KELT-1

## Sources

Its radius and temperature follow Siverd et al. 2012. The introduction is generated from Siverd et al. 2012's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2881784280929695360, parallax 3.684 ± 0.014 mas (271.47 pc). Radius 1.471 +/- 0.045 solar radii from Siverd et al. 2012, the stellar radius of the default parameter set of KELT-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012ApJ...761..123S/abstract). Mass 1.335 +/- 0.063 solar masses from Siverd et al. 2012, the stellar mass of the default parameter set of KELT-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012ApJ...761..123S/abstract). Temperature 6,516 K from Siverd et al. 2012, the stellar temperature of the default parameter set of KELT-1 b in the NASA Exoplanet Archive. log g 4.23 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2881784280929695360, through the CIE 1931 2° observer: #fbf5ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,516 K and log g 4.23 (u1 0.349, u2 0.315): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "KELT-1" (revision 1374864236) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
