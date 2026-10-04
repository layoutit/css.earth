# Solitaire

## Sources

Its brightness, measured band by band, gives 310 times the Sun's luminosity at 4,118 K, so 34.657 solar radii. It is also HD 130694, HR 5526, HIP 72571. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6219380139469026432, distance 102 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72571: distance 101.523 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.07), at which the luminosity and radius hold; Gaia DR3's parallax, 10.802 ± 0.404 mas (26.8 standard errors), is not used. Radius 34.657 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72571: radius 34.657 solar radii, implied by the fitted luminosity 310.321 solar luminosities (fractional uncertainty 0.093) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,118 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 72571: effective temperature 4118 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.043). log g 1.33 from 2021MNRAS.505.4496G ("An extension of the MILES library with derived T_eff_, log g, [Fe/H], and [{alpha}/Fe].").

**Color.** A Planck spectrum at 4,118 K, because no archive holds a spectrum of this star (stis-ngsl: HD 130694 is not in the library; pulkovo: HR 5526 is not in the catalogue; kiehling: HR 5526 is not among its 60 stars; kharitonov: HR 5526 is not in the catalogue; burnashev: BS 5526 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it), through the CIE 1931 2° observer: #ffd6ab. Routes tried in order: stis-ngsl: HD 130694 is not in the library; pulkovo: HR 5526 is not in the catalogue; kiehling: HR 5526 is not among its 60 stars; kharitonov: HR 5526 is not in the catalogue; burnashev: BS 5526 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,118 K and log g 1.33 (u1 0.895, u2 -0.062): a model, because no fit of this star's limb is used. Gravity: log g 1.33 from 2021MNRAS.505.4496G; the 11 published values span log g 1 to 2, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "58 Hydrae" (revision 1370772148) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
