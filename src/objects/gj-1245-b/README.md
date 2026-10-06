# GJ 1245 B

## Sources

Morin et al. give it 0.14 solar radii, 0.12 solar masses, a rotation period of 17 hours and an axis tilted 40° from the line of sight. The introduction is generated from Morin et al., arXiv:1005.5552's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2079073928612821760, parallax 214.575 ± 0.048 mas (4.66 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.14 solar radii from Morin et al., arXiv:1005.5552, Table 1: radius 0.14 solar radii (theoretical radius) (https://arxiv.org/abs/1005.5552). Mass 0.12 solar masses from Morin et al., arXiv:1005.5552, Table 1: mass 0.12 solar masses (https://arxiv.org/abs/1005.5552). Temperature 2,865 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 274127413: Teff. log g 5.22 from the mass and radius.

**Color.** A Planck spectrum at 2,865 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 19539+4425 GIC 159 AB: 6 arcsec apart, magnitudes 14.26 and 14.96: the companion gives 34.4% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffb364. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 2,865 K and log g 5.22 (u1 0.228, u2 0.546): a model, because no fit of this star's limb is used.

**Spin.** 40° from the line of sight, period 0.71 d (Morin et al., arXiv:1005.5552, Table 1: rotation period 0.71 d and an axis 40 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 12 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 6 of 5 August 2006 to 12 August 2006 (program 06BF10); 6 of 30 September 2007 to 3 October 2007 (program 07BC10A).
  The programs `gj-1245-b-2006-08`, `gj-1245-b-2007-09` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 4,600 atomic lines in a 2,865 K, log g 5.2 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
40°, an equatorial period of 0.71 days and a projected rotation speed of 7 km/s
(Morin); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±500 G, serves
the 2 maps. Not mapped: 10 spectra of 20 August 2008 to 22 August 2008: the field is not detected.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Aug 2006: the map reaches a reduced chi-square of 1.50, against 1.98 with no field; mean field 97.9 G, 8% of its energy toroidal. Morin, J. et al., arXiv:1005.5552 give 170 G and 20% for this run (instruments ESPaDOnS; maxG: 470; poloidalPct: 80; axisymmetricPct: 15; axisymmetricOf: total energy; two definitions printed as x/y).
- Oct 2007: the map reaches a reduced chi-square of 1.40, against 2.15 with no field; mean field 122.3 G, 4% of its energy toroidal. Morin, J. et al., arXiv:1005.5552 give 180 G and 16% for this run (instruments ESPaDOnS; maxG: 580; poloidalPct: 84; axisymmetricPct: 52; axisymmetricOf: total energy; two definitions printed as x/y).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

