# Titawin

## Sources

Its brightness, measured band by band, gives 3.345 times the Sun's luminosity at 6,232 K, so 1.571 solar radii. It is also HD 9826, HR 458, HIP 7513. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 348020482735930112, distance 13 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7513: distance 13.492 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 74.194 ± 0.208 mas (356.2 standard errors), is not used. Radius 1.571 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7513: radius 1.571 solar radii, implied by the fitted luminosity 3.345 solar luminosities (fractional uncertainty 0.04) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,232 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7513: effective temperature 6232 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.027). log g 4.29 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 80: HR 458; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 348020482735930112 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #f8f7ff. Routes tried in order: stis-ngsl: HD 9826 is not in the library; pulkovo: HR 458 is not in the catalogue; kiehling: HR 458 is not among its 60 stars; burnashev: BS 458 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,232 K and log g 4.29 (u1 0.379, u2 0.304): a model, because no fit of this star's limb is used. Gravity: log g 4.29 from 2024A&A...691A..53S; the 78 published values span log g 3.91 to 4.4, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Upsilon Andromedae" (revision 1370790660) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
