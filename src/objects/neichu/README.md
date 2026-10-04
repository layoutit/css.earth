# Neichu

## Sources

Its brightness, measured band by band, gives 95 times the Sun's luminosity at 6,281 K, so 8.263 solar radii. It is also HD 210459, HR 8454, HIP 109410. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1899238700121170944, distance 81 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 109410: distance 80.645 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.014), at which the luminosity and radius hold; Gaia DR3's parallax, 11.199 ± 0.178 mas (62.8 standard errors), is not used. Radius 8.263 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 109410: radius 8.263 solar radii, implied by the fitted luminosity 95.476 solar luminosities (fractional uncertainty 0.037) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,281 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 109410: effective temperature 6281 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.062). log g 2.85 from 2024A&A...681A.107R ("MELCHIORS The Mercator Library of High Resolution Stellar Spectroscopy.").

**Color.** Gaia DR3 XP spectrum, source 1899238700121170944, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1043: HR 8454; VizieR III/202 (11 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #edeeff. Routes tried in order: stis-ngsl: HD 210459 is not in the library; pulkovo: HR 8454 is not in the catalogue; kiehling: HR 8454 is not among its 60 stars; burnashev: BS 8454 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,281 K and log g 2.85 (u1 0.374, u2 0.300): a model, because no fit of this star's limb is used. Gravity: log g 2.85 from 2024A&A...681A.107R; the 2 published values span log g 2.854 to 3.1, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 11 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
