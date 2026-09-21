# Deneb

Deneb is a white supergiant roughly 130 times the Sun’s radius, at a poorly known distance of about 433 parsecs. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 2.31 ± 0.32 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Deneb, not two.

Radius: Limb-darkened angular diameter 2.76 ± 0.06 mas from Aufdenberg et al. (2002), ApJ 570, 344: the NPOI uniform-disc diameter 2.40 ± 0.06 mas times a model limb-darkening correction of 1.15 for a star with a wind. At the Hipparcos distance this is the record’s radius.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #d6e1ff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 8600 ± 500 K from Aufdenberg et al. 2002 (ApJ 570, 344; <https://doi.org/10.1086/339740>), abstract: the bolometric flux with the limb-darkening-corrected NPOI diameter, the radius source. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #d6e1ff is the star field's colour at the cited 8600 K.

## Known problems

The Hipparcos parallax is 2.31 ± 0.32 mas, a 14 percent uncertainty that carries straight into the radius. The limb-darkening correction is model dependent because Deneb has a wind. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
