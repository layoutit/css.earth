# Kepler-16 A

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

Kepler-16 A is an orange dwarf 65% as wide as the Sun. Every 41 days its small partner star B passes in front of it, and a Saturn-mass planet, [Kepler-16 (AB) b](../kepler-16ab-b/README.md), circles them both.

## Sources

Radius 0.6489 solar radii, mass 0.6897 solar masses and effective temperature 4450 ± 150 K: Doyle et al. (2011, Science 333, 1602; arXiv:1109.3432), Table 1, from the photometric-dynamical model of the Kepler light curve. Position, parallax (75.30 pc) and proper motion: Gaia EDR3 through SIMBAD. Radial velocity: the barycentre's −32.769 km/s from the same Table 1. The full record, with every source, is [packages/astronomy/data/bodies/kepler-16-a.json](../../../packages/astronomy/data/bodies/kepler-16-a.json).

Star B has no page of its own. It is drawn from its astronomy record, [kepler-16-b.json](../../../packages/astronomy/data/bodies/kepler-16-b.json), on its measured 41-day orbit around A: the mean orbit Triaud et al. (2022, MNRAS 511, 3561) fitted to radial velocities, with the size and tilt of Doyle et al.'s. No temperature of B is measured, so it is drawn in the shared neutral gray.

The shape lens is a gray sphere of the published radius. No image of the star exists: at 0.08 milliarcseconds it is far below what any interferometer resolves. The display axis is celestial north, a convention (see [rotation.json](source/preparation/rotation.json)).

## Evidence

`packages/astronomy/src/hostedOrbits.test.ts`, "Kepler-16: a circumbinary planet" (commit of this package): the orbit of B puts it in front of A at all 36 primary eclipses of the Kepler mission and behind A at every secondary, at the times of the Villanova Kepler Eclipsing Binary Catalogue, an ephemeris fitted to the eclipses themselves rather than to the papers these records use.

## Known problems

The masses of Doyle et al. are kept although Sebastian et al. (2025, arXiv:2505.19718) measure both stars 2 to 7% heavier: Doyle's orbits were fitted with Doyle's masses, and the two sets are not mixed. The binary is drawn as a fixed ellipse; its slow apsidal and nodal precession is not modelled. Star B's colour is unmeasured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
