# Matar

## Sources

Its disc spans 3.471 milliarcseconds, which gives 24.51 solar radii and 4,970 K at its surface. It is also HD 215182, HR 8650, HIP 112158. The introduction is generated from Baines et al. (2018), AJ 155, 30's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1887953690728237568, distance 66 pc from Baines et al. (2018), AJ 155, 30, HD 215182: the Hipparcos (van Leeuwen 2007) parallax the radius was computed with (Table 1), 15.22 +/- 0.71 mas, inverted; Gaia DR3's parallax, 16.631 ± 0.705 mas (23.6 standard errors), is not used. Radius 24.51 +/- 1.21 solar radii from Baines et al. (2018), AJ 155, 30, HD 215182: radius 24.51 +1.21/-1.11 solar radii (Table 5), from the limb-darkened angular diameter 3.471 +/- 0.027 mas (NPOI, Table 4) and the Hipparcos (van Leeuwen 2007) parallax (https://doi.org/10.3847/1538-3881/aa9d8b). Mass 3.51 +/- 0.13 solar masses from Baines et al. (2018), AJ 155, 30, HD 215182: mass 3.51 +/- 0.13 solar masses (Table 6), from the PARAM Bayesian fit to PARSEC isochrones at the measured temperature; the paper calls its masses estimates only (https://doi.org/10.3847/1538-3881/aa9d8b). Temperature 4,970 K from Baines et al. (2018), AJ 155, 30, HD 215182: effective temperature 4970 +/- 65 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.2 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Matar is HR 8650., cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 1076: HR 8650; VizieR III/202 (3 levels apart at most, the threshold is 12). Of the companion a double-star catalogue lists: the spectrum includes Matar's close companion, which is not drawn: Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 22430+3013 BLA 11 Aa,Ab at magnitudes 4.1 and 6.9, so it gives 7.0% of the light and can move a color channel by 18 levels of 255 at most; the measurement is kept, since a model color would replace all of it, through the CIE 1931 2° observer: #ffecd2. Routes tried in order: stis-ngsl: HD 215182 is not in the library; kiehling: HR 8650 is not among its 60 stars; burnashev: found, not needed after the color and its cross-check; gaia-xp: found, not needed after the color and its cross-check; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,970 K and log g 2.2 (u1 0.630, u2 0.146): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 3 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
