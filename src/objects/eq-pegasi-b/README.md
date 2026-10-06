# EQ Pegasi B

## Sources

Morin et al. give it 0.25 solar radii, 0.25 solar masses, a rotation period of 9.72 hours and an axis tilted 60° from the line of sight. The introduction is generated from Morin et al., arXiv:0808.1423's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2824770686019004032, parallax 159.908 ± 0.051 mas (6.25 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.25 solar radii from Morin et al., arXiv:0808.1423, Table 1: radius 0.25 solar radii (theoretical radius; R sin i = 0.23(1)) (https://arxiv.org/abs/0808.1423). Mass 0.25 solar masses from Morin et al., arXiv:0808.1423, Table 1: mass 0.25 solar masses (https://arxiv.org/abs/0808.1423). Temperature 3,210 K from Pecaut & Mamajek (2013, ApJS 208, 9), the online table's version 2022.04.16, row M4V, for SIMBAD's spectral type M4.0Ve: Teff. log g 5.04 from the mass and radius.

**Color.** A Planck spectrum at 3,210 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffbe7a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,210 K and log g 5.04 (u1 0.153, u2 0.477): a model, because no fit of this star's limb is used.

**Spin.** 60° from the line of sight, period 0.405 d (Morin et al., arXiv:0808.1423, Table 1: rotation period 0.405 d and an axis 60 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 14 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 14 of 5 August 2006 to 12 August 2006 (program 06BF10).
  The programs `eq-peg-b-2006-08` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 5,513 atomic lines in a 3,210 K, log g 4.92 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
60°, an equatorial period of 0.405 days and a projected rotation speed of 28.5 km/s
(Morin); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±2000 G, serves
the map.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Aug 2006: the map reaches a reduced chi-square of 1.10, against 1.50 with no field; mean field 441.7 G, 10% of its energy toroidal. Morin, J. et al., arXiv:0808.1423 (Mon.Not.Roy.Astron.Soc.390:567-581,2010) give 450 G and 3% for this run (instruments ESPaDOnS; poloidalPct: 97; axisymmetricPct: 92; axisymmetricOf: total energy; first value m = 0, second m < l/2; visiblePolePolarity: hemisphere facing the observer mainly covered by positive (emerging) radial field, with a strong 1.2 kG spot).

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

