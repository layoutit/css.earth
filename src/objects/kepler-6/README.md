# Kepler-6

## Sources

Its radius and temperature follow Esteves et al. 2015. The introduction is generated from Esteves et al. 2015's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2086636884980514304, parallax 1.711 ± 0.010 mas (584.53 pc). Radius 1.391 +/- 0.017 solar radii from Esteves et al. 2015, the stellar radius of the default parameter set of Kepler-6 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract). Mass 1.209 +/- 0.044 solar masses from Esteves et al. 2015, the stellar mass of the default parameter set of Kepler-6 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract). Temperature 5,647 K from Esteves et al. 2015, the stellar temperature of the default parameter set of Kepler-6 b in the NASA Exoplanet Archive. log g 4.23 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2086636884980514304, through the CIE 1931 2° observer: #ffede2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,647 K and log g 4.23 (u1 0.485, u2 0.244): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-6" (revision 1374220385) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
