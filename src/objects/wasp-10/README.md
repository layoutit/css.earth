# WASP-10

## Sources

Its radius and temperature follow Johnson et al. 2009. The introduction is generated from Johnson et al. 2009's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1909762228985058944, parallax 7.072 ± 0.013 mas (141.41 pc). Radius 0.698 +/- 0.012 solar radii from Johnson et al. 2009, the stellar radius of the default parameter set of WASP-10 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...692L.100J/abstract). Mass 0.75 +/- 0.04 solar masses from Johnson et al. 2009, the stellar mass of the default parameter set of WASP-10 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...692L.100J/abstract). Temperature 4,675 K from Johnson et al. 2009, the stellar temperature of the default parameter set of WASP-10 b in the NASA Exoplanet Archive. log g 4.63 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1909762228985058944, through the CIE 1931 2° observer: #ffd3b6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,675 K and log g 4.63 (u1 0.741, u2 0.049): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-10" (revision 1374438662) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
