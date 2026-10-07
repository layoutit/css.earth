# HIP 67522

## Sources

Its radius and temperature follow Barber et al. 2024. It is also HD 120411. The introduction is generated from Barber et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6113920619134019456, parallax 8.017 ± 0.018 mas (124.73 pc). Radius 1.38 +/- 0.06 solar radii from Barber et al. 2024, the stellar radius of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L..30B/abstract). Mass 1.22 +/- 0.05 solar masses from Barber et al. 2024, the stellar mass of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L..30B/abstract). Temperature 5,675 K from Barber et al. 2024, the stellar temperature of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive. log g 4.24 from the mass and radius.

**Color.** A Planck spectrum at 5,675 K, because no archive holds a spectrum of this star (stis-ngsl: HD 120411 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffefe7. Routes tried in order: stis-ngsl: HD 120411 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,675 K and log g 4.24 (u1 0.478, u2 0.248): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 38, 64, 101 and 102 (the newest of March and April 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 38 gives a period of 1.42 d from the autocorrelation, whose peaks have a height of 0.76, a width of 0.48 and a fit of 1.00; Sector 64 gives a period of 1.42 d from the autocorrelation, whose peaks have a height of 0.72, a width of 0.46 and a fit of 1.00; Sector 101 gives a period of 1.45 d from the autocorrelation, whose peaks have a height of 0.64, a width of 0.47 and a fit of 1.00; Sector 102 gives a period of 1.43 d from the autocorrelation, whose peaks have a height of 0.68, a width of 0.47 and a fit of 1.00; 1 more of the star's 5 sectors does not meet the criteria. All 5 together give a period of 1.43 d from the autocorrelation, whose peaks have a height of 0.72, a width of 0.48 and a fit of 1.00, which is the star's period: 1.43 d. The light varies by 5.7% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 1.418 d from the catalogues. The map's light curve leaves a scatter of 0.58% about the light, whose own noise is 0.21%. Gaia DR3 lists 31 other stars within 63 arcseconds, with 2.3% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HIP 67522" (revision 1374404438) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of March and April 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
