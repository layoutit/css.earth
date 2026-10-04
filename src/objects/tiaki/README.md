# Tiaki

## Sources

Its brightness, measured band by band, gives 3,221 times the Sun's luminosity at 3,508 K, so 153.871 solar radii. It is also HD 214952, HR 8636, HIP 112122. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 112122 (SIMBAD HIP 112122); placed by that row, not by a Gaia source, distance 54.26 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112122: distance 54.259 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.023), at which the luminosity and radius hold. Radius 153.871 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112122: radius 153.871 solar radii, implied by the fitted luminosity 3221.38 solar luminosities (fractional uncertainty 0.075) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,508 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 112122: effective temperature 3508 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.26). log g 3.47 from 2023ApJS..266...11B ("New Generation Stellar Spectral Libraries in the Optical and Near-infrared. I. The Recalibrated UVES-POP Library for Stellar Population Synthesis.").

**Color.** A Planck spectrum at 3,508 K, because no archive holds a spectrum of this star (stis-ngsl: HD 214952 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 8636 is not in the catalogue; kiehling: HR 8636 is not among its 60 stars; kharitonov: HR 8636 is not in the catalogue; burnashev: BS 8636 is not in part2), through the CIE 1931 2° observer: #ffc78c. Routes tried in order: stis-ngsl: HD 214952 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: HR 8636 is not in the catalogue; kiehling: HR 8636 is not among its 60 stars; kharitonov: HR 8636 is not in the catalogue; burnashev: BS 8636 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,508 K and log g 3.47 (u1 0.799, u2 0.030): a model, because no fit of this star's limb is used. Gravity: log g 3.47 from 2023ApJS..266...11B; the 1 published value span log g 3.47 to 3.47, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Gruis" (revision 1376496665) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
