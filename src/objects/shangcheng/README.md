# Shangcheng

## Sources

Gaia's parallax, brightness and spectrum give it 2.2 solar radii and 2.13 solar masses (FLAME) and 8,935 K at its surface (GSP-Phot). It is also HD 19275, HR 932, HIP 14862. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 547825694242685184, parallax 19.641 ± 0.085 mas (50.91 pc). Radius 2.172 (2.127 to 2.216) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 2.132 (2.091 to 2.172) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 8,935 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 547825694242685184: teff_gspphot 8934.697 K (16th-84th percentiles 8931.177-8938.554), the temperature FLAME used. log g 4.09 from the mass and radius.

**Color.** A Planck spectrum at 8,935 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #d7e0ff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,935 K and log g 4.09 (u1 0.281, u2 0.316): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 25, 26, 52, 59 and 79 (the newest of May and June 2024; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 25 gives a period of 0.39 d from the autocorrelation, whose peaks have a height of 0.30, a width of 0.47 and a fit of 0.99; Sector 26 gives a period of 0.39 d from the autocorrelation, whose peaks have a height of 0.36, a width of 0.50 and a fit of 1.00; Sector 52 gives a period of 0.39 d from the autocorrelation, whose peaks have a height of 0.36, a width of 0.49 and a fit of 1.00; Sector 59 gives a period of 0.39 d from the autocorrelation, whose peaks have a height of 0.14, a width of 0.49 and a fit of 0.96; Sector 79 gives a period of 0.39 d from the autocorrelation, whose peaks have a height of 0.49, a width of 0.53 and a fit of 1.00; 3 more of the star's 8 sectors do not meet the criteria. All 8 together give a period of 0.38 d from the autocorrelation, whose peaks have a height of 0.21, a width of 0.53 and a fit of 1.00, which is the star's period: 0.38 d. The light varies by 0.02% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.01% about the light, whose own noise is 0.004%. Gaia DR3 lists 18 other stars within 63 arcseconds, with under 0.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 19275" (revision 1336845968) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of May and June 2024: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
