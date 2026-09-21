# Proxima Centauri

Proxima Centauri is a red dwarf 1.30 parsecs away, the closest known star to the Sun, about one seventh of its radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 768.0665 ± 0.0499 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Proxima Centauri, not two.

Radius: Radius 0.141 ± 0.007 solar radii measured with VLTI/AMBER by Demory et al. (2009), A&A 505, 205. Kervella, Thévenin and Lovis (2017) give 0.1542 ± 0.0045 from a radius to magnitude relation; the interferometric value is adopted.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffb475, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 3098 ± 56 K from Demory et al. 2009 (A&A 505, 205; <https://doi.org/10.1051/0004-6361/200911976>), Table 4, GJ 551, derived Teff: the VLTI/AMBER diameter with surface-brightness relations. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffb475 is the star field's colour at the cited 3098 K.

## Known problems

Proxima is a flare star with a planet, Proxima b; neither flares nor the planet are drawn. No mass is adopted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
