# Pabilsang

## Sources

Its brightness, measured band by band, gives 113 times the Sun's luminosity at 4,186 K, so 20.202 solar radii. It is also HD 175190, HR 7120, HIP 92845. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4075701763795658240, distance 84 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92845: distance 83.963 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.044), at which the luminosity and radius hold; Gaia DR3's parallax, 11.410 ± 0.752 mas (15.2 standard errors), is not used. Radius 20.202 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92845: radius 20.202 solar radii, implied by the fitted luminosity 112.581 solar luminosities (fractional uncertainty 0.074) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,186 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 92845: effective temperature 4186 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.141). log g 1.03 from 2014AJ....147..137L ("Parameters and abundances in luminous stars.").

**Color.** A Planck spectrum at 4,186 K, because no archive holds a spectrum of this star (stis-ngsl: HD 175190 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7120 is not in the catalogue; kiehling: HR 7120 is not among its 60 stars; kharitonov: HR 7120 is not in the catalogue; burnashev: BS 7120 is not in part2), through the CIE 1931 2° observer: #ffd7ae. Routes tried in order: stis-ngsl: HD 175190 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 7120 is not in the catalogue; kiehling: HR 7120 is not among its 60 stars; kharitonov: HR 7120 is not in the catalogue; burnashev: BS 7120 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,186 K and log g 1.03 (u1 0.872, u2 -0.043): a model, because no fit of this star's limb is used. Gravity: log g 1.03 from 2014AJ....147..137L; the 3 published values span log g 1 to 1.07, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Nu2 Sagittarii" (revision 1375721104) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
