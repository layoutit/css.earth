# Vega

Vega is a rapidly rotating A-type star 7.68 parsecs away, wider at its equator than at its poles. Here it is a plain sphere of the same volume.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 130.23 ± 0.36 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Vega, not two.

Radius: Vega is a rapid rotator seen nearly pole-on: Monnier et al. (2012), ApJ 761, L3, measure an equatorial radius of 2.726 ± 0.006 and a polar radius of 2.418 ± 0.012 solar radii with CHARA/MIRC. The record's radius is the volume-equivalent sphere of those two, 2.62 solar radii; the flattening is not drawn.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ceddff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 9360 ± 90 K, the surface-averaged value of the concordance model in Monnier et al. 2012 (ApJL 761, L3; <https://doi.org/10.1088/2041-8205/761/1/L3>), Table 2, the same model as the radius. The star is gravity-darkened: the same table gives 10070 K at the pole and 8910 K at the equator. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ceddff is the star field's colour at the cited 9360 K.

## Known problems

Vega is oblate (equatorial 2.726, polar 2.418 solar radii) and gravity darkened; this package draws an equal-volume sphere with no darkening. Its measured spin axis points nearly at Earth and is not adopted. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
