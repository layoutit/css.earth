# Alsciaukat

## Sources

Its brightness, measured band by band, gives 677 times the Sun's luminosity at 3,900 K, so 57.067 solar radii. It is also HD 70272, HR 3275, HIP 41075. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 916230087468692864, distance 117 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 41075: distance 117.233 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.029), at which the luminosity and radius hold; Gaia DR3's parallax, 8.883 ± 0.210 mas (42.3 standard errors), is not used. Radius 57.067 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 41075: radius 57.067 solar radii, implied by the fitted luminosity 676.9 solar luminosities (fractional uncertainty 0.07) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,900 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 41075: effective temperature 3900 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.165). log g 0.98 from 2024MNRAS.531.4823P ("Chemical compositions of semiregular variable red giants.").

**Color.** A Planck spectrum at 3,900 K, because no archive holds a spectrum of this star (stis-ngsl: HD 70272 is not in the library; pulkovo: HR 3275 is not in the catalogue; kiehling: HR 3275 is not among its 60 stars; kharitonov: HR 3275 is not in the catalogue; burnashev: BS 3275 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it), through the CIE 1931 2° observer: #ffd1a0. Routes tried in order: stis-ngsl: HD 70272 is not in the library; pulkovo: HR 3275 is not in the catalogue; kiehling: HR 3275 is not among its 60 stars; kharitonov: HR 3275 is not in the catalogue; burnashev: BS 3275 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,900 K and log g 0.98 (u1 0.964, u2 -0.124): a model, because no fit of this star's limb is used. Gravity: log g 0.98 from 2024MNRAS.531.4823P; the 9 published values span log g 0.82 to 2.05, across which the limb law changes by at most 0.4% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "31 Lyncis" (revision 1376590218) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
