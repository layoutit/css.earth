# Tengshe

## Sources

Its brightness, measured band by band, gives 7,747 times the Sun's luminosity at 3,724 K, so 211.738 solar radii. It is also HD 216946, HR 8726, HIP 113288. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1985889115564260224, distance 490 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113288: distance 490.196 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.127), at which the luminosity and radius hold; Gaia DR3's parallax, 1.402 ± 0.113 mas (12.4 standard errors), is not used. Radius 211.738 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113288: radius 211.738 solar radii, implied by the fitted luminosity 7746.88 solar luminosities (fractional uncertainty 0.144) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,724 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 113288: effective temperature 3724 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.095). log g 0.49 from 2025A&A...693A.163T ("MAGIS (Measuring Abundances of red super Giants with Infrared Spectroscopy) project I. Establishment of an abundance analysis procedure for red supergiants and its evaluation with nearby stars.").

**Color.** Gaia DR3 XP spectrum, source 1985889115564260224, through the CIE 1931 2° observer: #ffc074. Routes tried in order: stis-ngsl: HD 216946 is not in the library; pulkovo: HR 8726 is not in the catalogue; kiehling: HR 8726 is not among its 60 stars; kharitonov: HR 8726 is not in the catalogue; burnashev: BS 8726 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,724 K and log g 0.49 (u1 1.020, u2 -0.176): a model, because no fit of this star's limb is used. Gravity: log g 0.49 from 2025A&A...693A.163T, the median of its 2 spectra; the 11 published values span log g 0.15 to 0.75, across which the limb law changes by at most 0.4% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "V424 Lacertae" (revision 1367909073) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
