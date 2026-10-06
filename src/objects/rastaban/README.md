# Rastaban

## Sources

Its brightness, measured band by band, gives 996 times the Sun's luminosity at 5,113 K, so 40.284 solar radii. It is also HD 159181, HR 6536, HIP 85670. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 85670 (SIMBAD HIP 85670); placed by that row, not by a Gaia source, distance 117 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 85670: distance 116.55 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.012), at which the luminosity and radius hold. Radius 40.284 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 85670: radius 40.284 solar radii, implied by the fitted luminosity 996.471 solar luminosities (fractional uncertainty 0.05) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,113 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 85670: effective temperature 5113 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.049). log g 2.05 from 2024A&A...692A.189R ("In pursuit of precise Ca II H&K chromospheric surface fluxes A gravity and temperature dependence.").

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 159181: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Rastaban is HR 6536. (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe9cc. Routes tried in order: gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 6536 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 6536 is not in part2; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,113 K and log g 2.05 (u1 0.591, u2 0.172): a model, because no fit of this star's limb is used. Gravity: log g 2.05 from 2024A&A...692A.189R; the 24 published values span log g 1.35 to 2.05, across which the limb law changes by at most 0.6% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Beta Draconis" (revision 1377345578) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
