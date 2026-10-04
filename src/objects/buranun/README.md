# Buranun

## Sources

Its brightness, measured band by band, gives 96 times the Sun's luminosity at 4,734 K, so 14.61 solar radii. It is also HD 7446, HR 367, HIP 5824. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2576836345872707712, distance 155 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5824: distance 155.433 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.113), at which the luminosity and radius hold; Gaia DR3's parallax, 7.127 ± 0.045 mas (158.5 standard errors), is not used. Radius 14.61 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5824: radius 14.61 solar radii, implied by the fitted luminosity 96.313 solar luminosities (fractional uncertainty 0.125) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,734 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 5824: effective temperature 4734 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.049). log g 2.26 from 2022A&A...663A...4S ("Assessment of [Fe/H] determinations for FGK stars in spectroscopic surveys."), a comparison of survey pipelines (Soubiran et al. 2022).

**Color.** Gaia DR3 XP spectrum, source 2576836345872707712, through the CIE 1931 2° observer: #ffe2c2. Routes tried in order: stis-ngsl: HD 7446 is not in the library; pulkovo: HR 367 is not in the catalogue; kiehling: HR 367 is not among its 60 stars; kharitonov: HR 367 is not in the catalogue; burnashev: BS 367 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,734 K and log g 2.26 (u1 0.701, u2 0.095): a model, because no fit of this star's limb is used. Gravity: log g 2.26 from 2022A&A...663A...4S (a comparison of survey pipelines (Soubiran et al. 2022), a survey pipeline: no analysis of this star's own spectra is published); the 1 published value span log g 2.26 to 2.26, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
