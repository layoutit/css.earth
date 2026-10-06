# Minchir

## Sources

Its brightness, measured band by band, gives 262 times the Sun's luminosity at 4,575 K, so 25.814 solar radii. It is also HD 73471, HR 3418, HIP 42402. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3080111439567156992, distance 114 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 42402: distance 114.286 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.029), at which the luminosity and radius hold; Gaia DR3's parallax, 8.689 ± 0.124 mas (69.9 standard errors), is not used. Radius 25.814 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 42402: radius 25.814 solar radii, implied by the fitted luminosity 262.284 solar luminosities (fractional uncertainty 0.062) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,575 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 42402: effective temperature 4575 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.059). log g 2.3 from 2021MNRAS.505.4496G ("An extension of the MILES library with derived T_eff_, log g, [Fe/H], and [{alpha}/Fe].").

**Color.** Gaia DR3 XP spectrum, source 3080111439567156992, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 512: HR 3418; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdcb3. Routes tried in order: stis-ngsl: HD 73471 is not in the library; pulkovo: HR 3418 is not in the catalogue; kiehling: HR 3418 is not among its 60 stars; burnashev: BS 3418 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,575 K and log g 2.3 (u1 0.752, u2 0.055): a model, because no fit of this star's limb is used. Gravity: log g 2.3 from 2021MNRAS.505.4496G; the 8 published values span log g 2.2 to 2.4, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Sigma Hydrae" (revision 1374548921) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
