# Kang

## Sources

Its brightness, measured band by band, gives 203 times the Sun's luminosity at 4,220 K, so 26.674 solar radii. It is also HD 124294, HR 5315, HIP 69427. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6304988355324252928, distance 78 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69427: distance 78.125 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.02), at which the luminosity and radius hold; Gaia DR3's parallax, 11.588 ± 0.163 mas (71.3 standard errors), is not used. Radius 26.674 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69427: radius 26.674 solar radii, implied by the fitted luminosity 202.724 solar luminosities (fractional uncertainty 0.062) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,220 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 69427: effective temperature 4220 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.031). log g 1.83 from 2016A&A...588A..98M ("Evolved stars and the origin of abundance trends in planet hosts.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 680: HR 5315; VizieR III/202, through the CIE 1931 2° observer: #ffd5a2. Routes tried in order: stis-ngsl: HD 124294 is not in the library; pulkovo: HR 5315 is not in the catalogue; kiehling: HR 5315 is not among its 60 stars; burnashev: BS 5315 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,220 K and log g 1.83 (u1 0.863, u2 -0.034): a model, because no fit of this star's limb is used. Gravity: log g 1.83 from 2016A&A...588A..98M; the 11 published values span log g 1.05 to 2.06, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kappa Virginis" (revision 1353195644) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
