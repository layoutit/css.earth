# TOI-6699

## Sources

Its radius and temperature follow Lafarga et al. 2026. The introduction is generated from Lafarga et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6450063790712030336, parallax 11.621 ± 0.016 mas (86.05 pc). Radius 0.75309 solar radii from Lafarga et al. 2026, the stellar radius of the default parameter set of TOI-6699 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag512L/abstract). Mass 0.747 (0.707 to 0.795) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 4,705.1 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of TOI-6699 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6450063790712030336, through the CIE 1931 2° observer: #ffd7bd. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,705.1 K and log g 4.56 (u1 0.736, u2 0.054): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 101, 102, 103 and 104 (the newest of May and June 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 101 gives a period of 7.68 d from the autocorrelation, whose peaks have a height of 0.19, a width of 0.50 and a fit of 0.97; Sector 102 gives a period of 7.72 d from the autocorrelation, whose peaks have a height of 0.19, a width of 0.44 and a fit of 0.99; Sector 103 gives a period of 7.60 d from the autocorrelation, whose peaks have a height of 0.12, a width of 0.41 and a fit of 0.96; Sector 104 gives a period of 7.09 d from the autocorrelation, whose peaks have a height of 0.11, a width of 0.41 and a fit of 0.99; 2 more of the star's 6 sectors do not meet the criteria. All 6 together give a period of 14.58 d from the autocorrelation, whose peaks have a height of 0.18, a width of 0.50 and a fit of 0.99, which is the star's period: 14.58 d. The light varies by 0.28% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.04% about the light, whose own noise is 0.03%. Gaia DR3 lists 14 other stars within 63 arcseconds, with 13% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May and June 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
