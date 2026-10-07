# HD 6569

## Sources

Folsom et al. give it 0.76 solar radii, 0.85 solar masses, a rotation period of 7.13 days and an axis tilted 77° from the line of sight. It is also HIP 5191. The introduction is generated from Folsom et al., arXiv:1711.08636's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2371914419569515136, parallax 21.994 ± 0.018 mas (45.47 pc). Radius 0.76 solar radii from Folsom et al., arXiv:1711.08636, Table 2: radius 0.76 solar radii (https://arxiv.org/abs/1711.08636). Mass 0.85 solar masses from Folsom et al., arXiv:1711.08636, Table 2: mass 0.85 solar masses (https://arxiv.org/abs/1711.08636). Temperature 5,024 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 66534229: Teff. log g 4.61 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2371914419569515136, through the CIE 1931 2° observer: #ffe2ce. Routes tried in order: stis-ngsl: HD 6569 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,024 K and log g 4.61 (u1 0.651, u2 0.124): a model, because no fit of this star's limb is used.

**Spin.** 77° from the line of sight, period 7.13 d (Folsom et al., arXiv:1711.08636, Table 2: rotation period 7.13 d and an axis 77 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 12 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 12 of 19 September 2015 to 30 September 2015 (program 15BP19).
  The programs `hd-6569-2015-09` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 8,424 atomic lines in a 5,024 K, log g 4.58 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
77°, an equatorial period of 7.13 days and a projected rotation speed of 5.25 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±30 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 3 (September and October 2018; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is among the light curves [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954) searched for rotation, and the star's row in their table (VizieR J/AJ/167/189/fig12) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Sep 2015: the map reaches a reduced chi-square of 1.80, against 3.04 with no field; mean field 14.6 G, 10% of its energy toroidal. Folsom, C. P. et al., arXiv:1711.08636 give 25 G and 40% for this run (instruments ESPaDOnS; maxG: 48.6; poloidalPct: 60; axisymmetricPct: 85.2; axisymmetricOf: total energy).

**Brightness from TESS.** Colman et al. (2024, AJ 167, 189) ask a sector's light to pass both of the paper's random-forest classifiers (rotation detected; period accurate) with a Lomb-Scargle amplitude of at least 0.01. Their table (VizieR J/AJ/167/189/fig12) gives a rotation period of 7.48 d, the highest peak of the Lomb-Scargle periodogram of the star's one sector among sectors 1 to 26, which passed both of the paper's classifiers: the star's period is 7.48 d, as published, and no criteria were applied to it here. The light varies by 2.1% (the range between its 5th and 95th percentiles, as the table prints it). On the paper's blind test set its first classifier turned away 82% of the stars with no rotation and its second 95% of the inaccurate periods. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 2 sectors, and Holcomb et al. (2022) ask for at least 1. The star's record holds 7.13 d from the catalogues. The map's light curve leaves a scatter of 0.16% about the light, whose own noise is 0.05%. Gaia DR3 lists 5 other stars within 63 arcseconds, with 3.5% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 77°. The map is of September and October 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

