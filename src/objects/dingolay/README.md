# Dingolay

## Sources

Its brightness, measured band by band, gives 13 times the Sun's luminosity at 5,007 K, so 4.761 solar radii. It is also HD 96063, HIP 54158. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3791263156547622784, distance 158 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 54158: distance 157.978 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.13), at which the luminosity and radius hold; Gaia DR3's parallax, 7.179 ± 0.028 mas (256.1 standard errors), is not used. Radius 4.761 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 54158: radius 4.761 solar radii, implied by the fitted luminosity 12.8 solar luminosities (fractional uncertainty 0.139) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,007 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 54158: effective temperature 5007 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.028). log g 3.46 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** A Planck spectrum at 5,007 K, because no archive holds a spectrum of this star (stis-ngsl: HD 96063 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: HD 96063 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,007 K and log g 3.46 (u1 0.637, u2 0.139): a model, because no fit of this star's limb is used. Gravity: log g 3.46 from 2024A&A...691A..53S; the 7 published values span log g 3.27 to 3.63, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 96063" (revision 1344176168) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
