# AB Pic

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

AB Pic is a young K-type star in the Carina association. Its companion b, found in 2005, sits 5.4 arcseconds out on an orbit seen edge-on.

## Sources

**Placement.** Gaia DR3 source 5495052596695570816 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-ab-pic.json)).

**Radius, temperature and mass.** No paper used here tabulates this K1V star's size or temperature, so they are Gaia DR3's catalogue values: the FLAME radius 1.093 solar radii and mass 0.842 solar masses, and the GSP-Phot temperature 4,878 K. Model values from Gaia's photometry and parallax, not a measured disc.

**Radial velocity.** Gaia DR3's 22.02 ± 0.19 km/s.

**Color dataset.** The color of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,878 K (the record) and log g 4.29 (from the record's mass and radius (packages/astronomy/data/bodies/ab-pic.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the star's light in TESS's full-frame images of sector 39 (May and June 2021), cut at the star's place by MAST's [TESScut](https://mast.stsci.edu/tesscut/) ([source record](../../sources/mast-tess-full-frame-images.json)). lightkurve measures the light, astropy its period, and starry (Luger et al. 2019) the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. The four stars in the app, headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's color, with its planet's orbit crossing the view.

**Brightness from TESS.** In sector 39 the light swings by 1.6% with a period of 3.92 d, and each of the sector's two orbits alone shows the same period within 20%. The star's record holds 3.87 d from the catalogues. The map's light curve leaves a scatter of 0.26% about the light, whose own noise is 0.04%. Gaia DR3 lists 7 other stars within 63 arcseconds, giving under 0.1% of the light in the star's pixels.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,878 K (the record) and log g 4.29 (from the record's mass and radius (packages/astronomy/data/bodies/ab-pic.json)).

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 46.4°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of May and June 2021: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
