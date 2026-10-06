# TYC 6349-200-1

## Sources

Folsom et al. give it 0.96 solar radii, 0.85 solar masses, a rotation period of 3.41 days and an axis tilted 52° from the line of sight. It is also HD 358623. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6882838031333427456, parallax 21.699 ± 0.021 mas (46.09 pc). Radius 0.96 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 0.96 solar radii (https://arxiv.org/abs/1601.00684). Mass 0.85 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 0.85 solar masses (https://arxiv.org/abs/1601.00684). Temperature 4,144 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 206190624: Teff. log g 4.4 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6882838031333427456, through the CIE 1931 2° observer: #ffc6a1. Routes tried in order: stis-ngsl: HD 358623 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,144 K and log g 4.4 (u1 0.736, u2 0.054): a model, because no fit of this star's limb is used.

**Spin.** 52° from the line of sight, period 3.41 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 3.41 d and an axis 52 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 16 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 16 of 15 June 2013 to 30 June 2013 (program 13AF04).
  The programs `tyc-6349-0200-1-2013-06` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 10,118 atomic lines in a 4,144 K, log g 4.26 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
52°, an equatorial period of 3.41 days and a projected rotation speed of 15.8 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±200 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Jun 2013: the map reaches a reduced chi-square of 1.25, against 3.29 with no field; mean field 65.4 G, 35% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 59.8 G and 22.1% for this run (instruments ESPaDOnS; maxG: 184.6; poloidalPct: 77.9; axisymmetricPct: 30.2; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

