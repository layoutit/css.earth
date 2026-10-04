# Zhou

## Sources

Its brightness, measured band by band, gives 60 times the Sun's luminosity at 8,399 K, so 3.651 solar radii. It is also HD 141003, HR 5867, HIP 77233. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1195823284391343104, distance 48 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77233: distance 47.551 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold; Gaia DR3's parallax, 21.592 ± 0.307 mas (70.3 standard errors), is not used. Radius 3.651 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77233: radius 3.651 solar radii, implied by the fitted luminosity 59.598 solar luminosities (fractional uncertainty 0.118) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,399 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 77233: effective temperature 8399 +/- 526 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.045). log g 3.45 from 2023ApJS..266...11B ("New Generation Stellar Spectral Libraries in the Optical and Near-infrared. I. The Recalibrated UVES-POP Library for Stellar Population Synthesis.").

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 727: HR 5867; VizieR III/202, through the CIE 1931 2° observer: #bfcfff. Routes tried in order: stis-ngsl: HD 141003 is not in the library; pulkovo: HR 5867 is not in the catalogue; kiehling: HR 5867 is not among its 60 stars; burnashev: BS 5867 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,399 K and log g 3.45 (u1 0.321, u2 0.308): a model, because no fit of this star's limb is used. Gravity: log g 3.45 from 2023ApJS..266...11B; the 1 published value span log g 3.4522 to 3.4522, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Serpentis" (revision 1374787335) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
