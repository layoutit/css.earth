# HD 110082

## Sources

Its radius and temperature follow Tofflemire et al. 2021. It is also HIP 62662. The introduction is generated from Tofflemire et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5765748511163751936, parallax 9.511 ± 0.012 mas (105.14 pc). Radius 1.19 +/- 0.06 solar radii from Tofflemire et al. 2021, the stellar radius of the default parameter set of HD 110082 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..171T/abstract). Mass 1.21 +/- 0.06 solar masses from Tofflemire et al. 2021, the stellar mass of the default parameter set of HD 110082 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..171T/abstract). Temperature 6,200 K from Tofflemire et al. 2021, the stellar temperature of the default parameter set of HD 110082 b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5765748511163751936, through the CIE 1931 2° observer: #f7f3ff. Routes tried in order: stis-ngsl: HD 110082 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,200 K and log g 4.37 (u1 0.384, u2 0.301): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 12 and 13 (the newest of June and July 2019; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are among the light curves [Canto Martins et al. (2020, ApJS 250, 20)](https://arxiv.org/abs/2007.03079) searched for rotation, and the star's row in their table (VizieR J/ApJS/250/20, table 1) is their verdict that each shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Canto Martins et al. (2020, ApJS 250, 20) ask the Lomb-Scargle periodogram, the fast Fourier transform and the wavelet map of a star's light to show one period, and their own inspection of the light curve to find its signal over more than three cycles, or over 2.5 when it is clear, large and persistent. Their table (VizieR J/ApJS/250/20, table 1) gives a rotation period of 2.149 ± 0.044 d, the peak of the wavelet's global spectrum of 52 days of the star's light in sectors 1 to 22 (24.2 cycles), which the paper lists among its unambiguous rotation periods: the star's period is 2.149 d, as published, and no criteria were applied to it here. The light varies by 0.49% (the range between its 5th and 95th percentiles, measured here over the sectors mapped; the table prints none). The paper gives its periods' errors as typically 5%. Of its 18 stars with a rotation period that Oelkers et al. (2018) also measured from the ground, 9 have the two periods within 10% and 9 do not. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: The star's sectors together do not give a valid period: The autocorrelation of all the sectors together gives 2.36 d with peaks of height 0.47, width 0.39 and fit 0.97, outside what Holcomb et al. (2022) accept (a height over a quarter of the width, a width between 0.4 and 0.6, a fit over 0.9). The star's record holds 2.34 d from the catalogues. The map's light curve leaves a scatter of 0.14% about the light, whose own noise is 0.02%. Gaia DR3 lists 15 other stars within 63 arcseconds, with 0.86% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 79.5°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of June and July 2019: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
