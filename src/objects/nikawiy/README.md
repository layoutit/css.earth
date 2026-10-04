# Nikawiy

## Sources

Its brightness, measured band by band, gives 8.448 times the Sun's luminosity at 4,861 K, so 4.104 solar radii. It is also HD 136418, HIP 74961. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1392396172224832896, distance 107 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74961: distance 106.896 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.026), at which the luminosity and radius hold; Gaia DR3's parallax, 9.526 ± 0.016 mas (580.6 standard errors), is not used. Radius 4.104 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74961: radius 4.104 solar radii, implied by the fitted luminosity 8.448 solar luminosities (fractional uncertainty 0.057) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,861 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 74961: effective temperature 4861 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.022). log g 3.38 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** Gaia DR3 XP spectrum, source 1392396172224832896, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: HD 136418 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,861 K and log g 3.38 (u1 0.680, u2 0.106): a model, because no fit of this star's limb is used. Gravity: log g 3.38 from 2024A&A...691A..53S; the 11 published values span log g 3.38 to 3.6, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 136418 b" (revision 1374388070) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
