# HIP 65426 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HIP 65426 b is a young giant planet about 90 au from its star. JWST imaged it from 2 to 16 microns, and VLTI/GRAVITY has tracked its orbit since 2021. Its star is [HIP 65426](../hip-65426/README.md).

## Sources

**Orbit.** Blunt et al. ([2023](https://arxiv.org/abs/2310.00148)) fit three VLTI/GRAVITY positions (their Table 3) and the literature astrometry (Table 4) with orbitize! and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes the three GRAVITY positions within 0.09, 0.02 and 0.09 mas. The recorded orbit: a = 87.6 au, e = 0.20, i = 103.6°, period about 586 years. The path drawn is this orbit. Every element and its derivation is in [`hip-65426-b.json`](../../../packages/astronomy/data/bodies/hip-65426-b.json).

**Radius, temperature and mass.** Radius 1.06 ± 0.05 Jupiter radii and 1,624 K from the BT-Settl fit of Carter et al. ([2023](https://arxiv.org/abs/2208.14990), ApJL) to the JWST NIRCam and MIRI photometry with the SPHERE and NaCo data (section 5.5). Their hot-start evolutionary estimate is 1.44 Jupiter radii and 1,283 K; the model atmosphere radius is used. Mass 7.1 ± 1.2 Jupiter masses from the luminosity. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red 2MASS Ks 2.159 µm (115.9 ± 6.4 µJy), green 2MASS H 1.662 µm (78.4 ± 2.9 µJy), blue 2MASS J 1.235 µm (25.26 ± 9.8 µJy) (Chauvin et al. (2017); Cheetham et al. (2019), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (2MASS Ks), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret, Hauschildt & Witte (2012), A&A 546, A14 compute from PHOENIX model atmospheres for the H band at 1,624 K and log g 4.19 (u1 0.848, u2 -0.116): a model, not a measurement of this planet ([nodes](source/photometry/claret-2012-h-quadratic.tsv)). Its temperature is the 1,624 K of its measurements record; log g 4.19 follows from the mass and radius of its astronomy record (packages/astronomy/data/bodies/hip-65426-b.json).

**Rotation.** No rotation period or spin axis of HIP 65426 b is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The radius and mass are model values; the planet is a point in every image.
- The posterior holds 1,000 samples, so the orbit kept is the best of those, not a refined maximum.
- **Model limb.** The limb darkening is a model atmosphere at the planet's temperature and gravity, in the middle band of its color, not a measurement of this planet.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
