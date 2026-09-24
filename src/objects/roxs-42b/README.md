# ROXs 42B A

ROXs 42B A is the brighter of two young stars 146 parsecs away in Ophiuchus. They are 11 au apart and circle each other every 31 years on an orbit seen almost exactly edge-on (Inglis et al. 2026). The pair is orbited about 150 au out by the giant planet [ROXs 42B b](../roxs-42b-b/README.md). Its partner is [ROXs 42B B](../roxs-42b-companion/README.md). The "B" in the name is historical: ROXs 42B was the second optical counterpart of the X-ray source ROXs 42, and is not related to ROXs 42A.

## Sources

**Placement.** Gaia DR3 source 6047587937321868288 (Gaia Collaboration 2023): position at J2016.0, proper motion, and parallax 6.8284 ± 0.0309 mas, inverted to 146.447 pc ([source record](../../sources/gaia-dr3-roxs-42b.json)). Gaia does not resolve the pair, 83 mas apart: these are the photocentre's values (RUWE 2.1). This package places A there and B on its measured orbit around A. The radial velocity is Gaia DR3's, −0.68 ± 13.37 km/s, poorly measured.

**Radius and temperature.** 1.51 ± 0.02 solar radii and 3,650 ± 20 K, the SPHINX model-atmosphere fit to the pair's blended optical spectrum, modelled as the sum of the two stars by Inglis et al. ([2024](https://arxiv.org/abs/2402.09533), Table 1). Their text gives 1.42 and 1.59 solar radii for the two stars instead of the table's 1.51 and 1.39; the table is used.

**Mass.** 0.89 ± 0.08 solar masses, the photometric mass of Kraus et al. ([2014](https://arxiv.org/abs/1311.7664)). Inglis et al. (2026) measure the pair's dynamical total, 1.35 ± 0.07, which the two photometric masses match.

**Colour lens.** A Planck spectrum at 3,650 K through the CIE 1931 2° observer into sRGB with the D65 white. Gaia published no BP/RP spectrum of the pair. Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 3,650 K (the record) and log g 4.03 (from the record's mass and radius (packages/astronomy/data/bodies/roxs-42b.json)): a model, since no fit of this star's limb exists.

**Rotation.** None is measured on the sky; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) puts B, on Inglis et al.'s (2026) orbit around this star, within 2.1 of its own error bars of all seven positions in their Table 1.

## Known problems

- The radius is a model value, and the paper's text and table disagree on the two stars' radii (above).
- The pair's placement is Gaia's photocentre, not the centre of mass.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
