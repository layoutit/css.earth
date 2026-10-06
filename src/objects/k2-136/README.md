# K2-136

## Sources

Its radius and temperature follow Mayo et al. 2023. The introduction is generated from Mayo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 145916050683920128, parallax 16.982 ± 0.019 mas (58.89 pc). Radius 0.677 +/- 0.027 solar radii from Mayo et al. 2023, the stellar radius of the default parameter set of K2-136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..235M/abstract). Mass 0.742 +/- 0.039 solar masses from Mayo et al. 2023, the stellar mass of the default parameter set of K2-136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..235M/abstract). Temperature 4,500 K from Mayo et al. 2023, the stellar temperature of the default parameter set of K2-136 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 145916050683920128, through the CIE 1931 2° observer: #ffc7a2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,500 K and log g 4.65 (u1 0.774, u2 0.021): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the star's light in the K2 target pixel files of campaign 13 (March to May 2017), kept at [MAST](https://archive.stsci.edu/missions-and-data/k2) ([source record](../../sources/mast-k2-target-pixel-files.json)). lightkurve measures the light, astropy its period, and starry (Luger et al. 2019) the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 13 the light swings by 0.45% with a period of 15.12 d, and each half of the campaign alone shows the same period within 20%. The star's record holds 15 d from the catalogues. The map's light curve leaves a scatter of 0.14% about the light, whose own noise is 0.01%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "K2-136" (revision 1375128572) verbatim, CC BY-SA 4.0.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 61.1°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of March to May 2017: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
