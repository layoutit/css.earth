# Zibbatu

## Sources

Its brightness, measured band by band, gives 3.838 times the Sun's luminosity at 6,136 K, so 1.736 solar radii. It is also HD 12235, HR 582, HIP 9353. The introduction is generated from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2511794495013074048, distance 34 pc from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9353: distance 33.501 pc, the paper's parallax inverted (Gaia DR1's where it revised the star's, else the Hipparcos reduction of van Leeuwen 2007; section 2.3; fractional uncertainty 0.015), at which the luminosity and radius hold; Gaia DR3's parallax, 31.449 ± 0.057 mas (555.2 standard errors), is not used. Radius 1.736 solar radii from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9353: radius 1.736 solar radii, implied by the fitted luminosity 3.838 solar luminosities (fractional uncertainty 0.044) and temperature (https://doi.org/10.1093/mnras/stx1433). No mass is measured, so GM is 0, the records' unpublished value. Temperature 6,136 K from McDonald, Zijlstra & Watson (2017), MNRAS 471, 770, table 2, HIP 9353: effective temperature 6136 +/- 125 K, from the fit of a model atmosphere to the star's spectral energy distribution (goodness of fit Q 0.081). log g 4.23 from 2024A&A...691A..53S ("SWEET-Cat: A view on the planetary mass-radius relation.").

**Color.** A Planck spectrum at 6,136 K, because no archive holds a spectrum of this star (stis-ngsl: HD 12235 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 582 is not in the catalogue; kiehling: HR 582 is not among its 60 stars; kharitonov: HR 582 is not in the catalogue; burnashev: BS 582 is not in part2), through the CIE 1931 2° observer: #fff5f4. Routes tried in order: stis-ngsl: HD 12235 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 582 is not in the catalogue; kiehling: HR 582 is not among its 60 stars; kharitonov: HR 582 is not in the catalogue; burnashev: BS 582 is not in part2; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,136 K and log g 4.23 (u1 0.393, u2 0.297): a model, because no fit of this star's limb is used. Gravity: log g 4.23 from 2024A&A...691A..53S; the 16 published values span log g 3.99 to 4.43, across which the limb law changes by at most 0.1% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "112 Piscium" (revision 1376873464) verbatim, CC BY-SA 4.0.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
