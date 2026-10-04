# Kaus Media

## Sources

Its brightness, measured band by band, gives 1,393 times the Sun's luminosity at 4,333 K, so 66.322 solar radii. It is also HD 168454, HR 6859, HIP 89931. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4049506483413484672, distance 107 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 89931: distance 106.61 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.019), at which the luminosity and radius hold; Gaia DR3's parallax, 7.847 ± 0.479 mas (16.4 standard errors), is not used. Radius 66.322 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 89931: radius 66.322 solar radii, implied by the fitted luminosity 1393.05 solar luminosities (fractional uncertainty 0.061) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,333 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 89931: effective temperature 4333 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.076). log g 0.45 from 1995AJ....110.2968L ("Chemical abundances for very strong-lined giants.").

**Color.** Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 245 (BS 6859), through the CIE 1931 2° observer: #ffd39a. Routes tried in order: stis-ngsl: HD 168454 is not in the library; pulkovo: the spectrum was found but gives no color (Pulkovo flux must be finite.); kiehling: HR 6859 is not among its 60 stars; kharitonov: HR 6859 is not in the catalogue; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; burnashev: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,333 K and log g 0.45 (u1 0.822, u2 -0.010): a model, because no fit of this star's limb is used. Gravity: log g 0.45 from 1995AJ....110.2968L, the median of its 6 spectra; the 10 published values span log g 0.3 to 2.23, across which the limb law changes by at most 0.9% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Delta Sagittarii" (revision 1374877320) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
