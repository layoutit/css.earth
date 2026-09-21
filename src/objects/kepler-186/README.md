# Kepler-186

Kepler-186 is a red dwarf 178 parsecs away, about half the Sun’s radius. Its outermost known planet, Kepler-186 f, circles it every 130 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 5.6336 ± 0.0169 mas via SIMBAD. The star is too faint for the Hipparcos catalogue, so the shared star field (HYG) has no row for it and this package is its only point.

Radius: Stellar radius 0.523 (+0.023) solar radii from Torres et al. 2015, ApJ 800, 99 (2015). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffc89a, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 3755 ± 90 K from Torres et al. 2015 (ApJ 800, 99; <https://arxiv.org/abs/1501.01101>), Table 5, KOI-0571, the radius source: a spectroscopic value it adopts from Mann et al. 2013 and Muirhead et al. 2014. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffc89a is the star field's colour at the cited 3755 K.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
