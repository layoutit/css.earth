# Fomalhaut

Fomalhaut is an A-type star 7.70 parsecs away and 1.84 times the Sun’s radius, known for its debris ring. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 129.81 ± 0.47 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Fomalhaut, not two.

Radius: Radius 1.842 ± 0.019 solar radii from Mamajek (2012), ApJ 754, L20, using the VLTI limb-darkened angular diameter 2.223 ± 0.022 mas.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #d6e1ff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 8590 ± 73 K from Mamajek 2012 (ApJL 754, L20; <https://doi.org/10.1088/2041-8205/754/2/L20>), Section 2 and Table 2: the Absil et al. 2009 VLTI diameter with the Davis et al. 2005 bolometric flux. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #d6e1ff is the star field's colour at the cited 8590 K.

## Known problems

Fomalhaut’s debris ring and companions are not drawn. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
