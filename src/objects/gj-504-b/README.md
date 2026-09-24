# GJ 504 b

GJ 504 b glows at about 560 K. JWST's spectrum points to about 25 Jupiter masses and an age of billions of years, which would make it a brown dwarf. Its star is [GJ 504](../gj-504/README.md).

## Sources

**Orbit.** Bowler et al. ([2020](https://arxiv.org/abs/1911.10569), AJ 159, 63) fit the literature astrometry with orbitize!, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes the fourteen positions of Bonnefoy et al. ([2018](https://arxiv.org/abs/1807.00657), Table 2, from 2011 to 2017) within 2.5 of their errors. The recorded orbit: a = 54.7 au, e = 0.21, i = 132.0°, period about 370 years. The path drawn is this orbit. Every element and its derivation is in [`gj-504-b.json`](../../../packages/astronomy/data/bodies/gj-504-b.json).

**Radius, temperature and mass.** Radius 0.92 Jupiter radii and 564 K from the retrieval on the JWST/NIRSpec spectrum by Baburaj et al. ([2026](https://arxiv.org/abs/2606.19228), AJ 172, 28), section 5.5, and a mass of 25.2 Jupiter masses. The mass depends on the system's age: Bonnefoy et al. (2018) found 1.3 Jupiter masses for the young age and 23 for the old; JWST's spectrum favours the old. Model values: the companion is unresolved. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of GJ 504 b on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Its mass, and so whether it is a planet or a brown dwarf, depends on the system's age, which is still debated.
- The radius is a model value; the companion is a point in every image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
