# Ancha

## Sources

Its brightness, measured band by band, gives 69 times the Sun's luminosity at 4,990 K, so 11.131 solar radii. It is also HD 211391, HR 8499, HIP 110003. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2616542115933350144, distance 57 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 110003: distance 57.471 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.013), at which the luminosity and radius hold; Gaia DR3's parallax, 17.089 ± 0.147 mas (116.2 standard errors), is not used. Radius 11.131 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 110003: radius 11.131 solar radii, implied by the fitted luminosity 69.021 solar luminosities (fractional uncertainty 0.052) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,990 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 110003: effective temperature 4990 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.038). log g 2.57 from 2014ApJ...785...94L ("The lithium abundances of a large sample of red giants.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1049: HR 8499; VizieR III/202, through the CIE 1931 2° observer: #ffecc8. Routes tried in order: stis-ngsl: HD 211391 is not in the library; pulkovo: HR 8499 is not in the catalogue; kiehling: HR 8499 is not among its 60 stars; burnashev: BS 8499 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,990 K and log g 2.57 (u1 0.628, u2 0.148): a model, because no fit of this star's limb is used. Gravity: log g 2.57 from 2014ApJ...785...94L; the 10 published values span log g 2.4 to 3.1, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Theta Aquarii" (revision 1343024539) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
