# Enif

## Sources

Its brightness, measured band by band, gives 8,508 times the Sun's luminosity at 4,158 K, so 177.992 solar radii. It is also HD 206778, HR 8308, HIP 107315. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 107315 (SIMBAD HIP 107315); placed by that row, not by a Gaia source, distance 211 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 107315: distance 211.416 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.036), at which the luminosity and radius hold. Radius 177.992 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 107315: radius 177.992 solar radii, implied by the fitted luminosity 8508.04 solar luminosities (fractional uncertainty 0.07) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,158 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 107315: effective temperature 4158 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.079). No surface gravity of this star is published.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 206778: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1012: HR 8308; VizieR III/202 (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffce8a. Routes tried in order: gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 8308 is not in the catalogue; kiehling: HR 8308 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 2 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Epsilon Pegasi" (revision 1372483107) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
