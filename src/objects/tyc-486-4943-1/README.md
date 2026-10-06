# TYC 486-4943-1

## Sources

Folsom et al. give it 0.69 solar radii, 0.75 solar masses, a rotation period of 3.75 days and an axis tilted 75° from the line of sight. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4289366113217575424, parallax 14.233 ± 0.014 mas (70.26 pc). Radius 0.69 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 0.69 solar radii (https://arxiv.org/abs/1601.00684). Mass 0.75 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 0.75 solar masses (https://arxiv.org/abs/1601.00684). Temperature 4,663 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 212488763: Teff. log g 4.64 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4289366113217575424, through the CIE 1931 2° observer: #ffd6bb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,663 K and log g 4.64 (u1 0.743, u2 0.047): a model, because no fit of this star's limb is used.

**Spin.** 75° from the line of sight, period 3.75 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 3.75 d and an axis 75 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 15 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 15 of 24 June 2013 to 1 July 2013 (program 13AF04).
  The programs `tyc-0486-4943-1-2013-06` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 9,061 atomic lines in a 4,663 K, log g 4.61 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
75°, an equatorial period of 3.75 days and a projected rotation speed of 10.9 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±50 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Jun 2013: the map reaches a reduced chi-square of 1.50, against 2.14 with no field; mean field 11.7 G, 8% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 25 G and 24.3% for this run (instruments ESPaDOnS; maxG: 71.5; poloidalPct: 75.7; axisymmetricPct: 24.8; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

