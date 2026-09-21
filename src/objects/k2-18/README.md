# K2-18

K2-18 is a red dwarf 38 parsecs away, about four tenths of the Sun’s radius. Its planet K2-18 b circles it every 33 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 26.2469 ± 0.0266 mas via SIMBAD. The star is too faint for the Hipparcos catalogue, so the shared star field (HYG) has no row for it and this package is its only point.

Radius: Stellar radius 0.411 ± 0.038 solar radii from Sarkis et al. (2018), AJ 155, 257, Table 2. It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: Sarkis et al. 2018 measure a 39.63 ± 0.50 day rotation period from photometry; no spin axis is measured, so none is adopted The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffbf8a, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 3457 ± 39 K from Sarkis et al. 2018 (AJ 155, 257; <https://arxiv.org/abs/1805.00830>), Table 2, the radius source, which adopts it from Benneke et al. 2017. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffbf8a is the star field's colour at the cited 3457 K.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
