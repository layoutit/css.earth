# GJ 1156

## Sources

Morin et al. give it 0.16 solar radii, 0.14 solar masses, a rotation period of 11.8 hours and an axis tilted 60° from the line of sight. The introduction is generated from Morin et al., arXiv:1005.5552's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3907283967108054528, parallax 154.700 ± 0.044 mas (6.46 pc). Radius 0.16 solar radii from Morin et al., arXiv:1005.5552, Table 1: radius 0.16 solar radii (theoretical radius) (https://arxiv.org/abs/1005.5552). Mass 0.14 solar masses from Morin et al., arXiv:1005.5552, Table 1: mass 0.14 solar masses (https://arxiv.org/abs/1005.5552). Temperature 3,110 K from Pecaut & Mamajek (2013, ApJS 208, 9), the online table's version 2022.04.16, row M4.5V, for SIMBAD's spectral type M4.5Ve: Teff. log g 5.18 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3907283967108054528, through the CIE 1931 2° observer: #ffca74. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,110 K and log g 5.18 (u1 0.163, u2 0.501): a model, because no fit of this star's limb is used.

**Spin.** 60° from the line of sight, period 0.491 d (Morin et al., arXiv:1005.5552, Table 1: rotation period 0.491 d and an axis 60 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 21 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 6 of 2 March 2007 to 7 March 2007 (program 07AF13); 6 of 19 January 2008 to 22 January 2008 (programs 07BF28B, 07BF29B); 9 of 8 January 2009 to 10 January 2009 (program 08BF10).
  The programs `gj-1156-2007-03`, `gj-1156-2008-01`, `gj-1156-2009-01` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 5,121 atomic lines in a 3,110 K, log g 5.03 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
60°, an equatorial period of 0.491 days and a projected rotation speed of 17 km/s
(Morin); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±600 G, serves
the 3 maps.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 49 (March 2022; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is the light curve [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether it shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Mar 2007: the map reaches a reduced chi-square of 1.25, against 1.53 with no field; mean field 118.8 G, 8% of its energy toroidal. Morin, J. et al., arXiv:1005.5552 give 60 G and 12% for this run (instruments ESPaDOnS; maxG: 320; poloidalPct: 88; axisymmetricPct: 6; axisymmetricOf: total energy; two definitions printed as x/y).
- Jan 2008: the map reaches a reduced chi-square of 1.40, against 1.64 with no field; mean field 104.8 G, 23% of its energy toroidal. Morin, J. et al., arXiv:1005.5552 give 100 G and 17% for this run (instruments ESPaDOnS; maxG: 360; poloidalPct: 83; axisymmetricPct: 20; axisymmetricOf: total energy; two definitions printed as x/y).
- Jan 2009: the map reaches a reduced chi-square of 1.15, against 1.32 with no field; mean field 66.9 G, 4% of its energy toroidal. Morin, J. et al., arXiv:1005.5552 give 90 G and 6% for this run (instruments ESPaDOnS; maxG: 360; poloidalPct: 94; axisymmetricPct: 2; axisymmetricOf: total energy; two definitions printed as x/y).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 49 gives a period of 0.48 d from the autocorrelation, whose peaks have a height of 0.50, a width of 0.49 and a fit of 0.99. The star's period is 0.48 d. The light varies by 1.5% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 0.491 d from the catalogues. The map's light curve leaves a scatter of 0.58% about the light, whose own noise is 0.30%. Gaia DR3 lists 3 other stars within 63 arcseconds, with 0.27% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 60°. The map is of March 2022: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

