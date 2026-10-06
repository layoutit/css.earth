# Tepiamenit

## Sources

Gaia's parallax, brightness and spectrum give it 1.5 solar radii and 1.25 solar masses (FLAME) and 6,319 K at its surface (GSP-Phot). It is also HD 120136, HR 5185, HIP 67275. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1244571953471006720, parallax 64.047 ± 0.109 mas (15.61 pc). Radius 1.489 (1.459 to 1.519) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 1.250 (1.210 to 1.290) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 6,319 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 1244571953471006720: teff_gspphot 6319.2407 K (16th-84th percentiles 6317.7007-6321.0938), the temperature FLAME used. log g 4.19 from the mass and radius.

**Color.** A Planck spectrum at 6,319 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #fff7f9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,319 K and log g 4.19 (u1 0.369, u2 0.307): a model, because no fit of this star's limb is used.
- **Magnetic maps.** 135 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 12 of 13 June 2006 to 19 June 2006 (programs 06AF7B, 06AH20A); 26 of 26 June 2007 to 5 July 2007 (programs 07AC027, 07AC27); 40 of 20 January 2008 to 30 January 2008 (programs 07BC17, 07BF10, 07BF17); 39 of 9 June 2016 to 24 June 2016 (program 16AF01); 18 of 31 December 2023 to 19 January 2024 (program 24AF19).
  The programs `tau-boo-2006-06`, `tau-boo-2007-06`, `tau-boo-2008-01`, `tau-boo-2016-06`, `tau-boo-2024-01` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum by
  its size, and the receipt beside each records what every step measured. The maps are the tables in
  `source/science/espadons/`.

**Magnetic maps.** The maps of these runs are made here, with the codes the method's authors publish and nothing of our
own in between ([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg
computes the depth of 6,169 atomic lines in a 6,466 K, log g 4.25 model atmosphere, LSDpy averages them into one
polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses a tilt of
45°, an equatorial period of 3.142 days, the poles turning 0.35 rad/day slower and a projected rotation speed of 14.27 km/s
(Mengel et al. (2016)); the page draws the star with the same tilt
([rotation.json](source/preparation/rotation.json)). Longitude 0 faces us at the middle of each run. One color scale, ±8 G, serves
the 5 maps. Not mapped: 56 spectra of 23 March 2005 to 25 March 2005: the field is not detected.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.
- Jun 2006: the map reaches a reduced chi-square of 1.15, against 1.82 with no field; mean field 1.6 G, 49% of its energy toroidal. Catala et al. (2007), MNRAS 374, L42 (arXiv:astro-ph/0610758) give 1.8 G for this run (The paper maps the run with a tilt of 40 degrees and v sin i 15.9 km/s).
- Jun 2007: the map reaches a reduced chi-square of 1.10, against 1.52 with no field; mean field 1.3 G, 11% of its energy toroidal.
- Jan 2008: the map reaches a reduced chi-square of 1.05, against 1.51 with no field; mean field 2.2 G, 61% of its energy toroidal. Fares et al. (2009), MNRAS, doi:10.1111/j.1365-2966.2009.15303.x (arXiv:0906.4515) give 3.1 G and 62% for this run (The paper maps the run with a tilt of 40 degrees and v sin i 15.9 km/s; this program uses 45 degrees and 14.27 km/s).
- Jun 2016: the map reaches a reduced chi-square of 1.05, against 1.18 with no field; mean field 1.9 G, 34% of its energy toroidal. Jeffers et al. (2018), MNRAS, doi:10.1093/mnras/sty1717 (arXiv:1805.09769) give 2.5 G and 36% for this run (The paper's maps of 2016 join NARVAL and ESPaDOnS spectra and split the season into four; this run covers its maps 2 and 3).
- Jan 2024: the map reaches a reduced chi-square of 1.20, against 1.63 with no field; mean field 1.5 G, 19% of its energy toroidal.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Tau Boötis" (revision 1374589362) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
- **The magnetic maps are this project's reduction, not published maps.** How tightly a map is fitted is a choice the
  mapping code leaves open; it is set on 21 published maps, whose mean fields the same recipe reproduces with a scatter of a
  factor 1.4. The direction of the axis on the sky is not measured, only its tilt toward us.

