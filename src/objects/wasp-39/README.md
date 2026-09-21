# WASP-39

WASP-39 is a Sun-like star about 215 parsecs away, 0.94 times the Sun’s radius. Its giant planet WASP-39 b circles it every four days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 4.6435 ± 0.0144 mas via SIMBAD. The star is too faint for the Hipparcos catalogue, so the shared star field (HYG) has no row for it and this package is its only point.

Radius: Stellar radius 0.939 ± 0.019 ± 0.011 solar radii from Mancini et al. 2018, A&A 613, A41 (2018). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted The display axis is celestial north at the star, a convention.

Shape lens: a sphere of the measured radius in neutral gray. No image of the surface is shown.

Catalogue colour: #ffedde, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 5485 ± 50 K from Mancini et al. 2018 (A&A 613, A41; <https://arxiv.org/abs/1802.03859>), Table 2, the radius source: iron-line equivalent widths in co-added HARPS-N spectra. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffedde is the star field's colour at the cited 5485 K.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
