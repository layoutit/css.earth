# Alshain

## Sources

Its brightness, measured band by band, gives 5.899 times the Sun's luminosity at 5,121 K, so 3.09 solar radii. It is also HD 188512, HR 7602, HIP 98036. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4296708789290712064, distance 14 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98036: distance 13.699 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.003), at which the luminosity and radius hold; Gaia DR3's parallax, 73.525 ± 0.142 mas (519.5 standard errors), is not used. Radius 3.09 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98036: radius 3.09 solar radii, implied by the fitted luminosity 5.899 solar luminosities (fractional uncertainty 0.049) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,121 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 98036: effective temperature 5121 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.031). log g 3.55 from 2025A&A...700A..39K ("Asteroseismology of the G8 subgiant {\em β} Aquilae with SONG-Tenerife, SONG-Australia and TESS.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Alshain is HR 7602., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 902: HR 7602; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffead3. Routes tried in order: stis-ngsl: HD 188512 is not in the library; kiehling: HR 7602 is not among its 60 stars; burnashev: BS 7602 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,121 K and log g 3.55 (u1 0.607, u2 0.161): a model, because no fit of this star's limb is used. Gravity: log g 3.55 from 2025A&A...700A..39K; the 55 published values span log g 1.3 to 3.86, across which the limb law changes by at most 1.3% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
