# HD 18599

## Sources

Its radius and temperature follow Desidera et al. 2023. It is also HIP 13754. The introduction is generated from Desidera et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4728513943538448512, parallax 25.885 ± 0.013 mas (38.63 pc). Radius 0.767 +/- 0.024 solar radii from Desidera et al. 2023, the stellar radius of the default parameter set of HD 18599 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A.158D/abstract). Mass 0.863 +/- 0.02 solar masses from Desidera et al. 2023, the stellar mass of the default parameter set of HD 18599 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A.158D/abstract). Temperature 5,145 K from Desidera et al. 2023, the stellar temperature of the default parameter set of HD 18599 b in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4728513943538448512, through the CIE 1931 2° observer: #ffe4d4. Routes tried in order: stis-ngsl: HD 18599 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,145 K and log g 4.6 (u1 0.616, u2 0.151): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 2 and 3 (the newest of September and October 2018; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are among the light curves [Canto Martins et al. (2020, ApJS 250, 20)](https://arxiv.org/abs/2007.03079) searched for rotation, and the star's row in their table (VizieR J/ApJS/250/20, table 1) is their verdict that each shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Canto Martins et al. (2020, ApJS 250, 20) ask the Lomb-Scargle periodogram, the fast Fourier transform and the wavelet map of a star's light to show one period, and their own inspection of the light curve to find its signal over more than three cycles, or over 2.5 when it is clear, large and persistent. Their table (VizieR J/ApJS/250/20, table 1) gives a rotation period of 8.489 ± 0.858 d, the peak of the wavelet's global spectrum of 42 days of the star's light in sectors 1 to 22 (4.9 cycles), which the paper lists among its unambiguous rotation periods: the star's period is 8.489 d, as published, and no criteria were applied to it here. The light varies by 0.68% (the range between its 5th and 95th percentiles, measured here over the sectors mapped; the table prints none). The paper gives its periods' errors as typically 5%. Of its 18 stars with a rotation period that Oelkers et al. (2018) also measured from the ground, 9 have the two periods within 10% and 9 do not. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 1 of the star's 6 sectors, and Holcomb et al. (2022) ask for at least 3. The star's record holds 8.73 d from the catalogues. The map's light curve leaves a scatter of 0.08% about the light, whose own noise is 0.02%. Gaia DR3 lists 2 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of September and October 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
