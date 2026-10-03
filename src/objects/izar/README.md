# Izar

## Sources

Its disc spans 4.84 milliarcseconds, which gives 37.61 solar radii and 4,755 K at its surface. It is also HD 129989, HR 5506, HIP 72105. The introduction is generated from Baines et al. (2021), AJ 162, 198's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1279798794197267072, distance 72 pc from Baines et al. (2021), AJ 162, 198, HD 129989: the Gaia EDR3 (Gaia Collaboration 2021) parallax the radius was computed with (Table 1), 13.83 +/- 0.49 mas, inverted; Gaia DR3's parallax, 13.827 ± 0.490 mas (28.2 standard errors), is not used. Radius 37.61 +/- 1.38 solar radii from Baines et al. (2021), AJ 162, 198, HD 129989: radius 37.61 +1.29/-1.38 solar radii (Table 5), from the limb-darkened angular diameter 4.84 +/- 0.01 mas (NPOI, Table 4) and the Gaia EDR3 (Gaia Collaboration 2021) parallax (https://doi.org/10.3847/1538-3881/ac2431). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,755 K from Baines et al. (2021), AJ 162, 198, HD 129989: effective temperature 4755 +/- 66 K (Table 5), from the angular diameter and the bolometric flux of the SED fit. log g 2.24 from Baines et al. (2021), AJ 162, 198, HD 129989: log g 2.24, from Soubiran et al. (2016), PASTEL, as the paper lists it beside the diameter (Table 4).

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Izar is HR 5506.. Of the companion a double-star catalogue lists: the spectrum includes Izar's companion, which is not drawn: Washington Double Star catalogue (Mason et al. 2001, AJ 122, 3466; VizieR B/wds/wds) lists WDS 14450+2704 STF1877 AB 2.9 arcsec apart at magnitudes 2.58 and 4.81, so it gives 11.4% of the light and can move a color channel by 29 levels of 255 at most; the measurement is kept, since a model color would replace all of it, through the CIE 1931 2° observer: #ffe3c1. Routes tried in order: stis-ngsl: HD 129989 is not in the library; kiehling: HR 5506 is not among its 60 stars; kharitonov: HR 5506 is not in the catalogue; burnashev: BS 5506 is not in part2; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,755 K and log g 2.24 (u1 0.694, u2 0.100): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
