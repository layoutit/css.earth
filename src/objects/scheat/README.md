# Scheat

## Sources

Its brightness, measured band by band, gives 1,864 times the Sun's luminosity at 3,541 K, so 114.864 solar radii. It is also HD 217906, HR 8775, HIP 113881. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 113881 (SIMBAD HIP 113881); placed by that row, not by a Gaia source, distance 60.10 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113881: distance 60.096 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.009), at which the luminosity and radius hold. Radius 114.864 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113881: radius 114.864 solar radii, implied by the fitted luminosity 1863.64 solar luminosities (fractional uncertainty 0.071) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,541 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113881: effective temperature 3541 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.088). No surface gravity of this star is published.

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1096: HR 8775; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 470 (BS 8775) (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffca7d. Routes tried in order: stis-ngsl: HD 217906 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 8775 is not in the catalogue; kiehling: HR 8775 is not among its 60 stars; kharitonov: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Pegasi" (revision 1377053930) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
