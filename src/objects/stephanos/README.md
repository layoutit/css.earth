# Stephanos

## Sources

Its brightness, measured band by band, gives 38 times the Sun's luminosity at 4,682 K, so 9.325 solar radii. It is also HD 140716, HR 5855, HIP 77048. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1369646142775099136, distance 75 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77048: distance 74.627 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.016), at which the luminosity and radius hold; Gaia DR3's parallax, 12.597 ± 0.041 mas (306.4 standard errors), is not used. Radius 9.325 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77048: radius 9.325 solar radii, implied by the fitted luminosity 37.545 solar luminosities (fractional uncertainty 0.056) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,682 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77048: effective temperature 4682 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.038). log g 2.7 from 2008AJ....135..209M ("Rotational and radial velocities for a sample of 761 Hipparcos giants and  the role of binarity.").

**Color.** Gaia DR3 XP spectrum, source 1369646142775099136, through the CIE 1931 2° observer: #ffe0c0. Routes tried in order: stis-ngsl: HD 140716 is not in the library; pulkovo: HR 5855 is not in the catalogue; kiehling: HR 5855 is not among its 60 stars; kharitonov: HR 5855 is not in the catalogue; burnashev: BS 5855 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,682 K and log g 2.7 (u1 0.724, u2 0.076): a model, because no fit of this star's limb is used. Gravity: log g 2.7 from 2008AJ....135..209M; the 5 published values span log g 2.5 to 2.78, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Pi Coronae Borealis" (revision 1364467343) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
