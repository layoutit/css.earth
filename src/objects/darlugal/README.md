# Darlugal

## Sources

Its brightness, measured band by band, gives 13 times the Sun's luminosity at 7,737 K, so 2.017 solar radii. It is also HD 38678, HR 1998, HIP 27288. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2996171698248699904, distance 22 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 27288: distance 21.608 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 44.794 ± 0.247 mas (181.7 standard errors), is not used. Radius 2.017 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 27288: radius 2.017 solar radii, implied by the fitted luminosity 13.093 solar luminosities (fractional uncertainty 0.681) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 7,737 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 27288: effective temperature 7737 +/- 2877 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.211). log g 4 from 2024A&A...681A.107R ("MELCHIORS The Mercator Library of High Resolution Stellar Spectroscopy.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 393: HR 1998; VizieR III/202, cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 71 (BS 1998) (12 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #b9ccff. Routes tried in order: stis-ngsl: HD 38678 is not in the library; pulkovo: HR 1998 is not in the catalogue; kiehling: HR 1998 is not among its 60 stars; gaia-xp: found, not needed after the color and its cross-check; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,737 K and log g 4 (u1 0.296, u2 0.333): a model, because no fit of this star's limb is used. Gravity: log g 4 from 2024A&A...681A.107R; the 2 published values span log g 4.0027 to 4.03, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 12 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Zeta Leporis" (revision 1345015552) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
