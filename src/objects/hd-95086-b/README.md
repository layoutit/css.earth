# HD 95086 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HD 95086 b is a young giant planet with a very red color. JWST's mid-infrared images rule out a warm disc around the planet as the cause. Its star is [HD 95086](../hd-95086/README.md).

## Sources

**Orbit.** Bowler et al. ([2020](https://arxiv.org/abs/1911.10569), AJ 159, 63) fit the literature astrometry with orbitize!'s OFTI, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). Desgrange et al. ([2022](https://arxiv.org/abs/2206.00425), A&A 664, A139) refit the orbit with two newer SPHERE positions using their own code, publishing no posterior; those two positions, from 2018 January and 2019 April, were not in the Bowler fit, and this orbit passes them within 3.4 and 5.1 mas, under two of their 2 to 3 mas errors. The recorded orbit: a = 60.6 au, e = 0.00, i = 149.1°, period about 367 years. The path drawn is this orbit. Every element and its derivation is in [`hd-95086-b.json`](../../../packages/astronomy/data/bodies/hd-95086-b.json).

**Radius, temperature and mass.** Radius 1.14 Jupiter radii, 936 K and 4.1 Jupiter masses from the Exo-REM fit with a surface-gravity prior to JWST/MIRI and near-infrared photometry by Malin et al. ([2024](https://arxiv.org/abs/2408.16843)), Table 8. Their fits span 1.0 to 1.14 Jupiter radii and 800 to 1,050 K. Model values: the planet is unresolved. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red NaCo L′ 3.77 µm (74.75 ± 13 µJy), green GPI K1 2.029 µm (18.3 ± 3.4 µJy), blue GPI H 1.632 µm (6.366 ± 1.5 µJy) (De Rosa et al. (2016), ApJ 824, 121; zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (NaCo L′), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** No limb darkening is drawn: at 936 K it is outside the 1,500 to 4,800 K of the models Claret, Hauschildt & Witte (2012), A&A 546, A14 tabulate; and no paper's fit of a cloudy model grid is recorded for it (source/photometry/atmosphere-fit.json).

**Rotation.** No rotation period or spin axis of HD 95086 b on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The orbit comes from a 2019 fit; it passes the two newer positions within two of their errors.
- The radius and mass are model values; the planet is a point in every image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
