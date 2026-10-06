# Tarazed

## Sources

Its disc spans 7.056 milliarcseconds, which gives 91.81 solar radii and 4,098 K at its surface. It is also HD 186791, HR 7525, HIP 97278. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4302054339959905920, distance 121 pc from Baines et al. (2018), AJ 155, 30, HD 186791: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 8.26 +/- 0.17 mas, inverted; Gaia DR3's parallax, 5.590 ± 0.388 mas (14.4 standard errors), is not used. Radius 91.81 +/- 2.19 solar radii from Baines et al. (2018), AJ 155, 30, HD 186791: radius 91.81 +2.19/-2.12 solar radii (Table 5), from the limb-darkened angular diameter 7.056 +/- 0.08 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 3.51 +/- 0.23 solar masses from Baines et al. (2018), AJ 155, 30, HD 186791: mass 3.51 +/- 0.23 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 4,098 K from Baines et al. (2018), AJ 155, 30, HD 186791: effective temperature 4098 +/- 56 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1.06 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Tarazed is HR 7525., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 886: HR 7525; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffcf8a. Routes tried in order: stis-ngsl: HD 186791 is not in the library; kiehling: HR 7525 is not among its 60 stars; burnashev: BS 7525 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,098 K and log g 1.06 (u1 0.902, u2 -0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
