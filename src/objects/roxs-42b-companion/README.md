# ROXs 42B B

ROXs 42B B is the smaller star of the ROXs 42B pair, 146 parsecs away in Ophiuchus. It circles [ROXs 42B A](../roxs-42b/README.md) every 31 years at 11 au, on an orbit seen almost exactly edge-on (Inglis et al. 2026), and the pair is circled in turn by the giant planet [ROXs 42B b](../roxs-42b-b/README.md).

## Sources

**Orbit.** Inglis et al. (2026, AJ 171, 280; [doi:10.3847/1538-3881/ae4b34](https://doi.org/10.3847/1538-3881/ae4b34)), Table 2: the orbitize! fit to Keck NIRC speckle, NIRC2 and SPHERE positions of B around A from 2001 to 2022, posterior medians: a = 10.9 au, P = 31 yr, e = 0.61, i = 91.0°, Ω = 150.0°, τ = 0.32 from MJD 55197. Astrometry alone cannot tell (ω, Ω) from (ω + 180°, Ω + 180°), and the paper reports both node solutions; its medians take ω = 58° from one and Ω = 150° from the other, which put B 180° from every measured position. The solution with the printed node has B's ω = 238°, stored as A's, 58°; with it the orbit reproduces all seven positions (below). The table's derived periastron time, "MJD 55207 ± 0.08", does not follow from its own τ and period and is not used.

**Radius, temperature and mass.** 1.39 ± 0.02 solar radii and 2,600 ± 20 K from the SPHINX fit to the pair's blended optical spectrum, modelled as the sum of the two stars (Inglis et al. [2024](https://arxiv.org/abs/2402.09533), Table 1; their text gives 1.59 solar radii for this star instead). Mass 0.36 ± 0.04 solar masses, the photometric mass of Kraus et al. ([2014](https://arxiv.org/abs/1311.7664)).

**Colour lens.** A Planck spectrum at 2,600 K through the CIE 1931 2° observer into sRGB with the D65 white. Its limb is darkened by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 2,600 K (the record) and log g 3.71 (from the record's mass and radius (packages/astronomy/data/bodies/roxs-42b-companion.json)): a model, since no fit of this star's limb exists.

**Rotation.** None is measured. The display axis is the normal of its orbit around A, and nothing turns ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) puts B within 2.1 of its own error bars of all seven positions in Inglis et al.'s (2026) Table 1, 2001 to 2022.

## Known problems

- The orbit is posterior medians with the node solution chosen by the measured positions, not a single fitted orbit.
- The paper's text and table disagree on this star's radius (above).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
