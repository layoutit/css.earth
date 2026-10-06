# TYC 6878-195-1

## Sources

Folsom et al. give it 1.37 solar radii, 1.17 solar masses, a rotation period of 5.7 days and an axis tilted 68° from the line of sight. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6764026419748892160, parallax 14.769 ± 0.212 mas (67.71 pc); its RUWE is 12.0, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 1.37 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 1.37 solar radii (https://arxiv.org/abs/1601.00684). Mass 1.17 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 1.17 solar masses (https://arxiv.org/abs/1601.00684). Temperature 4,600 K from Pecaut & Mamajek (2013, ApJS 208, 9), the online table's version 2022.04.16, row K4V, for SIMBAD's spectral type K4V(e): Teff. log g 4.23 from the mass and radius.

**Color.** A Planck spectrum at 4,600 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,600 K and log g 4.23 (u1 0.763, u2 0.033): a model, because no fit of this star's limb is used.

**Spin.** 68° from the line of sight, period 5.7 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 5.7 d and an axis 68 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 16 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 16 of 15 June 2013 to 1 July 2013 (program 13AF04).
  The programs `tyc-6878-0195-1-2013-06` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 9,196 atomic lines in a 4,600 K, log g 4.6 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
68°, an equatorial period of 5.7 days and a projected rotation speed of 11.2 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±200 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Jun 2013: the map reaches a reduced chi-square of 1.25, against 6.03 with no field; mean field 66.7 G, 32% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 55.3 G and 31% for this run (instruments ESPaDOnS; maxG: 198.2; poloidalPct: 69; axisymmetricPct: 36; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

