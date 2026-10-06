# AU Mic

## Sources

Its radius and temperature follow Mallorquín et al. 2024. It is also HD 197481, HIP 102409. The introduction is generated from Mallorquín et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6794047652729201024, parallax 102.943 ± 0.023 mas (9.71 pc). Radius 0.862 +/- 0.052 solar radii from Mallorquín et al. 2024, the stellar radius of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Mass 0.635 +/- 0.04 solar masses from Mallorquín et al. 2024, the stellar mass of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Temperature 3,540 K from Mallorquín et al. 2024, the stellar temperature of the default parameter set of AU Mic b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6794047652729201024, through the CIE 1931 2° observer: #ffc08b. Routes tried in order: stis-ngsl: HD 197481 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,540 K and log g 4.37 (u1 0.476, u2 0.311): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 1 and 95 (the newest of July and August 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 1 gives a period of 4.97 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.41 and a fit of 0.97; Sector 95 gives a period of 5.00 d from the autocorrelation, whose peaks have a height of 0.31, a width of 0.42 and a fit of 0.95; 1 more of the star's 3 sectors does not meet the criteria. All 3 together give a period of 4.84 d from the autocorrelation, whose peaks have a height of 0.32, a width of 0.43 and a fit of 0.98, which is the star's period: 4.84 d. The light varies by 7.9% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 4.856 d from the catalogues. The map's light curve leaves a scatter of 0.30% about the light, whose own noise is 0.14%. Gaia DR3 lists 16 other stars within 63 arcseconds, with 0.29% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** AU Mic d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Not shown.** AU Mic e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "AU Microscopii" (revision 1376711247) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 71.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of July and August 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
