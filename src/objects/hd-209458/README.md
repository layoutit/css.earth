# HD 209458

HD 209458 is a Sun-like star 48 parsecs away in Pegasus, 1.16 times the Sun’s radius. Its giant planet crosses its face every 3.5 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 20.7694 ± 0.0266 mas via SIMBAD. The shared star field (HYG) also has a row for this star, HIP 108859, but the astronomy record carries no Hipparcos number, so the two are not reconciled (see Known problems).

Radius: Stellar radius 1.155 +0.014 −0.016 solar radii from Torres et al. 2008, ApJ 677, 1324 (2008). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #fff7ef, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 6065 ± 50 K from Torres, Winn & Holman 2008 (ApJ 677, 1324; <https://arxiv.org/abs/0801.1841>), Table 1, the radius source: the weighted mean of ten independent determinations. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #fff7ef is the star field's colour at the cited 6065 K.

## Known problems

**The star field draws a second HD 209458.** Its HYG row, HIP 108859, is not bound to this package because the astronomy record has no Hipparcos number, so the field keeps its own point at the HYG position.

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
