# Kepler-41

## Sources

Its radius and temperature follow Bonomo et al. 2015. The introduction is generated from Bonomo et al. 2015's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2080061942886335744, parallax 0.928 ± 0.016 mas (1077.22 pc). Radius 1.29 +/- 0.02 solar radii from Bonomo et al. 2015, the stellar radius of the default parameter set of Kepler-41 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015A&A...575A..85B/abstract). Mass 1.15 +/- 0.04 solar masses from Bonomo et al. 2015, the stellar mass of the default parameter set of Kepler-41 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015A&A...575A..85B/abstract). Temperature 5,750 K from Bonomo et al. 2015, the stellar temperature of the default parameter set of Kepler-41 b in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2080061942886335744, through the CIE 1931 2° observer: #ffece0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,750 K and log g 4.28 (u1 0.462, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-41" (revision 1370781211) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
