# AF Lep

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

AF Lep is a young star in the beta Pictoris moving group, 24 million years old. Its pull on the star led astronomers to its planet b in 2023.

## Sources

**Placement.** Gaia DR3 source 3009908378049913216 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-af-lep.json)).

**Radius, temperature and mass.** 6,076 +180/−92 K from the high-resolution spectroscopic analysis of Baburaj et al. ([2026](https://arxiv.org/abs/2608.15912)), section 5.1, and 1.20 ± 0.06 solar masses from their Table 1; 1.25 ± 0.06 solar radii from Kervella et al. (2004), the value Franson et al. ([2023](https://arxiv.org/abs/2302.05420)) adopt. A model radius: the disc is not measured.

**Radial velocity.** Gaia DR3's 21.10 ± 0.37 km/s.

**Color dataset.** The color of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,076 K (the record) and log g 4.32 (from the record's mass and radius (packages/astronomy/data/bodies/af-lep.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).
- **Magnetic maps.** 19 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 19 of 27 December 2007 to 30 December 2007 (programs 07BF16, 07BO01).
  The programs `af-lep-2007-12` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 6,367 atomic lines in a 6,409 K, log g 4.48 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
56.7°, an equatorial period of 0.966 days and a projected rotation speed of 54.7 km/s
(src/objects/af-lep/source/measurements.json); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±150 G, serves
the map.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 5, 6, 32 and 98 (the newest of November 2025 to January 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. The four stars in the app, headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's color, with its planet's orbit crossing the view.
- Dec 2007: the map reaches a reduced chi-square of 1.30, against 1.91 with no field; mean field 20.3 G, 57% of its energy toroidal.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 5 gives a period of 1.01 d from the autocorrelation, whose peaks have a height of 0.77, a width of 0.50 and a fit of 1.00; Sector 6 gives a period of 1.02 d from the autocorrelation, whose peaks have a height of 0.72, a width of 0.49 and a fit of 1.00; Sector 32 gives a period of 1.01 d from the autocorrelation, whose peaks have a height of 0.74, a width of 0.47 and a fit of 1.00; Sector 98 gives a period of 0.99 d from the autocorrelation, whose peaks have a height of 0.61, a width of 0.47 and a fit of 1.00. All 4 together give a period of 1.01 d from the autocorrelation, whose peaks have a height of 0.72, a width of 0.49 and a fit of 1.00, which is the star's period: 1.01 d. The light varies by 4.3% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 0.966 d from the catalogues. The map's light curve leaves a scatter of 0.78% about the light, whose own noise is 0.11%. Gaia DR3 lists 13 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,076 K (the record) and log g 4.32 (from the record's mass and radius (packages/astronomy/data/bodies/af-lep.json)).

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 56.7°. The map is of November 2025 to January 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

