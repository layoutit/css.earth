# Kepler-78

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2078373642776670080, parallax 8.008 ± 0.010 mas (124.87 pc). Radius 0.7475 +/- 0.0077 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.779 +/- 0.032 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,058 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-78 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2078373642776670080, through the CIE 1931 2° observer: #ffe1cc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,058 K and log g 4.58 (u1 0.641, u2 0.132): a model, because no fit of this star's limb is used.
- **Magnetic maps.** 13 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 13 of 23 July 2015 to 29 August 2015 (programs 15AC21, 15AF09, 15BD96).
  The programs `kepler-78-2015-08` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 8,467 atomic lines in a 5,076 K, log g 4.64 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
80°, an equatorial period of 12.588 days and a projected rotation speed of 3 km/s
(Moutou et al. (2016)); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±20 G, serves
the map.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Aug 2015: the map reaches a reduced chi-square of 1.20, against 1.98 with no field; mean field 11.9 G, 74% of its energy toroidal. Moutou et al. (2016, MNRAS; arXiv:1605.03255) give 16 G and 40% for this run.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-78" (revision 1370781331) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 21 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

