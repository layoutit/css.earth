# Kepler-11

## Sources

Its radius and temperature follow Lissauer et al. 2013. The introduction is generated from Lissauer et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2076960598545789824, parallax 1.548 ± 0.012 mas (646.18 pc). Radius 1.065 +/- 0.017 solar radii from Lissauer et al. 2013, the stellar radius of the default parameter set of Kepler-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...770..131L/abstract). Mass 0.961 +/- 0.025 solar masses from Lissauer et al. 2013, the stellar mass of the default parameter set of Kepler-11 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013ApJ...770..131L/abstract). Temperature 5,663 K from Lissauer et al. 2013, the stellar temperature of the default parameter set of Kepler-11 b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2076960598545789824, through the CIE 1931 2° observer: #ffefe8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,663 K and log g 4.37 (u1 0.483, u2 0.245): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-11" (revision 1374405418) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
