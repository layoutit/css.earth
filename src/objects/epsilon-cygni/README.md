# Epsilon Cygni

## Sources

Its disc spans 4.985 milliarcseconds, which gives 12.41 solar radii and 4,659 K at its surface. It is also HD 197989, HR 7949, HIP 102488. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1869302503206674304, distance 23 pc from Baines et al. (2021), AJ 162, 198, HD 197989: the Gaia DR2 (Gaia Collaboration 2018) parallax the radius was computed with (Table 1), 43.18 +/- 0.94 mas, inverted; Gaia DR3 gives it no parallax. Radius 12.41 +/- 0.3 solar radii from Baines et al. (2021), AJ 162, 198, HD 197989: radius 12.41 +0.29/-0.3 solar radii (Table 5), from the limb-darkened angular diameter 4.985 +/- 0.046 mas (NPOI, Table 4) and the Gaia DR2 (Gaia Collaboration 2018) parallax (https://doi.org/10.3847/1538-3881/ac2431). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,659 K from Baines et al. (2021), AJ 162, 198, HD 197989: effective temperature 4659 +/- 35 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.67 from Baines et al. (2021), AJ 162, 198, HD 197989: log g 2.67, from Allende Prieto & Lambert (1999), as the paper lists it beside the diameter (Table 4).

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Epsilon Cygni is HR 7949., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 959: HR 7949; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe3be. Routes tried in order: stis-ngsl: HD 197989 is not in the library; kiehling: HR 7949 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,659 K and log g 2.67 (u1 0.731, u2 0.070): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
