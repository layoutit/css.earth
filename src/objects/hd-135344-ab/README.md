# HD 135344 Ab

HD 135344 Ab orbits 15 to 20 au from its star, found by SPHERE and confirmed by GRAVITY. Its colours match those of a mid-L type object. Its star is [HD 135344 A](../hd-135344-a/README.md).

## Sources

**Orbit.** Stolker et al. ([2025](https://arxiv.org/abs/2507.06206)) fit four SPHERE and four VLTI/GRAVITY positions with orbitize!'s MultiNest at a total mass of 2.2 solar masses, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes the four GRAVITY positions within 0.07 to 0.30 mas and the SPHERE positions within 2 to 4 mas, about their errors. Its semi-major axis, 23 au, is above the paper's median of 16.5 +2.8/-2.0: three years of positions allow a range of orbits. The recorded orbit: a = 23.0 au, e = 0.20, i = 78.3°, period about 74 years. The path drawn is this orbit. Every element and its derivation is in [`hd-135344-ab.json`](../../../packages/astronomy/data/bodies/hd-135344-ab.json).

**Radius, temperature and mass.** Radius 1.60 Jupiter radii and 1,510 K from the Sonora Diamondback fit to the SPHERE and GRAVITY spectra of Stolker et al. ([2025](https://arxiv.org/abs/2507.06206)), Table 5; their evolutionary fit gives 1.45 Jupiter radii and 1,585 K, and a mass of 10.0 Jupiter masses. Model values: the planet is unresolved. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of HD 135344 Ab on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Three years of positions allow a range of orbits; the one drawn is wider than the paper's median.
- The radius and mass are model values; the planet is a point in every image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
