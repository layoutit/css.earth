# Zaurak

## Sources

Its disc spans 9.286 milliarcseconds, which gives 58.7 solar radii and 3,779 K at its surface. It is also HD 25025, HR 1231, HIP 18543. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5111187420714898304, distance 59 pc from Baines et al. (2021), AJ 162, 198, HD 25025: the Gaia EDR3 (Gaia Collaboration 2021) parallax the radius was computed with (Table 1), 17 +/- 0.23 mas, inverted; Gaia DR3's parallax, 17.002 ± 0.225 mas (75.4 standard errors), is not used. Radius 58.7 +/- 0.82 solar radii from Baines et al. (2021), AJ 162, 198, HD 25025: radius 58.7 +0.8/-0.82 solar radii (Table 5), from the limb-darkened angular diameter 9.286 +/- 0.028 mas (NPOI, Table 4) and the Gaia EDR3 (Gaia Collaboration 2021) parallax (https://doi.org/10.3847/1538-3881/ac2431). No mass is measured, so GM is 0, the records' unpublished value. Temperature 3,779 K from Baines et al. (2021), AJ 162, 198, HD 25025: effective temperature 3779 +/- 34 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1 from 2008AJ....135..209M ("Rotational and radial velocities for a sample of 761 Hipparcos giants and  the role of binarity.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Zaurak is HR 1231., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 249: HR 1231; VizieR III/202 (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffc882. Routes tried in order: stis-ngsl: HD 25025 is not in the library; kiehling: HR 1231 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,779 K and log g 1 (u1 0.999, u2 -0.155): a model, because no fit of this star's limb is used. Gravity: log g 1 from 2008AJ....135..209M; the 1 published value span log g 1 to 1, across which the limb law changes by at most 0.0% of the centre brightness.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
