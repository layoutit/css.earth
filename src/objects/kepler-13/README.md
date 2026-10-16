# Kepler-13

## Sources

Its radius and temperature follow Esteves et al. 2015. The introduction is generated from Esteves et al. 2015's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2130632159136095104, parallax 2.032 ± 0.034 mas (492.14 pc). Radius 1.74 +/- 0.04 solar radii from Esteves et al. 2015, the stellar radius of the default parameter set of KOI-13 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract). Mass 1.72 +/- 0.1 solar masses from Esteves et al. 2015, the stellar mass of the default parameter set of KOI-13 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract). Temperature 7,650 K from Esteves et al. 2015, the stellar temperature of the default parameter set of KOI-13 b in the NASA Exoplanet Archive. log g 4.19 from the mass and radius.

**Color.** A Planck spectrum at 7,650 K, because kepler-13 B lies 1.2 arcsec away and gives 47% of the light (WDS 19079+4652, Mason et al. 2001): every spectrum and catalogue color of the star blends the two, so the color is taken from its own temperature, through the CIE 1931 2° observer: #e8ebff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,650 K and log g 4.19 (u1 0.280, u2 0.345): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-13" (revision 1368288051) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
