# Tania Borealis

## Sources

Its brightness, measured band by band, gives 62 times the Sun's luminosity at 8,901 K, so 3.321 solar radii. It is also HD 89021, HR 4033, HIP 50372. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 805881416880407936, distance 42 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: distance 42.158 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.033), at which the luminosity and radius hold; Gaia DR3's parallax, 14.459 ± 1.020 mas (14.2 standard errors), is not used. Radius 3.321 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: radius 3.321 solar radii, implied by the fitted luminosity 62.191 solar luminosities (fractional uncertainty 0.604) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,901 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 50372: effective temperature 8901 +/- 2820 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.056). log g 3.9 from 1995A&A...294..536H ("Compositional differences among the A-type stars. II. Spectrum synthesis up to v sin i = 110 km/s.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 570: HR 4033; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 805881416880407936 (20 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b8ceff. Routes tried in order: stis-ngsl: HD 89021 is not in the library; pulkovo: the spectrum was found but gives no color (A Pulkovo flux line is short:  320.0            .        0.0004430 0.0012930 0.0161000 0.0010410); kiehling: HR 4033 is not among its 60 stars; burnashev: BS 4033 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,901 K and log g 3.9 (u1 0.282, u2 0.317): a model, because no fit of this star's limb is used. Gravity: log g 3.9 from 1995A&A...294..536H, the median of its 2 spectra; the 2 published values span log g 3.9 to 3.9, across which the limb law changes by at most 0.0% of the centre brightness.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 21 (January and February 2020; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is the light curve [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether it shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 20 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 21 gives a period of 4.64 d from the autocorrelation, whose peaks have a height of 0.30, a width of 0.47 and a fit of 1.00; 1 more of the star's 2 sectors does not meet the criteria. All 2 together give a period of 2.31 d from the autocorrelation, whose peaks have a height of 0.21, a width of 0.47 and a fit of 1.00, which is the star's period: 2.31 d. The light varies by 0.02% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.004% about the light, whose own noise is 0.002%. Gaia DR3 lists 3 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Lambda Ursae Majoris" (revision 1374609513) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January and February 2020: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
