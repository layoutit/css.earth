# Kornephoros

## Sources

Its disc spans 3.472 milliarcseconds, which gives 15.92 solar radii and 5,092 K at its surface. It is also HD 148856, HR 6148, HIP 80816. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1297565458994346240, distance 43 pc from Baines et al. (2018), AJ 155, 30, HD 148856: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 23.44 +/- 0.58 mas, inverted; Gaia DR3's parallax, 22.002 ± 0.987 mas (22.3 standard errors), is not used. Radius 15.92 +/- 0.41 solar radii from Baines et al. (2018), AJ 155, 30, HD 148856: radius 15.92 +0.41/-0.39 solar radii (Table 5), from the limb-darkened angular diameter 3.472 +/- 0.008 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 2.91 +/- 0.11 solar masses from Baines et al. (2018), AJ 155, 30, HD 148856: mass 2.91 +/- 0.11 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 5,092 K from Baines et al. (2018), AJ 155, 30, HD 148856: effective temperature 5092 +/- 64 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.5 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Kornephoros is HR 6148., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 755: HR 6148; VizieR III/202 (5 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffe8cb. Routes tried in order: stis-ngsl: HD 148856 is not in the library; kiehling: HR 6148 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,092 K and log g 2.5 (u1 0.600, u2 0.168): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 5 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
