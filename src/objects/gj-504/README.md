# GJ 504

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

GJ 504 is a Sun-like star whose measured size allows two ages, 21 million or 4 billion years. The answer decides whether its companion b is a planet or a brown dwarf.

## Sources

**Placement.** Gaia DR3 source 3732539683617410816 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-gj-504.json)).

**Radius, temperature and mass.** A measured radius: 1.35 ± 0.04 solar radii from the star's limb-darkened angular diameter, 0.71 ± 0.02 mas with VEGA on the CHARA array, at the Hipparcos parallax (Bonnefoy et al. [2018](https://arxiv.org/abs/1807.00657), A&A 618, A63, section 2.3). 6,200 K from their fit to its spectral energy distribution (Appendix A), close to the spectroscopic solution of D'Orazi et al. ([2017](https://arxiv.org/abs/1609.02530)). The 1.2 solar masses is the value they assume in their spot model.

**Two ages.** The radius fits isochrones at 21 ± 2 million or 4.0 ± 1.8 billion years (Bonnefoy et al. 2018). The companion's mass follows: about 1.3 Jupiter masses if young, about 23 if old. JWST's spectrum of the companion points to the old age (Baburaj et al. 2026; see [GJ 504 b](../gj-504-b/README.md)).

**Radial velocity.** Gaia DR3's -27.25 ± 0.13 km/s.

**Color dataset.** Gaia DR3 publishes no sampled spectrum of this bright star, so the color is a Planck spectrum at its published temperature, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,200 K (the record) and log g 4.26 (from the record's mass and radius (packages/astronomy/data/bodies/gj-504.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).
- **Magnetic maps.** 19 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 19 of 5 April 2025 to 9 April 2025 (program 25AF14).
  The programs `gj-504-2025-04` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 7,044 atomic lines in a 6,029 K, log g 4.23 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
18.6°, an equatorial period of 3.33 days and a projected rotation speed of 6.5 km/s
(Bonnefoy et al. (2018)); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±15 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 23 and 50 (the newest of March and April 2022; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. The four stars in the app, headless Chromium at 800 × 600 on this version: each is drawn in its measured color.
- Apr 2025: the map reaches a reduced chi-square of 1.30, against 2.08 with no field; mean field 4.6 G, 19% of its energy toroidal.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 23 gives a period of 3.46 d from the autocorrelation, whose peaks have a height of 0.29, a width of 0.48 and a fit of 1.00; Sector 50 gives a period of 3.49 d from the autocorrelation, whose peaks have a height of 0.28, a width of 0.48 and a fit of 1.00. All 2 together give a period of 3.44 d from the autocorrelation, whose peaks have a height of 0.28, a width of 0.48 and a fit of 1.00, which is the star's period: 3.44 d. The light varies by 0.54% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 3.33 d from the catalogues. The map's light curve leaves a scatter of 0.07% about the light, whose own noise is 0.01%. Gaia DR3 lists 4 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,200 K (the record) and log g 4.26 (from the record's mass and radius (packages/astronomy/data/bodies/gj-504.json)).

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 18.6°. The map is of March and April 2022: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 21 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

