# TOI-1136

## Sources

Its radius and temperature follow Dai et al. 2023. The introduction is generated from Dai et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1677343097418015488, parallax 11.824 ± 0.011 mas (84.58 pc). Radius 0.968 +/- 0.036 solar radii from Dai et al. 2023, the stellar radius of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165...33D/abstract). Mass 1.022 +/- 0.027 solar masses from Dai et al. 2023, the stellar mass of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165...33D/abstract). Temperature 5,770 K from Dai et al. 2023, the stellar temperature of the default parameter set of TOI-1136 b in the NASA Exoplanet Archive. log g 4.48 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1677343097418015488, through the CIE 1931 2° observer: #fff3f3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,770 K and log g 4.48 (u1 0.461, u2 0.259): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 14, 15, 21 and 22 (the newest of February and March 2020; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are among the light curves [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954) searched for rotation, and the star's row in their table (VizieR J/AJ/167/189/fig12) is their verdict that each shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Colman et al. (2024, AJ 167, 189) ask a sector's light to pass both of the paper's random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01. Their table (VizieR J/AJ/167/189/fig12) gives a rotation period of 8.68 d, the median of the Lomb-Scargle periods of the star's 4 sectors among sectors 1 to 26, each of which passed both of the paper's classifiers: the star's period is 8.68 d, as published, and no criteria were applied to it here. The light varies by 2.3% (the range between its 5th and 95th percentiles, as the table prints it). On the paper's blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 3 of the star's 7 sectors, and Holcomb et al. (2022) ask for at least 4. The star's record holds 8.19 d from the catalogues. The map's light curve leaves a scatter of 0.17% about the light, whose own noise is 0.02%. Gaia DR3 lists 2 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1136" (revision 1373175479) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of February and March 2020: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
