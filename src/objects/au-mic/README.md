# AU Mic

## Sources

Its radius and temperature follow Mallorquín et al. 2024. It is also HD 197481, HIP 102409. The introduction is generated from Mallorquín et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6794047652729201024, parallax 102.943 ± 0.023 mas (9.71 pc). Radius 0.862 +/- 0.052 solar radii from Mallorquín et al. 2024, the stellar radius of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Mass 0.635 +/- 0.04 solar masses from Mallorquín et al. 2024, the stellar mass of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Temperature 3,540 K from Mallorquín et al. 2024, the stellar temperature of the default parameter set of AU Mic b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6794047652729201024, through the CIE 1931 2° observer: #ffc08b. Routes tried in order: stis-ngsl: HD 197481 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,540 K and log g 4.37 (u1 0.476, u2 0.311): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the star's light in the TESS full-frame images of sector 95 (July and August 2025), cut at the star's place by MAST's [TESScut](https://mast.stsci.edu/tesscut/) ([source record](../../sources/mast-tess-full-frame-images.json)). lightkurve measures the light, astropy its period, and starry (Luger et al. 2019) the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from TESS.** In TESS sector 95 the light swings by 8.5% with a period of 4.85 d, and each of the sector's two orbits alone shows the same period within 20%. The star's record holds 4.856 d from the catalogues. The map's light curve leaves a scatter of 0.53% about the light, whose own noise is 0.17%. Gaia DR3 lists 16 other stars within 63 arcseconds, giving 0.29% of the light in the star's pixels.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** AU Mic d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Not shown.** AU Mic e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "AU Microscopii" (revision 1376711247) verbatim, CC BY-SA 4.0.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 71.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of July and August 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
