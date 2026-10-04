# Almach

## Sources

Its brightness, measured band by band, gives 2,987 times the Sun's luminosity at 4,302 K, so 98.515 solar radii. It is also HD 12533, HR 603, HIP 9640. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 9640 (SIMBAD HIP 9640); placed by that row, not by a Gaia source, distance 120 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9640: distance 120.482 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.125), at which the luminosity and radius hold. Radius 98.515 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9640: radius 98.515 solar radii, implied by the fitted luminosity 2986.6 solar luminosities (fractional uncertainty 0.138) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,302 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9640: effective temperature 4302 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.066). log g 1.84 from 2023ApJS..266...41P ("HST Low-resolution Stellar Library.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Almach is HR 603., through the CIE 1931 2° observer: #ffd7a7. Routes tried in order: stis-ngsl: the library marks HD 12533's spectrum DATAQUAL suspect; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 603 is not among its 60 stars; kharitonov: HR 603 is not in the catalogue; burnashev: BS 603 is not in part2; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,302 K and log g 1.84 (u1 0.836, u2 -0.012): a model, because no fit of this star's limb is used. Gravity: log g 1.84 from 2023ApJS..266...41P; the 10 published values span log g 0.92 to 1.84, across which the limb law changes by at most 0.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gamma Andromedae" (revision 1370775952) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
