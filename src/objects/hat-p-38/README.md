# Horna

## Sources

Its radius and temperature follow Sato et al. 2012. The introduction is generated from Sato et al. 2012's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 324889227693298560, parallax 3.975 ± 0.013 mas (251.59 pc). Radius 0.923 +/- 0.096 solar radii from Sato et al. 2012, the stellar radius of the default parameter set of HAT-P-38 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012PASJ...64...97S/abstract). Mass 0.886 +/- 0.044 solar masses from Sato et al. 2012, the stellar mass of the default parameter set of HAT-P-38 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012PASJ...64...97S/abstract). Temperature 5,330 K from Sato et al. 2012, the stellar temperature of the default parameter set of HAT-P-38 b in the NASA Exoplanet Archive. log g 4.46 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 324889227693298560, through the CIE 1931 2° observer: #ffe5d2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,330 K and log g 4.46 (u1 0.565, u2 0.189): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-38" (revision 1341758891) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
