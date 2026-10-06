# Epsilon Leonis

## Sources

Its disc spans 2.587 milliarcseconds, which gives 21.03 solar radii and 5,623 K at its surface. It is also HD 84441, HR 3873, HIP 47908. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 641662895638787584, distance 76 pc from Baines et al. (2018), AJ 155, 30, HD 84441: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 13.22 +/- 0.15 mas, inverted; Gaia DR3's parallax, 14.339 ± 0.321 mas (44.7 standard errors), is not used. Radius 21.03 +/- 0.32 solar radii from Baines et al. (2018), AJ 155, 30, HD 84441: radius 21.03 +0.32/-0.31 solar radii (Table 5), from the limb-darkened angular diameter 2.587 +/- 0.025 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 3.71 +/- 0.04 solar masses from Baines et al. (2018), AJ 155, 30, HD 84441: mass 3.71 +/- 0.04 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,623 K from Baines et al. (2018), AJ 155, 30, HD 84441: effective temperature 5623 +/- 75 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.36 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Epsilon Leonis is HR 3873., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * eps Leo is HR 3873. (6 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffedd7. Routes tried in order: stis-ngsl: HD 84441 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: BS 3873 is not in part2; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,623 K and log g 2.36 (u1 0.473, u2 0.246): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 6 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
