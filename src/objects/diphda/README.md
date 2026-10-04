# Diphda

## Sources

Its brightness, measured band by band, gives 138 times the Sun's luminosity at 4,835 K, so 16.754 solar radii. It is also HD 4128, HR 188, HIP 3419. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 3419 (SIMBAD HIP 3419); placed by that row, not by a Gaia source, distance 29.53 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 3419: distance 29.533 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.005), at which the luminosity and radius hold. Radius 16.754 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 3419: radius 16.754 solar radii, implied by the fitted luminosity 137.825 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,835 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 3419: effective temperature 4835 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.041). log g 2.85 from 2024A&A...683A.125P ("Analysis of the public HARPS/ESO spectroscopic archive Ca II H&K time series for the HARPS radial velocity database.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Diphda is HR 188., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 29: HR 188; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe2bf. Routes tried in order: stis-ngsl: the library marks HD 4128's spectrum DATAQUAL suspect; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 188 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,835 K and log g 2.85 (u1 0.679, u2 0.110): a model, because no fit of this star's limb is used. Gravity: log g 2.85 from 2024A&A...683A.125P; the 26 published values span log g 2.25 to 3.12, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Ceti" (revision 1374546688) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
