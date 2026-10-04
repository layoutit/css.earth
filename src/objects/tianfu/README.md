# Tianfu

## Sources

Its brightness, measured band by band, gives 126 times the Sun's luminosity at 4,742 K, so 16.621 solar radii. It is also HD 190327, HR 7669, HIP 98823. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4298688082015247744, distance 142 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98823: distance 141.643 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.058), at which the luminosity and radius hold; Gaia DR3's parallax, 6.097 ± 0.070 mas (86.8 standard errors), is not used. Radius 16.621 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98823: radius 16.621 solar radii, implied by the fitted luminosity 125.504 solar luminosities (fractional uncertainty 0.078) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,742 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98823: effective temperature 4742 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.078). log g 2.95 from 2020AJ....160..120J ("APOGEE data and spectral analysis from SDSS Data Release 16: seven years of observations including first results from APOGEE-South.").

**Color.** Gaia DR3 XP spectrum, source 4298688082015247744, through the CIE 1931 2° observer: #ffe1c0. Routes tried in order: stis-ngsl: HD 190327 is not in the library; pulkovo: HR 7669 is not in the catalogue; kiehling: HR 7669 is not among its 60 stars; kharitonov: HR 7669 is not in the catalogue; burnashev: BS 7669 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,742 K and log g 2.95 (u1 0.709, u2 0.087): a model, because no fit of this star's limb is used. Gravity: log g 2.95 from 2020AJ....160..120J; the 10 published values span log g 2.561 to 3.071, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Tau Aquilae" (revision 1374546243) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
