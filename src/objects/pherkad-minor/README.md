# Pherkad Minor

## Sources

Its brightness, measured band by band, gives 257 times the Sun's luminosity at 4,254 K, so 29.569 solar radii. It is also HD 136726, HR 5714, HIP 74793. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1696798367260229376, distance 134 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74793: distance 133.864 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.088), at which the luminosity and radius hold; Gaia DR3's parallax, 7.926 ± 0.087 mas (90.7 standard errors), is not used. Radius 29.569 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74793: radius 29.569 solar radii, implied by the fitted luminosity 257.257 solar luminosities (fractional uncertainty 0.106) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,254 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74793: effective temperature 4254 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.044). log g 1.78 from 2024A&A...682A.145S ("{\em Gaia} FGK benchmark stars: Fundamental {\em T}_eff_ and log {\em g} of the third version.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 136726: 168-1020 nm, cross-checked against Gaia DR3 XP spectrum, source 1696798367260229376 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd29b. Routes tried in order: pulkovo: found, not needed after the color and its cross-check; kiehling: HR 5714 is not among its 60 stars; kharitonov: HR 5714 is not in the catalogue; burnashev: BS 5714 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,254 K and log g 1.78 (u1 0.852, u2 -0.025): a model, because no fit of this star's limb is used. Gravity: log g 1.78 from 2024A&A...682A.145S; the 25 published values span log g -0.49 to 2.06.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "11 Ursae Minoris" (revision 1374550665) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
