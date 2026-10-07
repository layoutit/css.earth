# HIP 12545

## Sources

Folsom et al. give it 1.07 solar radii, 0.95 solar masses, a rotation period of 4.83 days and an axis tilted 39° from the line of sight. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 18211043587721088, parallax 22.575 ± 0.022 mas (44.30 pc). Radius 1.07 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 1.07 solar radii (https://arxiv.org/abs/1601.00684). Mass 0.95 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 0.95 solar masses (https://arxiv.org/abs/1601.00684). Temperature 4,100 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 318785502: Teff. log g 4.36 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 18211043587721088, through the CIE 1931 2° observer: #ffc9a7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,100 K and log g 4.36 (u1 0.724, u2 0.065): a model, because no fit of this star's limb is used.

**Spin.** 39° from the line of sight, period 4.83 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 4.83 d and an axis 39 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 16 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 16 of 25 September 2012 to 1 October 2012 (program 12BE96).
  The programs `hip-12545-2012-09` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 10,178 atomic lines in a 4,100 K, log g 4.22 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
39°, an equatorial period of 4.83 days and a projected rotation speed of 10.2 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±800 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 4, 31, 42, 70 and 71 (the newest of October and November 2023; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Sep 2012: the map reaches a reduced chi-square of 1.10, against 23.48 with no field; mean field 132.9 G, 29% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 115.7 G and 43% for this run (instruments ESPaDOnS; maxG: 418.4; poloidalPct: 57; axisymmetricPct: 59.6; axisymmetricOf: total energy).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 4 gives a period of 4.92 d from the autocorrelation, whose peaks have a height of 0.39, a width of 0.47 and a fit of 1.00; Sector 31 gives a period of 4.86 d from the autocorrelation, whose peaks have a height of 0.33, a width of 0.45 and a fit of 0.98; Sector 42 gives a period of 4.94 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.47 and a fit of 1.00; Sector 70 gives a period of 4.92 d from the autocorrelation, whose peaks have a height of 0.38, a width of 0.48 and a fit of 1.00; Sector 71 gives a period of 4.90 d from the autocorrelation, whose peaks have a height of 0.40, a width of 0.48 and a fit of 1.00. All 5 together give a period of 4.71 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.51 and a fit of 1.00, which is the star's period: 4.71 d. The light varies by 11% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 4.83 d from the catalogues. The map's light curve leaves a scatter of 1.8% about the light, whose own noise is 0.72%. Gaia DR3 lists no other star within 63 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 39°. The map is of October and November 2023: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

