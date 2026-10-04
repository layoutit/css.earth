# Brachium

## Sources

Its brightness, measured band by band, gives 1,676 times the Sun's luminosity at 3,577 K, so 106.746 solar radii. It is also HD 133216, HR 5603, HIP 73714. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6227443304915069056, distance 88 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73714: distance 88.417 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.022), at which the luminosity and radius hold; Gaia DR3's parallax, 12.539 ± 0.298 mas (42.0 standard errors), is not used. Radius 106.746 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73714: radius 106.746 solar radii, implied by the fitted luminosity 1675.97 solar luminosities (fractional uncertainty 0.073) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,577 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 73714: effective temperature 3577 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.045). log g 2 from 2023ApJS..266...41P ("HST Low-resolution Stellar Library.").

**Color.** A Planck spectrum at 3,577 K, because no archive holds a spectrum of this star (stis-ngsl: HD 133216 is not in the library; pulkovo: HR 5603 is not in the catalogue; kiehling: HR 5603 is not among its 60 stars; kharitonov: HR 5603 is not in the catalogue; burnashev: BS 5603 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it), through the CIE 1931 2° observer: #ffc990. Routes tried in order: stis-ngsl: HD 133216 is not in the library; pulkovo: HR 5603 is not in the catalogue; kiehling: HR 5603 is not among its 60 stars; kharitonov: HR 5603 is not in the catalogue; burnashev: BS 5603 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,577 K and log g 2 (u1 1.037, u2 -0.192): a model, because no fit of this star's limb is used. Gravity: log g 2 from 2023ApJS..266...41P; the 1 published value span log g 2 to 2, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Sigma Librae" (revision 1370789151) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
