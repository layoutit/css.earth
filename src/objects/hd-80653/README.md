# HD 80653

## Sources

Its radius and temperature follow Naponiello et al. 2026. The introduction is generated from Naponiello et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 606477252238780160, parallax 9.260 ± 0.022 mas (107.99 pc). Radius 1.199 +/- 0.033 solar radii from Naponiello et al. 2026, the stellar radius of the default parameter set of HD 80653 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260719325N/abstract). Mass 1.15 +/- 0.063 solar masses from Naponiello et al. 2026, the stellar mass of the default parameter set of HD 80653 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260719325N/abstract). Temperature 5,959 K from Naponiello et al. 2026, the stellar temperature of the default parameter set of HD 80653 b in the NASA Exoplanet Archive. log g 4.34 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 606477252238780160, through the CIE 1931 2° observer: #fff4f5. Routes tried in order: stis-ngsl: HD 80653 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,959 K and log g 4.34 (u1 0.422, u2 0.282): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 16 (December 2017 to February 2018; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 16 the light varies by 0.09% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 21.43, 20.80 and 19.50 d, and the periodogram's peak has a height of 0.30: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within five days of each other, a peak over 0.3). The period is their mean, 20.58 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 19.8 d from the catalogues. The map's light curve leaves a scatter of 0.02% about the light, whose own noise is 0.02%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** K2-312 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of December 2017 to February 2018: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
