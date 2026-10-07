# Dalim

## Sources

Its brightness, measured band by band, gives 4.705 times the Sun's luminosity at 6,055 K, so 1.974 solar radii. It is also HD 20010, HR 963, HIP 14879. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5059348952161258624, distance 14 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14879: distance 14.237 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.006), at which the luminosity and radius hold; Gaia DR3's parallax, 71.434 ± 0.132 mas (541.3 standard errors), is not used. Radius 1.974 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14879: radius 1.974 solar radii, implied by the fitted luminosity 4.705 solar luminosities (fractional uncertainty 0.042) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,055 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 14879: effective temperature 6055 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.032). log g 4.1 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 26 (BS 963), cross-checked against Gaia DR3 XP spectrum, source 5059348952161258624 (20 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff7fc. Routes tried in order: stis-ngsl: HD 20010 is not in the library; pulkovo: HR 963 is not in the catalogue; kiehling: HR 963 is not among its 60 stars; kharitonov: HR 963 is not in the catalogue; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,055 K and log g 4.1 (u1 0.404, u2 0.292): a model, because no fit of this star's limb is used. Gravity: log g 4.1 from 2024A&A...683A.125P; the 24 published values span log g 3.448 to 4.4, across which the limb law changes by at most 0.4% of the centre brightness.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 4, 97 and 106 (the newest of July and August 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 20 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 4 gives a period of 4.32 d from the autocorrelation, whose peaks have a height of 0.15, a width of 0.55 and a fit of 0.99; Sector 97 gives a period of 4.42 d from the autocorrelation, whose peaks have a height of 0.27, a width of 0.47 and a fit of 1.00; Sector 106 gives a period of 4.18 d from the autocorrelation, whose peaks have a height of 0.23, a width of 0.48 and a fit of 0.99; 3 more of the star's 6 sectors do not meet the criteria. All 6 together give a period of 4.19 d from the autocorrelation, whose peaks have a height of 0.18, a width of 0.49 and a fit of 1.00, which is the star's period: 4.19 d. The light varies by 0.07% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.01% about the light, whose own noise is 0.004%. Gaia DR3 lists 6 other stars within 63 arcseconds, with 8.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Fornacis" (revision 1370772942) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of July and August 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
