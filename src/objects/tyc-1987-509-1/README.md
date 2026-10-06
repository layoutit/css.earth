# TYC 1987-509-1

## Sources

Folsom et al. give it 0.83 solar radii, 0.9 solar masses, a rotation period of 9.43 days and an axis tilted 67° from the line of sight. The introduction is generated from Folsom et al., arXiv:1711.08636's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4019588600164776448, parallax 11.270 ± 0.019 mas (88.73 pc). Radius 0.83 solar radii from Folsom et al., arXiv:1711.08636, Table 2: radius 0.83 solar radii (https://arxiv.org/abs/1711.08636). Mass 0.9 solar masses from Folsom et al., arXiv:1711.08636, Table 2: mass 0.9 solar masses (https://arxiv.org/abs/1711.08636). Temperature 5,340 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 307751624: Teff. log g 4.55 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4019588600164776448, through the CIE 1931 2° observer: #ffeadf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,340 K and log g 4.55 (u1 0.563, u2 0.191): a model, because no fit of this star's limb is used.

**Spin.** 67° from the line of sight, period 9.43 d (Folsom et al., arXiv:1711.08636, Table 2: rotation period 9.43 d and an axis 67 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 15 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 15 of 25 March 2015 to 10 April 2015 (programs 15AP19, 15AP20).
  The programs `tyc-1987-509-1-2015-03` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 7,604 atomic lines in a 5,340 K, log g 4.57 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
67°, an equatorial period of 9.43 days and a projected rotation speed of 4.88 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±50 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Apr 2015: the map reaches a reduced chi-square of 1.40, against 5.17 with no field; mean field 22.5 G, 53% of its energy toroidal. Folsom, C. P. et al., arXiv:1711.08636 give 25 G and 44.3% for this run (instruments ESPaDOnS; maxG: 62.8; poloidalPct: 55.7; axisymmetricPct: 59.4; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

