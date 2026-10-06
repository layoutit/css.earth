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

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. The four stars in the app, headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's color, with its planet's orbit crossing the view.
- Dec 2007: the map reaches a reduced chi-square of 1.30, against 1.91 with no field; mean field 20.3 G, 57% of its energy toroidal.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,076 K (the record) and log g 4.32 (from the record's mass and radius (packages/astronomy/data/bodies/af-lep.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 22 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

