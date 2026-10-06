# BD-16 351

## Sources

Folsom et al. give it 0.88 solar radii, 0.9 solar masses, a rotation period of 3.21 days and an axis tilted 42° from the line of sight. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5147904718169224704, parallax 13.803 ± 0.058 mas (72.45 pc); its RUWE is 2.8, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.88 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 0.88 solar radii (https://arxiv.org/abs/1601.00684). Mass 0.9 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 0.9 solar masses (https://arxiv.org/abs/1601.00684). Temperature 5,291 K from SIMBAD, measurements of BD-16 351 (table mesFe_h), row of 2024A&A...690A..97C: Teff. log g 4.5 from the mass and radius.

**Color.** A Planck spectrum at 5,291 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 02016-1610 ELP 3: 0.5 arcsec apart, magnitudes 8.43 and 9.09: the companion gives 35.3% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffeada. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,291 K and log g 4.5 (u1 0.575, u2 0.182): a model, because no fit of this star's limb is used.

**Spin.** 42° from the line of sight, period 3.21 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 3.21 d and an axis 42 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 16 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 16 of 25 September 2012 to 1 October 2012 (program 12BE96).
  The programs `bd-16351-2012-09` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 6,903 atomic lines in a 5,291 K, log g 4.86 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
42°, an equatorial period of 3.21 days and a projected rotation speed of 10.2 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±200 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 3, 30 and 97 (the newest of September to November 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Sep 2012: the map reaches a reduced chi-square of 1.30, against 5.80 with no field; mean field 69.3 G, 57% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 49 G and 38.2% for this run (instruments ESPaDOnS; maxG: 209.3; poloidalPct: 61.8; axisymmetricPct: 41.1; axisymmetricOf: total energy).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 3 gives a period of 3.33 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.42 and a fit of 0.99; Sector 30 gives a period of 3.35 d from the autocorrelation, whose peaks have a height of 0.47, a width of 0.48 and a fit of 1.00; Sector 97 gives a period of 3.25 d from the autocorrelation, whose peaks have a height of 0.46, a width of 0.45 and a fit of 0.99. All 3 together give a period of 3.26 d from the autocorrelation, whose peaks have a height of 0.46, a width of 0.48 and a fit of 1.00, which is the star's period: 3.26 d. The light varies by 4.5% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.33% about the light, whose own noise is 0.04%. Gaia DR3 lists 3 other stars within 63 arcseconds, with 0.57% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 42°. The map is of September to November 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

