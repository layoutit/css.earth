# Altair

Altair spins so fast that its equator bulges to 2.03 solar radii while its poles sit at 1.63. Here it is a plain sphere of the same volume, 5.13 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 194.95 ± 0.57 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Altair, not two.

Radius: Altair is a rapid rotator: Monnier et al. (2007), Science 317, 342, measure an equatorial radius of 2.029 ± 0.007 and a polar radius of 1.634 ± 0.011 solar radii with CHARA/MIRC. The record's radius is the volume-equivalent sphere of those two, 1.89 solar radii; the flattening is not drawn.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #e2e9ff, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 7680 ± 90 K from van Belle et al. 2001 (ApJ 559, 1155; <https://doi.org/10.1086/322340>), Section 3.3: the PTI mean Rosseland diameter with the Alonso et al. 1994 bolometric flux. The authors call this single value a geometric construct: the rapidly rotating surface ranges from about 7100 to 9300 K. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #e2e9ff is the star field's colour at the cited 7680 K.

## Known problems

Altair is strongly oblate and gravity darkened, and CHARA has imaged its surface; this package draws an equal-volume neutral sphere and does not cast that image. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
