# Yuyu

## Sources

Its brightness, measured band by band, gives 257 times the Sun's luminosity at 5,004 K, so 21.353 solar radii. It is also HD 74739, HR 3475, HIP 43103. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 705156050012755712, distance 102 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 43103: distance 101.523 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.062), at which the luminosity and radius hold; Gaia DR3's parallax, 9.412 ± 0.162 mas (58.1 standard errors), is not used. Radius 21.353 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 43103: radius 21.353 solar radii, implied by the fitted luminosity 256.838 solar luminosities (fractional uncertainty 0.08) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,004 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 43103: effective temperature 5004 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.052). log g 2.4 from 2014AJ....147..137L ("Parameters and abundances in luminous stars.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 517: HR 3475; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 705156050012755712 (11 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe8ca. Routes tried in order: stis-ngsl: HD 74739 is not in the library; pulkovo: HR 3475 is not in the catalogue; kiehling: HR 3475 is not among its 60 stars; burnashev: BS 3475 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,004 K and log g 2.4 (u1 0.622, u2 0.152): a model, because no fit of this star's limb is used. Gravity: log g 2.4 from 2014AJ....147..137L; the 14 published values span log g 1.8 to 2.69, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 11 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Iota Cancri" (revision 1370780382) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
