# V374 Pegasi

## Sources

Morin et al. give it 0.34 solar radii, 0.28 solar masses, a rotation period of 10.7 hours and an axis tilted 70° from the line of sight. It is also HIP 108706. The introduction is generated from Morin et al., arXiv:0711.1418's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1893189736896880640, parallax 109.855 ± 0.026 mas (9.10 pc). Radius 0.34 solar radii from Morin et al., arXiv:0711.1418, Sect. 7: radius 0.34 solar radii (R sin i = 0.32 +/- 0.01, R ~ 0.34 for i ~ 70 deg (Sect. 7)) (https://arxiv.org/abs/0711.1418). Mass 0.28 solar masses from Morin et al., arXiv:0711.1418, Sect. 7: mass 0.28 solar masses (0.28 +/- 0.05 from M_K (Sect. 7)) (https://arxiv.org/abs/0711.1418). Temperature 3,240 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 283410775: Teff. log g 4.82 from the mass and radius.

**Color.** A Planck spectrum at 3,240 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 22012+2818 RAO 691: 0.3 arcsec apart, magnitudes 10 and 11.9: the companion gives 14.8% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffbf7c. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,240 K and log g 4.82 (u1 0.158, u2 0.468): a model, because no fit of this star's limb is used.

**Spin.** 70° from the line of sight, period 0.4456 d (Morin et al., arXiv:0711.1418, Sect. 7: rotation period 0.4456 d and an axis 70 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 86 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 64 of 19 August 2005 to 23 August 2005 (program 05BF15); 22 of 5 August 2006 to 12 August 2006 (programs 06BD01, 06BF10).
  The programs `v374-peg-2005-08`, `v374-peg-2006-08` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 5,567 atomic lines in a 3,240 K, log g 4.91 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
70°, an equatorial period of 0.4456 days, the poles turning 0.0063 rad/day slower and a projected rotation speed of 36.5 km/s
(Morin); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±1200 G, serves
the 2 maps.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 15 and 56 (the newest of September 2022; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Aug 2005: the map reaches a reduced chi-square of 1.25, against 1.95 with no field; mean field 498.2 G, 2% of its energy toroidal. Morin, J. et al., arXiv:0711.1418 (Mon.Not.Roy.Astron.Soc.384:77-86,2008) give 800 G for this run (instruments ESPaDOnS; maxG: 1300; visiblePolePolarity: visible hemisphere mostly covered with positive radial field).
- Aug 2006: the map reaches a reduced chi-square of 1.05, against 2.01 with no field; mean field 578.0 G, 2% of its energy toroidal. Morin, J. et al., arXiv:0711.1418 (Mon.Not.Roy.Astron.Soc.384:77-86,2008) give 700 G and 4% for this run (maxG: 1200; poloidalPct: 96; axisymmetricPct: 80; axisymmetricOf: total reconstructed energy (m = 0 modes); visiblePolePolarity: as Aug05 (positive); dipoleNote: mode l=1, m=0 has amplitude 1.9 kG and holds 60% of the energy).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 15 gives a period of 0.48 d from the autocorrelation, whose peaks have a height of 0.76, a width of 0.50 and a fit of 0.99; Sector 56 gives a period of 0.48 d from the autocorrelation, whose peaks have a height of 0.75, a width of 0.50 and a fit of 0.99. All 2 together give a period of 0.48 d from the autocorrelation, whose peaks have a height of 0.75, a width of 0.50 and a fit of 0.99, which is the star's period: 0.48 d. The light varies by 2.3% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 0.45 d from the catalogues. The map's light curve leaves a scatter of 0.83% about the light, whose own noise is 0.29%. Gaia DR3 lists 15 other stars within 63 arcseconds, with 3.2% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 70°. The map is of September 2022: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

