# Alphecca

## Sources

Its disc spans 1.525 milliarcseconds, which gives 3.88 solar radii and 8,152 K at its surface. It is also HD 139006, HR 5793, HIP 76267. The introduction is generated from Baines et al. (2025), AJ 169, 293's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1222646935698492160, distance 24 pc from Baines et al. (2025), AJ 169, 293, HD 139006: the Gaia DR3 (Gaia Collaboration 2022) parallax the radius was computed with (Table 2), 42.24 +/- 0.98 mas, inverted; Gaia DR3's parallax, 42.241 ± 0.977 mas (43.2 standard errors), is not used. Radius 3.88 +/- 0.11 solar radii from Baines et al. (2025), AJ 169, 293, HD 139006: radius 3.88 +/- 0.11 solar radii (Table 7), from the limb-darkened angular diameter 1.525 +/- 0.027 mas (NPOI, Table 6) and the Gaia DR3 (Gaia Collaboration 2022) parallax (https://doi.org/10.3847/1538-3881/adc930). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,152 K from Baines et al. (2025), AJ 169, 293, HD 139006: effective temperature 8152 +/- 93 K (Table 7), from the angular diameter and the bolometric flux of the SED fit. log g 3.82 from Baines et al. (2025), AJ 169, 293, HD 139006: log g 3.82, from Allende Prieto & Lambert (1999), as the paper lists it beside the diameter (Table 6).

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 720: HR 5793; VizieR III/202, through the CIE 1931 2° observer: #b7caff. Routes tried in order: stis-ngsl: HD 139006 is not in the library; pulkovo: HR 5793 is not in the catalogue; kiehling: HR 5793 is not among its 60 stars; burnashev: BS 5793 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,152 K and log g 3.82 (u1 0.330, u2 0.312): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
