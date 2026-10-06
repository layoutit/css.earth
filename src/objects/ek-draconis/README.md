# EK Draconis

## Sources

Waite et al. give it 0.94 solar radii, 0.95 solar masses, a rotation period of 2.77 days and an axis tilted 60° from the line of sight. It is also HD 129333, HIP 71631. The introduction is generated from Waite et al., arXiv:1611.07751's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1668690628102524672, parallax 29.066 ± 0.022 mas (34.40 pc); its RUWE is 1.4, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.94 solar radii from Waite et al., arXiv:1611.07751, Table 1: radius 0.94 solar radii (https://arxiv.org/abs/1611.07751). Mass 0.95 solar masses from Waite et al., arXiv:1611.07751, Table 1: mass 0.95 solar masses (https://arxiv.org/abs/1611.07751). Temperature 5,647 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 159613900: Teff. log g 4.47 from the mass and radius.

**Color.** A Planck spectrum at 5,647 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 14390+6417 KON 1: 0.8 arcsec apart, magnitudes 6 and 8.9: the companion gives 6.5% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffefe6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,647 K and log g 4.47 (u1 0.488, u2 0.242): a model, because no fit of this star's limb is used.

**Spin.** 60° from the line of sight, period 2.766 d (Waite et al., arXiv:1611.07751, Table 1: rotation period 2.766 d and an axis 60 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 9 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 9 of 30 November 2006 to 11 December 2006 (programs 06BC10, 06BF08, 06BF42).
  The programs `ek-dra-2006-11` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 6,541 atomic lines in a 5,647 K, log g 4.45 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
60°, an equatorial period of 2.766 days, the poles turning 0.27 rad/day slower and a projected rotation speed of 16.4 km/s
(Waite); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±150 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 14, 15, 16, 21, 22, 23, 41, 75 and 76 (the newest of February and March 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Dec 2006: the map reaches a reduced chi-square of 1.25, against 8.51 with no field; mean field 92.8 G, 80% of its energy toroidal. Waite, Ian et al., arXiv:1611.07751 give 90 G and 83% for this run (instruments ESPaDOnS; poloidalPct: 17).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 14 gives a period of 2.69 d from the autocorrelation, whose peaks have a height of 0.54, a width of 0.48 and a fit of 0.99; Sector 15 gives a period of 2.74 d from the autocorrelation, whose peaks have a height of 0.53, a width of 0.45 and a fit of 0.99; Sector 16 gives a period of 2.65 d from the autocorrelation, whose peaks have a height of 0.45, a width of 0.48 and a fit of 1.00; Sector 21 gives a period of 2.67 d from the autocorrelation, whose peaks have a height of 0.62, a width of 0.47 and a fit of 1.00; Sector 22 gives a period of 2.65 d from the autocorrelation, whose peaks have a height of 0.50, a width of 0.46 and a fit of 1.00; Sector 23 gives a period of 2.73 d from the autocorrelation, whose peaks have a height of 0.40, a width of 0.50 and a fit of 0.99; Sector 41 gives a period of 2.82 d from the autocorrelation, whose peaks have a height of 0.57, a width of 0.48 and a fit of 1.00; Sector 75 gives a period of 2.72 d from the autocorrelation, whose peaks have a height of 0.37, a width of 0.47 and a fit of 0.97; Sector 76 gives a period of 2.66 d from the autocorrelation, whose peaks have a height of 0.44, a width of 0.42 and a fit of 0.99; 3 more of the star's 12 sectors do not meet the criteria. All 12 together give a period of 2.68 d from the autocorrelation, whose peaks have a height of 0.59, a width of 0.46 and a fit of 1.00, which is the star's period: 2.68 d. The light varies by 3.0% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 2.64 d from the catalogues. The map's light curve leaves a scatter of 0.44% about the light, whose own noise is 0.07%. Gaia DR3 lists 2 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 60°. The map is of February and March 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

