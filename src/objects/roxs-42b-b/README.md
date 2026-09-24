# ROXs 42B b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

ROXs 42B b is a young giant planet of about 10 to 13 Jupiter masses, 1.2 arcseconds (about 140 au) from the close pair [ROXs 42B A and B](../roxs-42b/README.md) in Ophiuchus. Its carbon-to-oxygen ratio and metallicity match its stars' (Inglis et al. [2024](https://arxiv.org/abs/2402.09533)).

## Sources

**Orbit.** Inglis et al. (2026, AJ 171, 280; [doi:10.3847/1538-3881/ae4b34](https://doi.org/10.3847/1538-3881/ae4b34)), section 3.2, move their three positions of b measured from A (Table 1, 2001 to 2022) to the pair's centre of mass with the A–B orbit and a mass ratio of 0.40, fit them with orbitize!'s OFTI, and publish medians only (Table 3: a 223 au, e 0.4, i 58°). [`orbitize-fit.py`](../../../tools/objects/hosted-orbits/orbitize-fit.py) makes the same shift and reruns the fit with orbitize!'s MCMC on the same priors (total mass 1.35 ± 0.07 solar masses, parallax 6.83 ± 0.03 mas), keeping the maximum of the posterior, refined from many starts ([fit.json](source/orbits/fit.json)). The recorded orbit: a = 159 au at the Gaia DR3 distance, e = 0.38, i = 45.3°, period about 1,727 years. The path drawn is this one orbit. It is loosely pinned down: three positions leave more free parameters than measurements (Inglis et al. 2026, section 3.2; their a is 223 +150/-69 au), so the drawn path is one possibility, not a measured track. Every element and its derivation is in [`roxs-42b-b.json`](../../../packages/astronomy/data/bodies/roxs-42b-b.json).

**Radius, temperature and mass.** Radius 2.83 +/- 0.01 Jupiter radii and temperature 1935 +/- 12 K: the joint low- and high-resolution retrieval with grey clouds that Inglis et al. (2024, AJ; doi:10.3847/1538-3881/ad2771; arXiv:2402.09533, Table 3) prefer: 202,322.4 km at 71,492 km per Jupiter radius. A model radius: the planet is unresolved. Xuan et al. (2024) give 2.1 +/- 0.35 from evolutionary models. GM from the evolutionary-model mass 13 +/- 5 Jupiter masses of Xuan et al. (2024, arXiv:2405.13128, Table 1) times Jupiter's GM; Kraus et al. (2014) give 10 +/- 4. The orbit places the planet around A, while it was fitted about the pair's centre of mass, which lies at most about 5 au from A. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray. No paper gives its flux in three bands comparable with HR 8799's planets, whose false colour comes from JWST (the [ledger](investigations.json) says what would change that).

**Rotation.** No spin axis on the sky is measured; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Three positions over twenty years leave more free parameters than measurements, as Inglis et al. note: the recorded orbit is one of many that fit, not a measurement of the planet's path. The orbit is about the pair's centre of mass but is drawn around A, up to about 25 mas away on the sky.
- The radius and mass are model values; the planet is a point in every image.
- No colour is measured in bands comparable with HR 8799's, and no spin axis is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
