# DH Tau b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

DH Tau b is a companion of about 12 Jupiter masses, less than a million years old, 2.3 arcseconds (about 310 au) from [DH Tau](../dh-tau/README.md) in Taurus. It is still accreting from a disc of its own (Xuan et al. [2024](https://arxiv.org/abs/2405.13128)).

## Sources

**Orbit.** Bowler et al. ([2020](https://arxiv.org/abs/1911.10569), AJ) fit their 2018 Keck/NIRC2 position and eight literature positions from 1999 to 2015 with orbitize!, adding a jitter of 4.9 mas and 0.74° to every error because the instruments disagree, and publish medians only (a 330 +89/−160 au; the eccentricity is unconstrained). [`orbitize-fit.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/orbitize-fit.py) reruns that fit with orbitize!'s MCMC on the same inputs, jitter and priors (host 0.64 and total 0.65 ± 0.04 solar masses, Gaia DR2 parallax 7.388 ± 0.069 mas) and keeps its highest-likelihood sample ([fit.json](source/orbits/fit.json)); a refinement ran the eccentricity to its limit of 1, so it is not used. The recorded orbit: a = 182 au at the Gaia DR3 distance, e = 0.80, i = 92.8°, period about 3,284 years. The path drawn is this one orbit. It is loosely pinned down: the positions barely move in twenty years, Bowler et al. (2020) find the eccentricity unconstrained and a 330 +89/-160 au, so the drawn path is one possibility, not a measured track. Every element and its derivation is in [`dh-tau-b.json`](../../../packages/astronomy/data/bodies/dh-tau-b.json).

**Radius, temperature and mass.** Radius 2.6 +/- 0.6 Jupiter radii, mass 12 +/- 4 Jupiter masses and temperature 2350 +/- 200 K from the evolutionary models Xuan et al. (2024, arXiv:2405.13128) fit to the companion's luminosity and the star's age (Tables 1 and 4): 185,879.2 km at 71,492 km per Jupiter radius. Model values: the planet is unresolved. Their KPIC retrieval gives 2050 +120/-100 K with this radius as a prior. GM from 12 Jupiter masses times Jupiter's GM. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red MKO K 2.184 µm (1346 ± 25 µJy), green MKO H 1.614 µm (1074 ± 40 µJy), blue MKO J 1.2417 µm (802.9 ± 37 µJy) (Itoh et al. (2005), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (MKO K), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret, Hauschildt & Witte (2012), A&A 546, A14 compute from PHOENIX model atmospheres for the H band at 2,350 K and log g 3.64 (u1 0.241, u2 0.499): a model, not a measurement of this planet ([nodes](source/photometry/claret-2012-h-quadratic.tsv)). Its temperature is the 2,350 K of its measurements record; log g 3.64 follows from the mass and radius of its astronomy record (packages/astronomy/data/bodies/dh-tau-b.json).

**Rotation.** No spin axis on the sky is measured; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The positions barely move in twenty years, so almost any orientation fits: the recorded orbit is one of them, not a measurement of the planet's path.
- The radius and mass are model values; the planet is a point in every image.
- No spin axis is measured.
- **Model limb.** The limb darkening is a model atmosphere at the planet's temperature and gravity, in the middle band of its color, not a measurement of this planet.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
