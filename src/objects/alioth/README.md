# Alioth

## Sources

Its disc spans 1.644 milliarcseconds, which gives 4.29 solar radii and 8,908 K at its surface. It is also HD 112185, HR 4905, HIP 62956. The introduction is generated from Baines et al. (2023), AJ 166, 268's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1576683529448755328, distance 24 pc from Baines et al. (2023), AJ 166, 268, HD 112185: the Gaia DR2 (Gaia Collaboration 2018) parallax the radius was computed with (Table 2), 41.22 +/- 1.84 mas, inverted; Gaia DR3 gives it no parallax. Radius 4.29 +/- 0.21 solar radii from Baines et al. (2023), AJ 166, 268, HD 112185: radius 4.29 +0.19/-0.21 solar radii (Table 7), from the limb-darkened angular diameter 1.644 +/- 0.02 mas (NPOI, Table 5) and the Gaia DR2 (Gaia Collaboration 2018) parallax (https://doi.org/10.3847/1538-3881/ad08be). No mass is measured, so GM is 0, the records' unpublished value. Temperature 8,908 K from Baines et al. (2023), AJ 166, 268, HD 112185: effective temperature 8908 +/- 54 K (Table 7), from the angular diameter and the bolometric flux of the SED fit. log g 3.59 from Baines et al. (2023), AJ 166, 268, HD 112185: log g 3.59, from McDonald et al. (2017), as the paper lists it beside the diameter (Table 5).

**Color.** Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 635: HR 4905; VizieR III/202, through the CIE 1931 2° observer: #b5caff. Routes tried in order: stis-ngsl: HD 112185 is not in the library; pulkovo: HR 4905 is not in the catalogue; kiehling: HR 4905 is not among its 60 stars; burnashev: BS 4905 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; kharitonov: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,908 K and log g 3.59 (u1 0.280, u2 0.318): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-07 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
