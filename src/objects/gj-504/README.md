# GJ 504

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

GJ 504 is a Sun-like star whose measured size allows two ages, 21 million or 4 billion years. The answer decides whether its companion b is a planet or a brown dwarf.

## Sources

**Placement.** Gaia DR3 source 3732539683617410816 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-gj-504.json)).

**Radius, temperature and mass.** A measured radius: 1.35 ± 0.04 solar radii from the star's limb-darkened angular diameter, 0.71 ± 0.02 mas with VEGA on the CHARA array, at the Hipparcos parallax (Bonnefoy et al. [2018](https://arxiv.org/abs/1807.00657), A&A 618, A63, section 2.3). 6,200 K from their fit to its spectral energy distribution (Appendix A), close to the spectroscopic solution of D'Orazi et al. ([2017](https://arxiv.org/abs/1609.02530)). The 1.2 solar masses is the value they assume in their spot model.

**Two ages.** The radius fits isochrones at 21 ± 2 million or 4.0 ± 1.8 billion years (Bonnefoy et al. 2018). The companion's mass follows: about 1.3 Jupiter masses if young, about 23 if old. JWST's spectrum of the companion points to the old age (Baburaj et al. 2026; see [GJ 504 b](../gj-504-b/README.md)).

**Radial velocity.** Gaia DR3's -27.25 ± 0.13 km/s.

**Colour lens.** Gaia DR3 publishes no sampled spectrum of this bright star, so the colour is a Planck spectrum at its published temperature, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,200 K (the record) and log g 4.26 (from the record's mass and radius (packages/astronomy/data/bodies/gj-504.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](../hd-206893/evidence/imaged-companions-3.png), headless Chromium at 800 × 600 on this version: each is drawn in its measured colour.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,200 K (the record) and log g 4.26 (from the record's mass and radius (packages/astronomy/data/bodies/gj-504.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
