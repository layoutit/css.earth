# Gamma Persei

## Sources

Its disc spans 3.894 milliarcseconds, which gives 31.21 solar radii and 4,589 K at its surface. It is also HD 18926, HR 915, HIP 14328. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 447071293401293056, distance 75 pc from Baines et al. (2018), AJ 155, 30, HD 18925: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 13.41 +/- 0.51 mas, inverted; Gaia DR3's parallax, 14.125 ± 0.768 mas (18.4 standard errors), is not used. Radius 31.21 +/- 1.24 solar radii from Baines et al. (2018), AJ 155, 30, HD 18925: radius 31.21 +1.24/-1.15 solar radii (Table 5), from the limb-darkened angular diameter 3.894 +/- 0.018 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 3.64 +/- 0.25 solar masses from Baines et al. (2018), AJ 155, 30, HD 18925: mass 3.64 +/- 0.25 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 4,589 K from Baines et al. (2018), AJ 155, 30, HD 18925: effective temperature 4589 +/- 58 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.01 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Gamma Persei is HR 915., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 159: HR 915; VizieR III/202 (10 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffeee1. Routes tried in order: stis-ngsl: HD 18926 is not in the library; kiehling: HR 915 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,589 K and log g 2.01 (u1 0.743, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 10 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
