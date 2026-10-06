# Alkaid

## Sources

Its disc spans 0.981 milliarcseconds, which gives 3.4 solar radii and 15,540 K at its surface. It is also HD 120315, HR 5191, HIP 67301. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1510374147844219904, distance 32 pc from Baines et al. (2018), AJ 155, 30, HD 120315: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 31.38 +/- 0.24 mas, inverted; Gaia DR3 gives it no parallax. Radius 3.4 +/- 0.5 solar radii from Baines et al. (2018), AJ 155, 30, HD 120315: radius 3.4 +/- 0.5 solar radii (Table 5), from the limb-darkened angular diameter 0.981 +/- 0.144 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). No mass is measured, so GM is 0, the records' unpublished value. Temperature 15,540 K from Baines et al. (2018), AJ 155, 30, HD 120315: effective temperature 15540 +/- 1157 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 3.78 from Baines et al. (2018), AJ 155, 30, HD 120315: log g 3.78, from Allende Prieto & Lambert (1999), as the paper lists it beside the diameter (Table 4).

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Alkaid is HR 5191., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 671: HR 5191; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #a9c3ff. Routes tried in order: stis-ngsl: HD 120315 is not in the library; kiehling: HR 5191 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 15,540 K and log g 3.78 (u1 0.142, u2 0.285): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
