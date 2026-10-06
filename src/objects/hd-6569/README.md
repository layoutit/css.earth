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

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Sep 2015: the map reaches a reduced chi-square of 1.80, against 3.04 with no field; mean field 14.6 G, 10% of its energy toroidal. Folsom, C. P. et al., arXiv:1711.08636 give 25 G and 40% for this run (instruments ESPaDOnS; maxG: 48.6; poloidalPct: 60; axisymmetricPct: 85.2; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

