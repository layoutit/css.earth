# AB Pic b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

AB Pic b orbits about 190 au out, on an orbit seen edge-on. It spins in about two hours, with its axis tilted against that orbit. Its star is [AB Pic](../ab-pic/README.md).

## Sources

**Orbit.** Palma-Bifani et al. ([2023](https://arxiv.org/abs/2211.01474), A&A 670, A90) fit the NaCo 2003 and 2004 and SPHERE 2015 positions (their Table 1) with orbitize!'s OFTI at a fixed total mass of 1.3 solar masses, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), but every stored likelihood in that posterior is zero, so the sample kept is the one closest to the four positions, scored with their errors ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). Its χ² over eight numbers is 0.67: twelve years of motion on a 2,800-year orbit fit many orbits equally well, and this one is only the best of 1,000 samples. The recorded orbit: a = 217 au, e = 0.52, i = 91.9°. The path drawn is this orbit. Every element and its derivation is in [`ab-pic-b.json`](../../../packages/astronomy/data/bodies/ab-pic-b.json).

**Radius, temperature and mass.** Radius 1.8 ± 0.2 Jupiter radii and 1,800 K from the BT-SETTL13 fit of Palma-Bifani et al. ([2023](https://arxiv.org/abs/2211.01474)), Table 4, to the full spectral energy distribution. Their Exo-REM fit gives 1,700 K; evolutionary models give 1.50 to 1.57 Jupiter radii (Table 3). Mass 10 ± 1 Jupiter masses, a model value. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** AB Pic b spins in about 2.1 hours (Palma-Bifani et al. 2023, Abstract), and its true obliquity is about 45 or 135 degrees, but the direction of its axis on the sky is not measured; no spin is propagated. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Twelve years of positions on a 2,800-year orbit: the orbit drawn is one of many that fit equally well.
- The measured two-hour spin is not drawn, because its axis direction on the sky is unknown.
- The radius and mass are model values; no colour is measured in bands comparable with HR 8799's.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
