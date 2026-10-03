# Mebsuta

## Sources

Its disc spans 4.677 milliarcseconds, which gives 130.22 solar radii and 5,009 K at its surface. It is also HD 48329, HR 2473, HIP 32246. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3384529341302871296, distance 259 pc from Baines et al. (2018), AJ 155, 30, HD 48329: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 3.86 +/- 0.17 mas, inverted; Gaia DR3's parallax, 3.748 ± 0.184 mas (20.4 standard errors), is not used. Radius 130.22 +/- 6.01 solar radii from Baines et al. (2018), AJ 155, 30, HD 48329: radius 130.22 +6.01/-5.51 solar radii (Table 5), from the limb-darkened angular diameter 4.677 +/- 0.013 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 5.29 +/- 0.04 solar masses from Baines et al. (2018), AJ 155, 30, HD 48329: mass 5.29 +/- 0.04 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,009 K from Baines et al. (2018), AJ 155, 30, HD 48329: effective temperature 5009 +/- 63 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 0.93 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Mebsuta is HR 2473., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 445: HR 2473; VizieR III/202 (3 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffd698. Routes tried in order: stis-ngsl: HD 48329 is not in the library; kiehling: HR 2473 is not among its 60 stars; burnashev: BS 2473 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,009 K and log g 0.93 (u1 0.619, u2 0.142): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
