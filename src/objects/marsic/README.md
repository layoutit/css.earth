# Marsic

## Sources

Its brightness, measured band by band, gives 132 times the Sun's luminosity at 4,934 K, so 15.773 solar radii. It is also HD 145001, HR 6008, HIP 79043. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1198898034296727296, distance 113 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79043: distance 112.74 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.062), at which the luminosity and radius hold; Gaia DR3's parallax, 8.281 ± 0.092 mas (89.8 standard errors), is not used. Radius 15.773 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79043: radius 15.773 solar radii, implied by the fitted luminosity 132.468 solar luminosities (fractional uncertainty 0.08) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,934 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 79043: effective temperature 4934 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.105). log g 2.9 from 2014ApJ...785...94L ("The lithium abundances of a large sample of red giants.").

**Color.** Gaia DR3 XP spectrum, source 1198898034296727296, through the CIE 1931 2° observer: #ffe8d1. Routes tried in order: stis-ngsl: HD 145001 is not in the library; pulkovo: HR 6008 is not in the catalogue; kiehling: HR 6008 is not among its 60 stars; kharitonov: HR 6008 is not in the catalogue; burnashev: BS 6008 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,934 K and log g 2.9 (u1 0.650, u2 0.132): a model, because no fit of this star's limb is used. Gravity: log g 2.9 from 2014ApJ...785...94L; the 5 published values span log g 2.7 to 2.9, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kappa Herculis" (revision 1370780906) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
