# HD 95086 b

HD 95086 b is a young giant planet with a very red colour. JWST's mid-infrared images rule out a warm disc around the planet as the cause. Its star is [HD 95086](../hd-95086/README.md).

## Sources

**Orbit.** Bowler et al. ([2020](https://arxiv.org/abs/1911.10569), AJ 159, 63) fit the literature astrometry with orbitize!'s OFTI, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). Desgrange et al. ([2022](https://arxiv.org/abs/2206.00425), A&A 664, A139) refit the orbit with two newer SPHERE positions using their own code, publishing no posterior; those two positions, from 2018 January and 2019 April, were not in the Bowler fit, and this orbit passes them within 3.4 and 5.1 mas, under two of their 2 to 3 mas errors. The recorded orbit: a = 60.6 au, e = 0.00, i = 149.1°, period about 367 years. The path drawn is this orbit. Every element and its derivation is in [`hd-95086-b.json`](../../../packages/astronomy/data/bodies/hd-95086-b.json).

**Radius, temperature and mass.** Radius 1.14 Jupiter radii, 936 K and 4.1 Jupiter masses from the Exo-REM fit with a surface-gravity prior to JWST/MIRI and near-infrared photometry by Malin et al. ([2024](https://arxiv.org/abs/2408.16843)), Table 8. Their fits span 1.0 to 1.14 Jupiter radii and 800 to 1,050 K. Model values: the planet is unresolved. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of HD 95086 b on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The orbit comes from a 2019 fit; it passes the two newer positions within two of their errors.
- The radius and mass are model values; the planet is a point in every image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
