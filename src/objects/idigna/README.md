# Idigna

## Sources

Its brightness, measured band by band, gives 5.565 times the Sun's luminosity at 6,699 K, so 1.754 solar radii. It is also HD 9919, HR 463, HIP 7535. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2585868490297270144, distance 35 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7535: distance 35.088 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.034), at which the luminosity and radius hold; Gaia DR3's parallax, 30.349 ± 0.724 mas (41.9 standard errors), is not used. Radius 1.754 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7535: radius 1.754 solar radii, implied by the fitted luminosity 5.565 solar luminosities (fractional uncertainty 0.066) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,699 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 7535: effective temperature 6699 +/- 216 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.099). log g 4.05 from 2021MNRAS.505.4496G ("An extension of the MILES library with derived T_eff_, log g, [Fe/H], and [{alpha}/Fe].").

**Color.** A Planck spectrum at 6,699 K, because no archive holds a spectrum of this star (stis-ngsl: HD 9919 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 463 is not in the catalogue; kiehling: HR 463 is not among its 60 stars; kharitonov: HR 463 is not in the catalogue; burnashev: BS 463 is not in part2), through the CIE 1931 2° observer: #fbf6ff. Routes tried in order: stis-ngsl: HD 9919 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 463 is not in the catalogue; kiehling: HR 463 is not among its 60 stars; kharitonov: HR 463 is not in the catalogue; burnashev: BS 463 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,699 K and log g 4.05 (u1 0.334, u2 0.321): a model, because no fit of this star's limb is used. Gravity: log g 4.05 from 2021MNRAS.505.4496G; the 8 published values span log g 3.96 to 4.22, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Pi Piscium" (revision 1376028682) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
