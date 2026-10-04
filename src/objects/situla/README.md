# Situla

## Sources

Its brightness, measured band by band, gives 43 times the Sun's luminosity at 4,656 K, so 10.134 solar radii. It is also HD 214376, HR 8610, HIP 111710. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2624940628127167616, distance 66 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 111710: distance 65.574 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.014), at which the luminosity and radius hold; Gaia DR3's parallax, 14.715 ± 0.100 mas (147.8 standard errors), is not used. Radius 10.134 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 111710: radius 10.134 solar radii, implied by the fitted luminosity 43.36 solar luminosities (fractional uncertainty 0.055) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,656 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 111710: effective temperature 4656 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.099). log g 2.55 from 2008A&A...484L..21M ("Chemical similarities between Galactic bulge and local thick disk red  giant stars.").

**Color.** A Planck spectrum at 4,656 K, because no archive holds a spectrum of this star (stis-ngsl: HD 214376 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 8610 is not in the catalogue; kiehling: HR 8610 is not among its 60 stars; kharitonov: HR 8610 is not in the catalogue; burnashev: BS 8610 is not in part2), through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: HD 214376 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 8610 is not in the catalogue; kiehling: HR 8610 is not among its 60 stars; kharitonov: HR 8610 is not in the catalogue; burnashev: BS 8610 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,656 K and log g 2.55 (u1 0.730, u2 0.072): a model, because no fit of this star's limb is used. Gravity: log g 2.55 from 2008A&A...484L..21M; the 6 published values span log g 2.5 to 2.71, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kappa Aquarii" (revision 1343020919) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
