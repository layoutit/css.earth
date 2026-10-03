# Pherkad

## Sources

Its brightness, measured band by band, gives 998 times the Sun's luminosity at 8,015 K, so 16.408 solar radii. It is also HD 137422, HR 5735, HIP 75097. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1696877570753454208, distance 149 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75097: distance 149.254 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.016), at which the luminosity and radius hold; Gaia DR3's parallax, 6.596 ± 0.294 mas (22.4 standard errors), is not used. Radius 16.408 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75097: radius 16.408 solar radii, implied by the fitted luminosity 998.14 solar luminosities (fractional uncertainty 0.058) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,015 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 75097: effective temperature 8015 +/- 240 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.042). No surface gravity of this star is published.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Pherkad is HR 5735., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 715: HR 5735; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c4d3ff. Routes tried in order: stis-ngsl: HD 137422 is not in the library; kiehling: HR 5735 is not among its 60 stars; burnashev: BS 5735 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** No limb darkening is drawn: no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15).

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Pherkad" (revision 1374596449) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
