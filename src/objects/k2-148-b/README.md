# K2-148B

## Sources

K2-148B shares its motion through space with K2-148, 1,163 AU away, so the two are a bound pair. Both are placed where Gaia measures them. The introduction is generated from El-Badry, Rix & Heintz (2021), MNRAS 506, 2269's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2536443724641751680, parallax 8.065 ± 0.019 mas (123.99 pc). Radius 0.585 +/- 0.017 solar radii from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the radius of TIC 423358486 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Mass 0.576 +/- 0.02 solar masses from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the mass of TIC 423358486 (VizieR IV/39/tic82) (https://doi.org/10.3847/1538-3881/ab3467). Temperature 3,854 K from Stassun et al. (2019), AJ 158, 138 (TIC v8.2), the effective temperature of TIC 423358486 (VizieR IV/39/tic82). log g 4.66 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2536443724641751680, through the CIE 1931 2° observer: #ffbd8a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,854 K and log g 4.66 (u1 0.468, u2 0.289): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 8 (January to March 2016; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 8 the light varies by 1.2% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 16.30, 15.74 and 16.38 d, and the periodogram's peak has a height of 0.49: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within two days of each other, a peak over 0.3). The period is their mean, 16.14 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 16.28 d from the catalogues. The map's light curve leaves a scatter of 0.23% about the light, whose own noise is 0.14%. Gaia DR3 lists 1 other star within 16 arcseconds, with 62% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** K2-148B's orbit around K2-148 is not measured; both stars are placed at their Gaia DR3 positions, which is where they are.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January to March 2016: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
