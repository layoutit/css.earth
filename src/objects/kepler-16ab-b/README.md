# Kepler-16 (AB) b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

Kepler-16 (AB) b circles two stars at once, a real Tatooine. It is three-quarters as wide as Jupiter and a third as heavy; here it is a plain gray sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json). The full record is [packages/astronomy/data/bodies/kepler-16ab-b.json](../../../packages/astronomy/data/bodies/kepler-16ab-b.json).

Measured, from Doyle et al. (2011, Science 333, 1602; arXiv:1109.3432), Table 1: radius 0.7538 Jupiter radii (8.45 Earth radii), mass 0.333 Jupiter masses, orbit 0.7048 au in semi-major axis, inclination 90.0322 degrees, eccentricity 0.0069, and the planet's place on its orbit on 2010-01-15.

The orbit goes around the centre of mass of [star A](../kepler-16-a/README.md) and star B, not around either star. That centre sits 0.227 of the way from A to B, weighted by Doyle et al.'s masses; `barycentreCompanion` in the astronomy record carries it, as the field of the same name lets Pluto's small moons circle Pluto and Charon.

The year is 225.885 days, the mean period of the planet's transits in the Villanova Kepler Eclipsing Binary Catalogue. Doyle et al.'s 228.776 days is an instantaneous (osculating) period: the stars' pull changes it by about ±5 days within years (Triaud et al. 2022, Sect. 3.5), and a fixed ellipse at that period would place the planet about 80 days off by 2026.

Not measured and not shown: colour, albedo, surface, atmosphere, rotation. The display axis is the orbit normal, a convention.

## Evidence

`packages/astronomy/src/hostedOrbits.test.ts`, "Kepler-16: a circumbinary planet" (commit of this package):

- The seven transits across star A in the Kepler long-cadence light curves (BJD 2454973.43 to 2456328.74) are reproduced within 0.13 days. Single transits alternate about 2.3 days early and late as A swings around the centre of mass; without the centre of mass the model misses them by that much.
- The orbit of star B puts it in front of A at all 36 primary eclipses of the Kepler mission and behind it at every secondary, at the catalogue's eclipse times.
- [System view](evidence/system-view.png) at the scene epoch, 2026-09-03, rendered headless in Chrome with GPU compositing from this package: the planet's orbit drawn around the centre of mass of A and B, and B's 41-day orbit around A.

## Known problems

The orbit is drawn as a fixed ellipse. The real orbit precesses: Doyle et al. predicted that transits across A would "cease in early 2018", returning around 2042, which a fixed tilt cannot show. The planet's place in 2026 carries the period's uncertainty over 28 orbits. Star B's light is not added to the planet's lighting.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
