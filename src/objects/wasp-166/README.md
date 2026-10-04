# Filetdor

## Sources

Its radius and temperature follow Hellier et al. 2019. The introduction is generated from Hellier et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5664957444179338240, parallax 8.752 ± 0.014 mas (114.26 pc). Radius 1.22 +/- 0.06 solar radii from Hellier et al. 2019, the stellar radius of the default parameter set of WASP-166 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.488.3067H/abstract). Mass 1.19 +/- 0.06 solar masses from Hellier et al. 2019, the stellar mass of the default parameter set of WASP-166 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.488.3067H/abstract). Temperature 6,050 K from Hellier et al. 2019, the stellar temperature of the default parameter set of WASP-166 b in the NASA Exoplanet Archive. log g 4.34 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5664957444179338240, through the CIE 1931 2° observer: #fff7ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,050 K and log g 4.34 (u1 0.406, u2 0.290): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-166" (revision 1375752963) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
