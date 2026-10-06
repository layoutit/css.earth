# Telum

## Sources

Its brightness, measured band by band, gives 559 times the Sun's luminosity at 3,936 K, so 50.917 solar radii. It is also HD 189319, HR 7635, HIP 98337. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1823067317695766784, distance 79 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98337: distance 79.239 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.014), at which the luminosity and radius hold; Gaia DR3's parallax, 11.338 ± 0.165 mas (68.6 standard errors), is not used. Radius 50.917 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98337: radius 50.917 solar radii, implied by the fitted luminosity 559.03 solar luminosities (fractional uncertainty 0.065) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,936 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98337: effective temperature 3936 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.093). log g 1.06 from 2025A&A...698A..93J ("A search for Maunder-minimum candidate stars.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 908: HR 7635; VizieR III/202, cross-checked against Gaia DR3 XP spectrum, source 1823067317695766784 (36 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcb8a. Routes tried in order: stis-ngsl: HD 189319 is not in the library; pulkovo: the spectrum was found but gives no color (Pulkovo flux must be finite.); kiehling: HR 7635 is not among its 60 stars; burnashev: BS 7635 is not in part2; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,936 K and log g 1.06 (u1 0.953, u2 -0.114): a model, because no fit of this star's limb is used. Gravity: log g 1.06 from 2025A&A...698A..93J; the 21 published values span log g 0.5 to 1.905, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 36 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gamma Sagittae" (revision 1374584289) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
