# Minelauva

## Sources

Its brightness, measured band by band, gives 697 times the Sun's luminosity at 3,657 K, so 65.88 solar radii. It is also HD 112300, HR 4910, HIP 63090. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3704342295607157120, distance 61 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 63090: distance 60.827 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.013), at which the luminosity and radius hold; Gaia DR3's parallax, 17.406 ± 0.251 mas (69.3 standard errors), is not used. Radius 65.88 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 63090: radius 65.88 solar radii, implied by the fitted luminosity 697.427 solar luminosities (fractional uncertainty 0.07) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,657 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 63090: effective temperature 3657 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.171). log g 0.8 from 2012ApJ...761..161S ("Identifying contributions to the stellar halo from accreted, kicked-out,  and in situ populations.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Minelauva is HR 4910., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * del Vir is HR 4910. (11 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcf83. Routes tried in order: stis-ngsl: HD 112300 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 4910 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,657 K and log g 0.8 (u1 1.033, u2 -0.185): a model, because no fit of this star's limb is used. Gravity: log g 0.8 from 2012ApJ...761..161S, the median of its 2 spectra; the 8 published values span log g 0.8 to 1.3, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 11 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Virginis" (revision 1374585312) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
