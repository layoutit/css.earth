# Epsilon Indi Bb

Epsilon Indi Bb is the cooler of the two brown dwarfs far out from Epsilon Indi A. Ten years of VLT images traced its whole orbit around Ba. It circles [Epsilon Indi Ba](../eps-indi-ba/README.md).

## Sources

**Orbit.** Chen et al. ([2022](https://arxiv.org/abs/2205.08077), AJ) measured 32 positions of Bb relative to Ba with VLT/NACO from 2004 to 2013 (their Table 3), covering nearly a whole orbit, and publish the orbit's elements (Table 4) but not its time of periastron, without which it cannot be placed in time. [`orbitize-fit.py`](../../../tools/objects/hosted-orbits/orbitize-fit.py) refits those 32 positions with orbitize! ([fit.json](source/orbits/fit.json), [measurements](source/orbits/chen-2022-astrometry.csv)), with their system mass 120.17 ± 0.62 Jupiter masses and parallax 274.99 ± 0.43 mas as priors, and keeps the maximum of the posterior. It reproduces every published element: a = 2.4060 au (theirs 2.4058 ± 0.0040), e = 0.54043 (0.54042 ± 0.00063), i = 77.083° (77.082 ± 0.032), Ω = 147.960° (147.959 ± 0.023), and ω = 328.26° for Ba's orbit (328.27 ± 0.12); the period is 11.02 years. The path drawn is this orbit. Every element and its derivation is in [`eps-indi-bb.json`](../../../packages/astronomy/data/bodies/eps-indi-bb.json).

**Mass, temperature and radius.** Mass 53.25 ± 0.29 Jupiter masses, measured dynamically (Chen et al. [2022](https://arxiv.org/abs/2205.08077), Table 4). Temperature 972 ± 13 K from the SM08 hybrid evolutionary models at that mass and its luminosity (Chen et al. 2022). Radius 0.082 to 0.083 solar radii from COND03 models constrained by the dynamical system mass (King et al. [2010](https://arxiv.org/abs/0911.3143), A&A 510, A99); the lower bound is drawn. Model values: the pair is resolved but no disc is. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of Epsilon Indi Bb on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Ba is drawn at the pair's light centre, so Bb's orbit is drawn about Ba rather than about their centre of mass; the difference is up to 1.1 au.
- The radius and temperature are model values.
- No colour is drawn, and no spin axis is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
