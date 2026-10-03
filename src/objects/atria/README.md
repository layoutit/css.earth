# Atria

## Sources

Its brightness, measured band by band, gives 3,713 times the Sun's luminosity at 4,269 K, so 111.552 solar radii. It is also HD 150798, HR 6217, HIP 82273. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 82273 (SIMBAD HIP 82273); placed by that row, not by a Gaia source, distance 120 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82273: distance 119.76 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.018), at which the luminosity and radius hold. Radius 111.552 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82273: radius 111.552 solar radii, implied by the fitted luminosity 3713.19 solar luminosities (fractional uncertainty 0.061) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,269 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 82273: effective temperature 4269 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.065). No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Atria is HR 6217., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 223 (BS 6217) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd292. Routes tried in order: stis-ngsl: HD 150798 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 6217 is not among its 60 stars; kharitonov: HR 6217 is not in the catalogue; pulkovo: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Trianguli Australis" (revision 1374619062) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
