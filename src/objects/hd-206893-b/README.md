# HD 206893 B

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

HD 206893 B is a dusty brown dwarf 11 au from its star. Small wobbles in its motion could be a moon of about 0.4 Jupiter masses, or instrument errors. Its star is [HD 206893](../hd-206893/README.md).

## Sources

**Orbit.** Kral et al. ([2026](https://arxiv.org/abs/2511.20091), A&A 705, A217) fit B and c together with orbitize! on VLTI/GRAVITY and SPHERE astrometry, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../packages/telescope-cli/src/new-object/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood; B's orbit uses the star's mass plus B's and c's, as orbitize! does ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). The distributed posterior is not the run in the paper's Table 2: its B mass centres near 7 Jupiter masses against the table's 19.5, but its orbit elements agree with the table within about one standard deviation, so the orbit comes from it and the mass from the table. The app draws B's own Keplerian orbit; the fit also moves the star under c's pull, which is why the orbit sits about 0.5 mas from each GRAVITY position (0.37 to 1.03 mas) while every earlier SPHERE position falls within 1.5 of its errors. The recorded orbit: a = 10.7 au, e = 0.06, i = 141.7°, period about 30 years. The path drawn is this orbit. Every element and its derivation is in [`hd-206893-b.json`](../../../packages/astronomy/data/bodies/hd-206893-b.json).

**Radius, temperature and mass.** Radius 1.79 Jupiter radii and 1,162 K from the Exo-REM fit to the GRAVITY spectrum and earlier photometry by Kral et al. ([2026](https://arxiv.org/abs/2511.20091)); their ATMO fit agrees (1.98 Jupiter radii, 1,097 K), while BT-Settl gives 0.93 and 1,582 K. Model values: B is unresolved. Mass 19.5 Jupiter masses, measured dynamically. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red MKO K 2.184 µm (626.5 ± 40 µJy), green MKO H 1.614 µm (193.6 ± 5.3 µJy), blue MKO J 1.2417 µm (68.65 ± 1.9 µJy) (Ward et al. (2021), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (MKO K), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law fitted to the MKO H intensity PICASO 4.1 (Batalha et al. 2019, ApJ 878, 70) computes from Exo-REM cloudy (Charnay et al. 2018, ApJ 854, 172; 1 times solar metallicity, C/O 0.75) model atmospheres at 1,347 K and log g 3.55, read between the models YGP_1300K_logg3.5, YGP_1300K_logg4.0, YGP_1350K_logg3.5, YGP_1350K_logg4.0 (u1 0.656, u2 0.043; the law fits each model's eight angles within 0.10% of the centre): a cloudy model, the one Kammerer et al. (2021), arXiv:2106.08249 fit to this planet, because no table reaches a planet this cold and nobody has resolved its disc ([nodes](source/photometry/picaso-exo-rem-h-quadratic.tsv)). The temperature and gravity are that fit's (Table 6, Exo-REM with extinction by enstatite dust (the dusty model): Teff 1347 +6/-7 K, log g 3.55 +0.06/-0.04 (toward the grid's lower boundary), [Fe/H] 0.06 +0.09/-0.07, C/O 0.75 +0.00/-0.01 (toward the upper boundary), radius 2.03 +/- 0.08, A_V 2.87 +0.36/-0.30, reduced chi-squared 0.757; the plain Exo-REM fit (1049 K, radius 2.32) is the one the paper calls an outlier; [record](source/photometry/atmosphere-fit.json)), not the 1,162 K of its measurements record. The paper dims this model by the extinction of enstatite dust, applied to the whole disc alike; the law is the model atmosphere's, without that dust.

**Rotation.** No rotation period or spin axis of HD 206893 B on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The orbit drawn leaves out the star's motion under c's pull, about half a milliarcsecond at GRAVITY's precision; invisible at 0.2 arcseconds.
- The distributed posterior's masses differ from the paper's table; the mass shown is the table's.
- The candidate moon is not drawn.
- The radius is a model value, and the models disagree by a factor of two.
- **Model limb.** The limb darkening is computed from the cloudy model a paper fitted to the planet, in the middle band of its color, not a measurement of this planet; another model grid would give another law. Among the 4 models it is read between, the disc near its edge (the lowest of the eight angles) is 39% to 45% as bright as the centre. PICASO finds 94% to 96% of the band flux the release states for those models.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
