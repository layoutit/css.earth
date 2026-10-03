# Cebalrai

## Sources

Its disc spans 4.511 milliarcseconds, which gives 12.17 solar radii and 4,559 K at its surface. It is also HD 161096, HR 6603, HIP 86742. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4473334474604992384, distance 25 pc from Baines et al. (2018), AJ 155, 30, HD 161096: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 39.85 +/- 0.17 mas, inverted; Gaia DR3's parallax, 39.228 ± 0.203 mas (193.6 standard errors), is not used. Radius 12.17 +/- 0.06 solar radii from Baines et al. (2018), AJ 155, 30, HD 161096: radius 12.17 +/- 0.06 solar radii (Table 5), from the limb-darkened angular diameter 4.511 +/- 0.011 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 1.44 +/- 0.16 solar masses from Baines et al. (2018), AJ 155, 30, HD 161096: mass 1.44 +/- 0.16 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 4,559 K from Baines et al. (2018), AJ 155, 30, HD 161096: effective temperature 4559 +/- 57 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.43 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Cebalrai is HR 6603., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 338 (BS 6603) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffdbb0. Routes tried in order: stis-ngsl: HD 161096 is not in the library; kiehling: HR 6603 is not among its 60 stars; kharitonov: HR 6603 is not in the catalogue; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,559 K and log g 2.43 (u1 0.760, u2 0.049): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
