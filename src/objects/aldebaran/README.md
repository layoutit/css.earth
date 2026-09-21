# Aldebaran

Aldebaran is a red giant 20.43 parsecs away and 44 times the Sun’s radius, measured as the Moon passed in front of it. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 48.94 ± 0.77 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Aldebaran, not two.

Radius: Limb-darkened angular diameter 20.58 ± 0.03 mas, or 44.2 ± 0.9 solar radii, from lunar occultations and VLTI/VINCI by Richichi and Roccatagliata (2005), A&A 433, 305.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffcca3, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 3934 ± 41 K from Richichi & Roccatagliata 2005 (A&A 433, 305; <https://doi.org/10.1051/0004-6361:20041765>), Section 4: the lunar-occultation and VLTI/VINCI diameter with the bolometric flux. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffcca3 is the star field's colour at the cited 3934 K.

## Known problems

No mass is adopted. The surface is a neutral sphere: no spots or limb darkening are shown.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
