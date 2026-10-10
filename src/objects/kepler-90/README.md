# Kepler-90

## Sources

Its radius and temperature follow Cabrera et al. 2014. The introduction is generated from Cabrera et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132193431285570304, parallax 1.169 ± 0.011 mas (855.10 pc). Radius 1.2 +/- 0.1 solar radii from Cabrera et al. 2014, the stellar radius of the default parameter set of KOI-351 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...781...18C/abstract). Mass 1.2 +/- 0.1 solar masses from Cabrera et al. 2014, the stellar mass of the default parameter set of KOI-351 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...781...18C/abstract). Temperature 6,080 K from Cabrera et al. 2014, the stellar temperature of the default parameter set of KOI-351 b in the NASA Exoplanet Archive. log g 4.36 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2132193431285570304, through the CIE 1931 2° observer: #fff5f9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,080 K and log g 4.36 (u1 0.402, u2 0.292): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-90" (revision 1372465090) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
