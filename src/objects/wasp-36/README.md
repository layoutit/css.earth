# WASP-36

## Sources

Its radius and temperature follow Mancini et al. 2016. The introduction is generated from Mancini et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5750936092375254016, parallax 2.649 ± 0.013 mas (377.45 pc). Radius 0.985 +/- 0.014 solar radii from Mancini et al. 2016, the stellar radius of the default parameter set of WASP-36 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.459.1393M/abstract). Mass 1.081 +/- 0.034 solar masses from Mancini et al. 2016, the stellar mass of the default parameter set of WASP-36 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.459.1393M/abstract). Temperature 5,959 K from Mancini et al. 2016, the stellar temperature of the default parameter set of WASP-36 b in the NASA Exoplanet Archive. log g 4.49 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5750936092375254016, through the CIE 1931 2° observer: #fff4f6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,959 K and log g 4.49 (u1 0.423, u2 0.281): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-36" (revision 1374864137) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
