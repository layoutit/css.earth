# WASP-75

## Sources

Its radius and temperature follow Gomez et al. 2013. The introduction is generated from Gomez et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2605161444735454464, parallax 3.339 ± 0.020 mas (299.52 pc). Radius 1.26 +/- 0.04 solar radii from Gomez et al. 2013, the stellar radius of the default parameter set of WASP-75 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...559A..36G/abstract). Mass 1.14 +/- 0.07 solar masses from Gomez et al. 2013, the stellar mass of the default parameter set of WASP-75 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...559A..36G/abstract). Temperature 6,100 K from Gomez et al. 2013, the stellar temperature of the default parameter set of WASP-75 b in the NASA Exoplanet Archive. log g 4.29 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2605161444735454464, through the CIE 1931 2° observer: #fff5f7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,100 K and log g 4.29 (u1 0.399, u2 0.294): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-75" (revision 1369401087) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
