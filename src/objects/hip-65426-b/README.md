# HIP 65426 b

HIP 65426 b is a young giant planet about 90 au from its star. JWST imaged it from 2 to 16 microns, and VLTI/GRAVITY has tracked its orbit since 2021. Its star is [HIP 65426](../hip-65426/README.md).

## Sources

**Orbit.** Blunt et al. ([2023](https://arxiv.org/abs/2310.00148)) fit three VLTI/GRAVITY positions (their Table 3) and the literature astrometry (Table 4) with orbitize! and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes the three GRAVITY positions within 0.09, 0.02 and 0.09 mas. The recorded orbit: a = 87.6 au, e = 0.20, i = 103.6°, period about 586 years. The path drawn is this orbit. Every element and its derivation is in [`hip-65426-b.json`](../../../packages/astronomy/data/bodies/hip-65426-b.json).

**Radius, temperature and mass.** Radius 1.06 ± 0.05 Jupiter radii and 1,624 K from the BT-Settl fit of Carter et al. ([2023](https://arxiv.org/abs/2208.14990), ApJL) to the JWST NIRCam and MIRI photometry with the SPHERE and NaCo data (section 5.5). Their hot-start evolutionary estimate is 1.44 Jupiter radii and 1,283 K; the model atmosphere radius is used. Mass 7.1 ± 1.2 Jupiter masses from the luminosity. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of HIP 65426 b is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The radius and mass are model values; the planet is a point in every image.
- The posterior holds 1,000 samples, so the orbit kept is the best of those, not a refined maximum.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
