# Veritate

## Sources

Its brightness, measured band by band, gives 68 times the Sun's luminosity at 4,509 K, so 13.58 solar radii. It is also HD 221345, HR 8930, HIP 116076. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1920113512486282240, distance 79 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116076: distance 79.177 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.021), at which the luminosity and radius hold; Gaia DR3's parallax, 13.168 ± 0.073 mas (181.1 standard errors), is not used. Radius 13.58 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116076: radius 13.58 solar radii, implied by the fitted luminosity 68.489 solar luminosities (fractional uncertainty 0.059) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,509 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 116076: effective temperature 4509 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.131). log g 2.52 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** Gaia DR3 XP spectrum, source 1920113512486282240, through the CIE 1931 2° observer: #ffe2c4. Routes tried in order: stis-ngsl: HD 221345 is not in the library; pulkovo: HR 8930 is not in the catalogue; kiehling: HR 8930 is not among its 60 stars; kharitonov: HR 8930 is not in the catalogue; burnashev: BS 8930 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,509 K and log g 2.52 (u1 0.777, u2 0.034): a model, because no fit of this star's limb is used. Gravity: log g 2.52 from 2024A&A...691A..53S; the 26 published values span log g 2.2 to 2.89, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "14 Andromedae" (revision 1374546255) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
