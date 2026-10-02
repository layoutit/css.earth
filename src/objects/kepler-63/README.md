# Kepler-63

## Sources

Its radius and temperature follow Sanchis-Ojeda et al. 2013. The introduction is generated from Sanchis-Ojeda et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132628489996257920, parallax 5.116 ± 0.010 mas (195.48 pc). Radius 0.901 +/- 0.027 solar radii from Sanchis-Ojeda et al. 2013, the stellar radius of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...775...54S/abstract). Mass 0.984 +/- 0.035 solar masses from Sanchis-Ojeda et al. 2013, the stellar mass of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...775...54S/abstract). Temperature 5,576 K from Sanchis-Ojeda et al. 2013, the stellar temperature of the default parameter set of Kepler-63 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2132628489996257920, through the CIE 1931 2° observer: #ffede4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,576 K and log g 4.52 (u1 0.504, u2 0.231): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-63" (revision 1374405156) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
