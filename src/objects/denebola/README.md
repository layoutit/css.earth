# Denebola

## Sources

Its brightness, measured band by band, gives 14 times the Sun's luminosity at 8,730 K, so 1.61 solar radii. It is also HD 102647, HR 4534, HIP 57632. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 57632 (SIMBAD HIP 57632); placed by that row, not by a Gaia source, distance 11.00 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 57632: distance 11 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.006), at which the luminosity and radius hold. Radius 1.61 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 57632: radius 1.61 solar radii, implied by the fitted luminosity 13.535 solar luminosities (fractional uncertainty 0.133) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,730 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 57632: effective temperature 8730 +/- 612 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.054). log g 4.26 from 2003A&A...398.1121E ("Automated spectroscopic abundances of A and F-type stars using echelle spectrographs II. Abundances of 140 A-F stars from  ELODIE and CORALIE.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Denebola is HR 4534., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 607: HR 4534; VizieR III/202 (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #c3d5ff. Routes tried in order: stis-ngsl: HD 102647 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 4534 is not among its 60 stars; burnashev: BS 4534 is not in part2; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,730 K and log g 4.26 (u1 0.297, u2 0.313): a model, because no fit of this star's limb is used. Gravity: log g 4.26 from 2003A&A...398.1121E; the 2 published values span log g 4.22 to 4.26, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Denebola" (revision 1370774836) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
