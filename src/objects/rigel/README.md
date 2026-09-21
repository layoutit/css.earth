# Rigel

Rigel is a blue supergiant about 265 parsecs away and roughly 79 times the Sun’s radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 3.78 ± 0.34 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Rigel, not two.

Radius: Radius 78.9 ± 7.4 solar radii from Moravveji et al. (2012), ApJ 747, 108, who combine the limb-darkened angular diameter 2.75 ± 0.01 mas of Aufdenberg et al. (2008) with the Hipparcos distance.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #bfd3ff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 12100 ± 150 K from Przybilla et al. 2010 (A&A 517, A38; <https://doi.org/10.1051/0004-6361/201014164>), Table 1, HD 34085: a non-LTE spectroscopic analysis. The radius source, Moravveji et al. 2012, adopts this value in its Table 1. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #bfd3ff is the star field's colour at the cited 12100 K.

## Known problems

The distance rests on a 9 percent parallax, so the radius carries a 7.4 solar radii uncertainty. Rigel is a multiple system; this package is Rigel A only. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
