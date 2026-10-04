# Felis

## Sources

Its brightness, measured band by band, gives 917 times the Sun's luminosity at 3,836 K, so 68.667 solar radii. It is also HD 85951, HR 3923, HIP 48615. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5671793318423471616, distance 188 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48615: distance 188.324 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.053), at which the luminosity and radius hold; Gaia DR3's parallax, 5.679 ± 0.221 mas (25.7 standard errors), is not used. Radius 68.667 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48615: radius 68.667 solar radii, implied by the fitted luminosity 917.273 solar luminosities (fractional uncertainty 0.084) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,836 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 48615: effective temperature 3836 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.07). log g 1.3 from 2019A&A...627A.138A ("Stellar atmospheric parameters for 754 spectra from the X-shooter Spectral Library.").

**Color.** Gaia DR3 XP spectrum, source 5671793318423471616, through the CIE 1931 2° observer: #ffc88b. Routes tried in order: stis-ngsl: HD 85951 is not in the library; pulkovo: HR 3923 is not in the catalogue; kiehling: HR 3923 is not among its 60 stars; kharitonov: HR 3923 is not in the catalogue; burnashev: BS 3923 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,836 K and log g 1.3 (u1 0.980, u2 -0.138): a model, because no fit of this star's limb is used. Gravity: log g 1.3 from 2019A&A...627A.138A; the 1 published value span log g 1.3 to 1.3, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 85951" (revision 1374551210) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
