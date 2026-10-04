# AF Lep b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

AF Lep b is the lowest-mass imaged planet whose mass was weighed through its orbit. It circles its star at about 8 au, in line with the star's spin. Its star is [AF Lep](../af-lep/README.md).

## Sources

**Orbit.** Balmer et al. ([2025](https://arxiv.org/abs/2411.05917)) fit three VLTI/GRAVITY positions (their Table 2), the earlier SPHERE, NIRC2 and NaCo astrometry and the Hipparcos-Gaia accelerations with orvara, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), but that posterior stores no likelihoods, so the sample kept is the one closest to the three GRAVITY positions, scored with their errors and correlations ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It misses them by 0.32, 0.05 and 0.07 mas (χ² 20.6 over six numbers), the best of 1,000 samples. The recorded orbit: a = 8.9 au, e = 0.015, i = 57.8°, period about 23 years. The path drawn is this orbit. Every element and its derivation is in [`af-lep-b.json`](../../../packages/astronomy/data/bodies/af-lep-b.json).

**Radius, temperature and mass.** Radius 1.30 Jupiter radii and 770 K from the evolutionary-model row of Balmer et al. ([2025](https://arxiv.org/abs/2411.05917)), Table 4 (Saumon & Marley 2008 hybrid clouds at 24 million years). Their atmosphere fits give radii from 0.5 to 1.8 Jupiter radii, which they discuss as a radius problem in section 5, so the evolutionary values are used. Mass 3.75 ± 0.5 Jupiter masses, measured dynamically from the orbit and the star's acceleration. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red 2MASS Ks 2.159 µm (133 ± 8.6 µJy), green MKO H 1.614 µm (37.23 ± 12 µJy), blue MKO J 1.2417 µm (31.67 ± 9.6 µJy) (De Rosa et al. (2023); Mesa et al. (2023), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (2MASS Ks), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** No limb darkening is drawn: at 770 K it is outside the 1,500 to 4,800 K of the models Claret, Hauschildt & Witte (2012), A&A 546, A14 tabulate; and no paper's fit of a cloudy model grid is recorded for it (source/photometry/atmosphere-fit.json).

**Rotation.** No rotation period or spin axis of AF Lep b is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The posterior stores no likelihoods, so the orbit kept is the sample nearest the GRAVITY positions; it misses the first by 0.3 mas, several times that measurement's error.
- The radius is a model value, and the paper's own atmosphere fits disagree with it.
- No spin axis is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
