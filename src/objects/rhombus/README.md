# Rhombus

## Sources

Its brightness, measured band by band, gives 104 times the Sun's luminosity at 5,152 K, so 12.812 solar radii. It is also HD 27256, HR 1336, HIP 19780. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4676528209144882304, distance 50 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19780: distance 49.554 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.005), at which the luminosity and radius hold; Gaia DR3's parallax, 20.343 ± 0.186 mas (109.4 standard errors), is not used. Radius 12.812 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19780: radius 12.812 solar radii, implied by the fitted luminosity 103.911 solar luminosities (fractional uncertainty 0.049) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,152 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 19780: effective temperature 5152 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.04). log g 2.56 from 2024A&A...690A..97C ("The AMBRE Project: Lead abundance in Galactic stars.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 35 (BS 1336), cross-checked against Gaia DR3 XP spectrum, source 4676528209144882304 (41 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffeacf. Routes tried in order: stis-ngsl: HD 27256 is not in the library; pulkovo: HR 1336 is not in the catalogue; kiehling: HR 1336 is not among its 60 stars; kharitonov: HR 1336 is not in the catalogue; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,152 K and log g 2.56 (u1 0.584, u2 0.178): a model, because no fit of this star's limb is used. Gravity: log g 2.56 from 2024A&A...690A..97C; the 7 published values span log g 2.39 to 3.03, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 41 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Reticuli" (revision 1374789052) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
