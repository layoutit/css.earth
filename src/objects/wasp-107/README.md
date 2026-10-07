# WASP-107

## Sources

Its radius and temperature follow Howard et al. 2025. The introduction is generated from Yee & Vissapragada 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3578638842054261248, parallax 15.528 ± 0.026 mas (64.40 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.67 +/- 0.02 solar radii from Howard et al. 2025, the stellar radius of WASP-107 b's parameter set from Howard et al. 2025 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Mass 0.683 +/- 0.017 solar masses from Piaulet et al. 2021, the stellar mass of WASP-107 b's parameter set from Piaulet et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161...70P/abstract). Temperature 4,425 K from Howard et al. 2025, the stellar temperature of WASP-107 b's parameter set from Howard et al. 2025 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3578638842054261248, through the CIE 1931 2° observer: #ffc49e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,425 K and log g 4.62 (u1 0.765, u2 0.028): a model, because no fit of this star's limb is used.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 102 (July to September 2016; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is the light curve [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) use, and their criteria decide whether it shows the star turning: astropy and star-privateer compute their three periods, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from K2.** In K2 campaign 102 the light varies by 0.30% (the range between its 5th and 95th percentiles). The periodogram, the wavelet and the autocorrelation give 17.08, 16.18 and 16.38 d, and the periodogram's peak has a height of 0.54: within what Reinhold & Hekker (2020, A&A 635, A43) ask of a rotation (the three within two days of each other, a peak over 0.3). The period is their mean, 16.55 d. Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The star's record holds 17.1 d from the catalogues. The map's light curve leaves a scatter of 0.06% about the light, whose own noise is 0.03%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** WASP-107 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-107" (revision 1374438770) verbatim, CC BY-SA 4.0.

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 14.9°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of July to September 2016: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
