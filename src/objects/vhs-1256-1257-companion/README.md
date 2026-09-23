# VHS 1256-1257 B

VHS 1256-1257 B is the twin of [VHS 1256-1257 A](../vhs-1256-1257/README.md): two young dwarfs of about 74 Jupiter masses each, on the boundary between stars and brown dwarfs, 21 parsecs away. B circles A every 7.3 years on the most eccentric orbit yet measured for a very low-mass pair (Dupuy et al. 2023), and the two are circled in turn by the planet-mass companion [VHS 1256-1257 b](../vhs-1256-1257-b/README.md).

## Sources

**Orbit.** Dupuy et al. ([2023](https://arxiv.org/abs/2208.08448), MNRAS 519, 1688), Table 3: the orvara fit to Keck/NIRC2 and MagAO positions of B around A from 2015 to 2022, posterior medians (the table note says every posterior is nearly Gaussian): a = 1.96 au, P = 7.307 yr, e = 0.8826, i = 118.7°, Ω = 4.4°, ω = 44.9° (B's own, stored as A's, 224.9°), periastron 2021.537 on orvara's Julian-year scale. B is placed by that orbit around A; Gaia cannot resolve the pair.

**Radius, mass and temperature.** As for A: the Chabrier et al. (2000) model radius 0.12 solar radii that Climent et al. ([2022](https://arxiv.org/abs/2201.12606)) adopt for each component, half the pair's dynamical mass of 0.141 ± 0.008 solar masses, and the 2,700 K BT-Settl model of the pair's combined spectrum (Dupuy et al. 2023).

**Colour lens.** A Planck spectrum at 2,700 K through the CIE 1931 2° observer into sRGB with the D65 white. No limb darkening is drawn.

**Rotation.** None is measured. The display axis is the normal of its orbit around A, and nothing turns ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) puts B within 2.1 of its own error bars of all eight Keck/NIRC2 positions of Dupuy et al.'s Table 1, from 2016 to 2022, including the 2021 close pass at 35 mas.

## Known problems

- The orbit is the posterior medians, not a single fitted orbit; they reproduce every measured position.
- The radius is a model value, and the mass is half the pair's measured total.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
