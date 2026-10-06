# TYC 5164-567-1

## Sources

Folsom et al. give it 0.89 solar radii, 0.9 solar masses, a rotation period of 4.68 days and an axis tilted 65° from the line of sight. The introduction is generated from Folsom et al., arXiv:1601.00684's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4222102218052861440, parallax 14.877 ± 0.015 mas (67.22 pc). Radius 0.89 solar radii from Folsom et al., arXiv:1601.00684, Table 2: radius 0.89 solar radii (https://arxiv.org/abs/1601.00684). Mass 0.9 solar masses from Folsom et al., arXiv:1601.00684, Table 2: mass 0.9 solar masses (https://arxiv.org/abs/1601.00684). Temperature 5,151 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 243635796: Teff. log g 4.49 from the mass and radius.

**Color.** A Planck spectrum at 5,151 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 20048-0239 ELP 45 AB: 2.7 arcsec apart, magnitudes 8.05 and 10.31: the companion gives 11.1% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,151 K and log g 4.49 (u1 0.614, u2 0.153): a model, because no fit of this star's limb is used.

**Spin.** 65° from the line of sight, period 4.68 d (Folsom et al., arXiv:1601.00684, Table 2: rotation period 4.68 d and an axis 65 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 19 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 19 of 15 June 2013 to 1 July 2013 (program 13AF04).
  The programs `tyc-5164-567-1-2013-06` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 8,161 atomic lines in a 5,151 K, log g 4.54 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
65°, an equatorial period of 4.68 days and a projected rotation speed of 9.6 km/s
(Folsom); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±200 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Jun 2013: the map reaches a reduced chi-square of 1.20, against 4.06 with no field; mean field 74.4 G, 8% of its energy toroidal. Folsom, C. P. et al., arXiv:1601.00684 give 63.9 G and 10.6% for this run (instruments ESPaDOnS; maxG: 145.5; poloidalPct: 89.4; axisymmetricPct: 67.3; axisymmetricOf: total energy).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

