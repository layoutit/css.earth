# HD 135344 A

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HD 135344 A is a young A0 star whose companion star B hosts a well-known spiral disc. Its own dust is gone, which let SPHERE and GRAVITY find its planet Ab.

## Sources

**Placement.** Gaia DR3 source 6199395656645840384 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-hd-135344-a.json)).

**Radius, temperature and mass.** 9,540 ± 100 K and 1.50 ± 0.01 solar radii from the fit to the star's spectral energy distribution by Stolker et al. ([2025](https://arxiv.org/abs/2507.06206)), Appendix A: the radius scales the model flux at the Gaia parallax and is smaller than the 1.8 solar radii evolutionary tracks predict. 2.2 solar masses from those tracks, the mass their orbit fit adopts.

**Its companion star.** HD 135344 B, 21 arcseconds away, is the star with the spiral protoplanetary disc; it is not built here.

**Radial velocity.** Gaia DR3's 29.3 ± 3.3 km/s.

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 9,540 K (the record) and log g 4.43 (from the record's mass and radius (packages/astronomy/data/bodies/hd-135344-a.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](../hd-206893/evidence/imaged-companions-3.png), headless Chromium at 800 × 600 on this version: each is drawn in its measured colour.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 9,540 K (the record) and log g 4.43 (from the record's mass and radius (packages/astronomy/data/bodies/hd-135344-a.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
