# Mirach

## Sources

Its brightness, measured band by band, gives 1,404 times the Sun's luminosity at 3,802 K, so 86.471 solar radii. It is also HD 6860, HR 337, HIP 5447. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 5447 (SIMBAD HIP 5447); placed by that row, not by a Gaia source, distance 60.53 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5447: distance 60.533 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.034), at which the luminosity and radius hold. Radius 86.471 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5447: radius 86.471 solar radii, implied by the fitted luminosity 1403.71 solar luminosities (fractional uncertainty 0.074) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,802 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5447: effective temperature 3802 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.048). log g 1.05 from 2020AJ....160..120J ("APOGEE data and spectral analysis from SDSS Data Release 16: seven years of observations including first results from APOGEE-South.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Mirach is HR 337., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 61: HR 337; VizieR III/202 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffc983. Routes tried in order: stis-ngsl: HD 6860 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 337 is not among its 60 stars; burnashev: BS 337 is not in part2; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,802 K and log g 1.05 (u1 0.992, u2 -0.149): a model, because no fit of this star's limb is used. Gravity: log g 1.05 from 2020AJ....160..120J; the 11 published values span log g 1 to 1.6, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Mirach" (revision 1374584335) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
