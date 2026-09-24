# HD 206893 c

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HD 206893 c is a giant planet circling about 3.5 au from its star, inside the orbit of B. Models in which it still burns deuterium fit its brightness best. Its star is [HD 206893](../hd-206893/README.md).

## Sources

**Orbit.** Kral et al. ([2026](https://arxiv.org/abs/2511.20091), A&A 705, A217) fit B and c together with orbitize! on VLTI/GRAVITY astrometry, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood; c's orbit uses the star's mass plus c's, as orbitize! does ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes c's four GRAVITY positions within 0.01 to 0.52 mas. The recorded orbit: a = 3.75 au, e = 0.26, i = 142.9°, period about 6 years, nearly in the plane of B's. The path drawn is this orbit. Every element and its derivation is in [`hd-206893-c.json`](../../../packages/astronomy/data/bodies/hd-206893-c.json).

**Radius, temperature and mass.** Radius 1.46 Jupiter radii and 1,182 K from the atmosphere fit of Hinkley et al. ([2023](https://arxiv.org/abs/2208.04867)), Table 3, the discovery paper. A model radius: the planet is unresolved. Mass 11.1 Jupiter masses, measured dynamically (Kral et al. 2026, Table 2). A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of HD 206893 c on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The radius and temperature are model values; the planet is a point in every image.
- No colour is measured in bands comparable with HR 8799's, and no spin axis is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
