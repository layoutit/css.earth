# Arneb

## Sources

Its brightness, measured band by band, gives 30,502 times the Sun's luminosity at 6,941 K, so 120.942 solar radii. It is also HD 36673, HR 1865, HIP 25985. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 25985 (SIMBAD HIP 25985); placed by that row, not by a Gaia source, distance 680 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25985: distance 680.272 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.095), at which the luminosity and radius hold. Radius 120.942 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25985: radius 120.942 solar radii, implied by the fitted luminosity 30502.4 solar luminosities (fractional uncertainty 0.102) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,941 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 25985: effective temperature 6941 +/- 142 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.048). log g 1.34 from 2019MNRAS.489.1533L ("Oxygen abundance and the N/C versus N/O relation for AFG supergiants and bright giants.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Arneb is HR 1865., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * alf Lep is HR 1865. (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #d6dfff. Routes tried in order: stis-ngsl: HD 36673 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,941 K and log g 1.34 (u1 0.506, u2 0.195): a model, because no fit of this star's limb is used. Gravity: log g 1.34 from 2019MNRAS.489.1533L; the 11 published values span log g 1.1 to 1.75, across which the limb law changes by at most 0.6% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Alpha Leporis" (revision 1353060596) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
