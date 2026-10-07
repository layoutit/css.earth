# EQ Pegasi A

## Sources

Morin et al. give it 0.35 solar radii, 0.39 solar masses, a rotation period of 1.06 days and an axis tilted 60° from the line of sight. The introduction is generated from Morin et al., arXiv:0808.1423's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2824770686019003904, parallax 159.663 ± 0.034 mas (6.26 pc). Radius 0.35 solar radii from Morin et al., arXiv:0808.1423, Table 1: radius 0.35 solar radii (theoretical radius; R sin i = 0.37(2)) (https://arxiv.org/abs/0808.1423). Mass 0.39 solar masses from Morin et al., arXiv:0808.1423, Table 1: mass 0.39 solar masses (https://arxiv.org/abs/0808.1423). Temperature 3,345 K from TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 247985094: Teff. log g 4.94 from the mass and radius.

**Color.** A Planck spectrum at 3,345 K, because the Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 23317+1956 WIR 1 AB: 5.2 arcsec apart, magnitudes 10.52 and 12.4: the companion gives 15.0% of the light, which a measured spectrum would blend with the star's. The color is the Planck spectrum at the star's temperature, through the CIE 1931 2° observer: #ffc382. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,345 K and log g 4.94 (u1 0.157, u2 0.453): a model, because no fit of this star's limb is used.

**Spin.** 60° from the line of sight, period 1.06 d (Morin et al., arXiv:0808.1423, Table 1: rotation period 1.06 d and an axis 60 degrees from the line of sight, the values its magnetic maps were made with). The axis's direction on the sky is unmeasured and set toward celestial north.
- **Magnetic maps.** 15 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 15 of 5 August 2006 to 12 August 2006 (program 06BF10).
  The programs `eq-peg-a-2006-08` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 5,977 atomic lines in a 3,345 K, log g 4.83 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
60°, an equatorial period of 1.06 days and a projected rotation speed of 17.5 km/s
(Morin); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±1500 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 56 and 83 (the newest of September 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-06 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Aug 2006: the map reaches a reduced chi-square of 1.05, against 15.43 with no field; mean field 508.8 G, 13% of its energy toroidal. Morin, J. et al., arXiv:0808.1423 (Mon.Not.Roy.Astron.Soc.390:567-581,2010) give 480 G and 15% for this run (instruments ESPaDOnS; poloidalPct: 85; axisymmetricPct: 69; axisymmetricOf: total energy; first value m = 0, second m < l/2).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 56 gives a period of 1.08 d from the autocorrelation, whose peaks have a height of 0.65, a width of 0.47 and a fit of 1.00; Sector 83 gives a period of 1.08 d from the autocorrelation, whose peaks have a height of 0.32, a width of 0.48 and a fit of 0.99. All 2 together give a period of 1.08 d from the autocorrelation, whose peaks have a height of 0.57, a width of 0.48 and a fit of 1.00, which is the star's period: 1.08 d. The light varies by 3.3% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 1.061 d from the catalogues. The map's light curve leaves a scatter of 0.76% about the light, whose own noise is 0.64%. Gaia DR3 lists 8 other stars within 63 arcseconds, with 21% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 60°. The map is of September 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

