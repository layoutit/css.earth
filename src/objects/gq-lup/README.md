# GQ Lup

GQ Lup is a young T Tauri star, a few million years old, 154 parsecs away in Lupus. It still has a disc of its own and is still accreting. Its companion [GQ Lup b](../gq-lup-b/README.md), found in 2005, orbits about 100 au out; a third, much wider star, GQ Lup C, is 2,400 au away and not in the catalogue.

## Sources

**Placement.** Gaia DR3 source 6011522757643074304 (Gaia Collaboration 2023): position at J2016.0, proper motion, and parallax 6.4893 ± 0.0289 mas, inverted to 154.098 pc ([source record](../../sources/gaia-dr3-gq-lup.json)). Gaia gives no radial velocity; the record takes −3.6 ± 1.3 km/s from Frasca et al. (2017), the value SIMBAD lists.

**Radius, temperature and mass.** Donati et al. ([2012](https://arxiv.org/abs/1206.1770)) measure a photospheric temperature of 4,300 ± 50 K and a mass of 1.05 ± 0.07 solar masses from spectropolarimetry and evolutionary models; the ESO SupJup survey (González Picos et al. [2025](https://arxiv.org/abs/2501.01789), Table 1) tabulates these with the radius 1.7 ± 0.2 solar radii. A model radius: the disc is not measured.

**Colour lens.** A Planck spectrum at 4,300 K through the CIE 1931 2° observer into sRGB with the D65 white. Gaia published no BP/RP spectrum of this star. The colour is the star's own: the dust in front of it (0.4 magnitudes in V) is not applied. Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 4,300 K (the record) and log g 4.0 (from the record's mass and radius (packages/astronomy/data/bodies/gq-lup.json)): a model, since no fit of this star's limb exists.

**Rotation.** Donati et al. (2012) measure the rotation period, 8.4 ± 0.3 days, but not the axis direction on the sky, so the display axis is celestial north and nothing turns ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places GQ Lup b, at this star's Gaia distance, where GRAVITY measured it (see [GQ Lup b](../gq-lup-b/README.md)).

## Known problems

- The radius is a model value, and the star's own disc is not drawn.
- GQ Lup C, the wide third star, is not in the catalogue.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
