# Sadalsuud

## Sources

Its disc spans 2.704 milliarcseconds, which gives 47.88 solar radii and 5,608 K at its surface. It is also HD 204867, HR 8232, HIP 106278. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2671038928727970944, distance 165 pc from Baines et al. (2018), AJ 155, 30, HD 204867: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 6.07 +/- 0.22 mas, inverted; Gaia DR3's parallax, 5.973 ± 0.215 mas (27.8 standard errors), is not used. Radius 47.88 +/- 1.81 solar radii from Baines et al. (2018), AJ 155, 30, HD 204867: radius 47.88 +1.81/-1.68 solar radii (Table 5), from the limb-darkened angular diameter 2.704 +/- 0.009 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 4.97 +/- 0.1 solar masses from Baines et al. (2018), AJ 155, 30, HD 204867: mass 4.97 +/- 0.1 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,608 K from Baines et al. (2018), AJ 155, 30, HD 204867: effective temperature 5608 +/- 71 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 1.77 from the mass and radius.

**Color.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 204867: 168-1020 nm, cross-checked against Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Sadalsuud is HR 8232. (7 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffefdd. Routes tried in order: kiehling: HR 8232 is not among its 60 stars; kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,608 K and log g 1.77 (u1 0.480, u2 0.235): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 7 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
