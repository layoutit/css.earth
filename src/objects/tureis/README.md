# Tureis

## Sources

Its brightness, measured band by band, gives 21 times the Sun's luminosity at 6,799 K, so 3.334 solar radii. It is also HD 67523, HR 3185, HIP 39757. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5698015743046182272, distance 19 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 39757: distance 19.482 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 51.400 ± 0.245 mas (210.2 standard errors), is not used. Radius 3.334 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 39757: radius 3.334 solar radii, implied by the fitted luminosity 21.339 solar luminosities (fractional uncertainty 0.233) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,799 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 39757: effective temperature 6799 +/- 895 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.075). log g 3.86 from 2024A&A...690A..97C ("The AMBRE Project: Lead abundance in Galactic stars.").

**Color.** Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * rho Pup is HR 3185., cross-checked against Gaia DR3 XP spectrum, source 5698015743046182272 (37 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #e9ebff. Routes tried in order: stis-ngsl: HD 67523 is not in the library; pulkovo: HR 3185 is not in the catalogue; kharitonov: HR 3185 is not in the catalogue; burnashev: BS 3185 is not in part2; kiehling: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,799 K and log g 3.86 (u1 0.325, u2 0.325): a model, because no fit of this star's limb is used. Gravity: log g 3.86 from 2024A&A...690A..97C; the 14 published values span log g 2.396 to 3.86, across which the limb law changes by at most 3.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 37 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Rho Puppis" (revision 1347254680) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
