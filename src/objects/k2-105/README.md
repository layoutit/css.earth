# K2-105

## Sources

Its radius and temperature follow Howard et al. 2025. The introduction is generated from Howard et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 651907079835937280, parallax 5.011 ± 0.015 mas (199.58 pc). Radius 0.905 +/- 0.035 solar radii from Howard et al. 2025, the stellar radius of the default parameter set of K2-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Mass 0.94 +/- 0.04 solar masses from Howard et al. 2025, the stellar mass of the default parameter set of K2-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Temperature 5,373 K from Howard et al. 2025, the stellar temperature of the default parameter set of K2-105 b in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 651907079835937280, through the CIE 1931 2° observer: #ffe9dc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,373 K and log g 4.5 (u1 0.554, u2 0.197): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 18 (May to July 2018; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 24.06 ± 3.35 d in campaign 18, with a periodogram peak of 0.62: the star's period is 24.06 d, as published, and no criteria were applied to it here. The light varies by 0.56% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Reinhold & Hekker (2020, A&A 635, A43), applied here to the star's K2 light, are not met: The star's campaigns give periods of 13.16 and 22.67 d, which deviate by more than the 20% beyond which Reinhold & Hekker (2020) exclude a star. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 5 sectors, and Holcomb et al. (2022) ask for at least 3. The star's record holds 24.06 d from the catalogues. The map's light curve leaves a scatter of 0.10% about the light, whose own noise is 0.06%. Gaia DR3 lists 1 other star within 16 arcseconds, with 0.16% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May to July 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
