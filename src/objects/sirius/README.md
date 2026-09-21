# Sirius

Sirius A is an A-type star 2.64 parsecs from the Sun and about 1.7 times its radius. The VLTI measured its disc at 6.04 milliarcseconds; here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 379.21 ± 1.58 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Sirius, not two.

Radius: Limb-darkened angular diameter 6.039 ± 0.019 mas measured on Sirius A with VLTI/VINCI by Kervella et al. (2003), A&A 408, 681; at 2.6371 pc this is the record's radius.

Rotation: no rotation axis or period is adopted for Sirius A in the sources used here: Kervella et al. 2003 and the SIMBAD record The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #cbdbff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 9845 ± 64 K from Davis et al. 2011 (PASA 28, 58; <https://doi.org/10.1071/AS10010>), abstract: the SUSI and VLTI limb-darkened diameter 6.041 ± 0.017 mas with the bolometric flux. The radius source, Kervella et al. 2003, adopts a temperature rather than measuring one. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #cbdbff is the star field's colour at the cited 9845 K.

## Known problems

Sirius is a binary. This package is Sirius A only; the white dwarf Sirius B is not represented. No mass or gravitational parameter is adopted. The surface is a neutral sphere: no spots, limb darkening map or resolved image is shown.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
