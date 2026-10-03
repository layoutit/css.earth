# Unukalhai

## Sources

Its disc spans 4.77 milliarcseconds, which gives 11.62 solar radii and 4,687 K at its surface. It is also HD 140573, HR 5854, HIP 77070. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4429785739602747392, distance 23 pc from Baines et al. (2018), AJ 155, 30, HD 140573: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 44.1 +/- 0.19 mas, inverted; Gaia DR3's parallax, 43.945 ± 0.468 mas (94.0 standard errors), is not used. Radius 11.62 +/- 0.06 solar radii from Baines et al. (2018), AJ 155, 30, HD 140573: radius 11.62 +/- 0.06 solar radii (Table 5), from the limb-darkened angular diameter 4.77 +/- 0.013 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 1.61 +/- 0.12 solar masses from Baines et al. (2018), AJ 155, 30, HD 140573: mass 1.61 +/- 0.12 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 4,687 K from Baines et al. (2018), AJ 155, 30, HD 140573: effective temperature 4687 +/- 59 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.51 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Unukalhai is HR 5854., cross-checked against Kiehling (1987), spectrophotometry of 60 bright F, G, K and M stars, 320-880 nm in 1 nm steps as normalised magnitudes: Kiehling (1987), A&AS 69, 465; VizieR III/124. * alf Ser is HR 5854. (4 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #ffddb1. Routes tried in order: stis-ngsl: HD 140573 is not in the library; kharitonov: found, not needed after the color and its cross-check; burnashev: found, not needed after the color and its cross-check; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,687 K and log g 2.51 (u1 0.719, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 4 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
