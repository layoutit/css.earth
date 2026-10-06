# Sadalmelik

## Sources

Its disc spans 3.066 milliarcseconds, which gives 52.89 solar radii and 5,383 K at its surface. It is also HD 209750, HR 8414, HIP 109074. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2680356911816018048, distance 161 pc from Baines et al. (2018), AJ 155, 30, HD 209750: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 6.23 +/- 0.19 mas, inverted; Gaia DR3's parallax, 4.945 ± 0.430 mas (11.5 standard errors), is not used. Radius 52.89 +/- 1.78 solar radii from Baines et al. (2018), AJ 155, 30, HD 209750: radius 52.89 +1.78/-1.68 solar radii (Table 5), from the limb-darkened angular diameter 3.066 +/- 0.036 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 5.13 +/- 0.06 solar masses from Baines et al. (2018), AJ 155, 30, HD 209750: mass 5.13 +/- 0.06 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,383 K from Baines et al. (2018), AJ 155, 30, HD 209750: effective temperature 5383 +/- 74 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1.7 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Sadalmelik is HR 8414., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1033: HR 8414; VizieR III/202 (10 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe6c5. Routes tried in order: stis-ngsl: HD 209750 is not in the library; kiehling: HR 8414 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,383 K and log g 1.7 (u1 0.526, u2 0.209): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 10 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
