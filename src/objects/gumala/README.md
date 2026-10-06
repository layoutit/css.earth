# Gumala

## Sources

Gaia's parallax, brightness and spectrum give it 1.3 solar radii and 1.11 solar masses (FLAME) and 6,068 K at its surface (GSP-Phot). It is also HD 179949, HR 7291, HIP 94645. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6770313530317154560, parallax 36.312 ± 0.037 mas (27.54 pc). Radius 1.274 (1.249 to 1.300) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 1.111 (1.071 to 1.151) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 6,068 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 6770313530317154560: teff_gspphot 6067.7993 K (16th-84th percentiles 6066.251-6069.3955), the temperature FLAME used. log g 4.27 from the mass and radius.

**Color.** A Planck spectrum at 6,068 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #fff4f2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,068 K and log g 4.27 (u1 0.403, u2 0.292): a model, because no fit of this star's limb is used.
- **Magnetic maps.** 18 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 18 of 25 September 2009 to 10 October 2009 (programs 09BC19, 09BF05).
  The programs `hd-179949-2009-09` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size, and the receipt beside each records what every step measured. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 6,650 atomic lines in a 6,148 K, log g 4.32 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
60°, an equatorial period of 7.62 days, the poles turning 0.216 rad/day slower and a projected rotation speed of 7.02 km/s
(Fares et al. (2012)); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±10 G, serves
the map. Not mapped: 10 spectra of 23 June 2007 to 4 July 2007: the field is not detected.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Oct 2009: the map reaches a reduced chi-square of 1.00, against 2.89 with no field; mean field 3.1 G, 8% of its energy toroidal.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 179949" (revision 1374435608) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 21 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

