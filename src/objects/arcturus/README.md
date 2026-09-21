# Arcturus

Arcturus is a red giant 11.26 parsecs away, about 25 times the Sun’s radius. Interferometers have measured its disc; here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 88.83 ± 0.54 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Arcturus, not two.

Radius: Limb-darkened angular diameter 20.922 ± 0.036 mas (quadratic limb-darkening fit) measured with IOTA/IONIC by Lacour et al. (2008), A&A 485, 561; at the Hipparcos distance this is the record’s radius.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffd5b3, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 4295 ± 26 K from Lacour et al. 2008 (A&A 485, 561; <https://doi.org/10.1051/0004-6361:200809611>), abstract: the IOTA/IONIC Rosseland diameter 21.05 ± 0.21 mas with the bolometric flux. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffd5b3 is the star field's colour at the cited 4295 K.

## Known problems

The cited paper images Arcturus’s limb darkening; this package shows a neutral sphere and does not cast that image. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
