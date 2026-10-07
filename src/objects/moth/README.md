# Moth

## Sources

Gaia's parallax, brightness and spectrum give it 0.9 solar radii and 0.85 solar masses (FLAME) and 5,366 K at its surface (GSP-Phot). It is also HD 61005, HIP 36948. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5592237639209047424, parallax 27.434 ± 0.016 mas (36.45 pc). Radius 0.918 (0.899 to 0.936) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 0.854 (0.814 to 0.894) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,366 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 5592237639209047424: teff_gspphot 5366.4253 K (16th-84th percentiles 5365.3677-5367.412), the temperature FLAME used. log g 4.44 from the mass and radius.

**Color.** A Planck spectrum at 5,366 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffebdd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,366 K and log g 4.44 (u1 0.555, u2 0.196): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 34, 61 and 88 (the newest of January and February 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 34 gives a period of 5.29 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.47 and a fit of 0.99; Sector 61 gives a period of 5.19 d from the autocorrelation, whose peaks have a height of 0.42, a width of 0.46 and a fit of 1.00; Sector 88 gives a period of 5.10 d from the autocorrelation, whose peaks have a height of 0.41, a width of 0.46 and a fit of 1.00; 1 more of the star's 4 sectors does not meet the criteria. All 4 together give a period of 5.08 d from the autocorrelation, whose peaks have a height of 0.34, a width of 0.45 and a fit of 0.99, which is the star's period: 5.08 d. The light varies by 2.8% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 5.06 d from the catalogues. The map's light curve leaves a scatter of 0.28% about the light, whose own noise is 0.02%. Gaia DR3 lists 95 other stars within 63 arcseconds, with 2.1% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 61005" (revision 1374408960) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 27.4°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of January and February 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
