# AB Pic

AB Pic is a young K-type star in the Carina association. Its companion b, found in 2005, sits 5.4 arcseconds out on an orbit seen edge-on.

## Sources

**Placement.** Gaia DR3 source 5495052596695570816 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-ab-pic.json)).

**Radius, temperature and mass.** No paper used here tabulates this K1V star's size or temperature, so they are Gaia DR3's catalogue values: the FLAME radius 1.093 solar radii and mass 0.842 solar masses, and the GSP-Phot temperature 4,878 K. Model values from Gaia's photometry and parallax, not a measured disc.

**Radial velocity.** Gaia DR3's 22.02 ± 0.19 km/s.

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,878 K (the record) and log g 4.29 (from the record's mass and radius (packages/astronomy/data/bodies/ab-pic.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](../hip-65426/evidence/imaged-companions-2.png), headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's colour, with its planet's orbit crossing the view.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,878 K (the record) and log g 4.29 (from the record's mass and radius (packages/astronomy/data/bodies/ab-pic.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
