# LTT 1445 A

## Sources

Its radius and temperature follow Winters et al. 2022. The introduction is generated from Winters et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5153091836072107136, parallax 145.692 ± 0.024 mas (6.86 pc). Radius 0.265 +/- 0.011 solar radii from Winters et al. 2022, the stellar radius of the default parameter set of LTT 1445 A c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..168W/abstract). Mass 0.257 +/- 0.014 solar masses from Winters et al. 2022, the stellar mass of the default parameter set of LTT 1445 A c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..168W/abstract). Temperature 3,340 K from Winters et al. 2022, the stellar temperature of the default parameter set of LTT 1445 A c in the NASA Exoplanet Archive. log g 5 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5153091836072107136, through the CIE 1931 2° observer: #ffc680. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,340 K and log g 5 (u1 0.154, u2 0.455): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 4 and 31 (the newest of October and November 2020; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 4 gives a period of 1.39 d from the autocorrelation, whose peaks have a height of 0.49, a width of 0.49 and a fit of 1.00; Sector 31 gives a period of 1.41 d from the autocorrelation, whose peaks have a height of 0.52, a width of 0.48 and a fit of 1.00. All 2 together give a period of 1.41 d from the autocorrelation, whose peaks have a height of 0.51, a width of 0.48 and a fit of 1.00, which is the star's period: 1.41 d. The light varies by 1.1% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 1.3972 d from the catalogues. The map's light curve leaves a scatter of 0.22% about the light, whose own noise is 0.06%. Gaia DR3 lists 1 other star within 63 arcseconds, with 52% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "LTT 1445" (revision 1374742774) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 20.8°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of October and November 2020: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
