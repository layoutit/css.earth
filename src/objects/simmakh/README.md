# Simmakh

## Sources

Its brightness, measured band by band, gives 141 times the Sun's luminosity at 4,311 K, so 21.284 solar radii. It is also HD 1635, HR 80, HIP 1645. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2749182560143316224, distance 125 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 1645: distance 125 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.035), at which the luminosity and radius hold; Gaia DR3's parallax, 7.058 ± 0.095 mas (74.0 standard errors), is not used. Radius 21.284 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 1645: radius 21.284 solar radii, implied by the fitted luminosity 140.575 solar luminosities (fractional uncertainty 0.068) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,311 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 1645: effective temperature 4311 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.127). log g 2.1 from 1990ApJS...74.1075M ("High-resolution spectroscopic survey of 671 GK giants. I. Stellar atmosphere parameters and abundances.").

**Color.** Gaia DR3 XP spectrum, source 2749182560143316224, through the CIE 1931 2° observer: #ffd2a1. Routes tried in order: stis-ngsl: HD 1635 is not in the library; pulkovo: HR 80 is not in the catalogue; kiehling: HR 80 is not among its 60 stars; kharitonov: HR 80 is not in the catalogue; burnashev: BS 80 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,311 K and log g 2.1 (u1 0.835, u2 -0.011): a model, because no fit of this star's limb is used. Gravity: log g 2.1 from 1990ApJS...74.1075M, the median of its 3 spectra; the 4 published values span log g 2.1 to 2.1, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
